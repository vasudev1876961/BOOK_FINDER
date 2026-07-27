from typing import Any

import numpy as np
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.database.models import Book, Favorite, ReadingList, User
from app.services.ai.embedding_service import embedding_service


class RecommendationService:
    def get_popularity_recommendations(self, db: Session, limit: int = 10) -> list[Book]:
        """
        Cold start / Popularity recommender.
        Returns books sorted by rating and favorited count.
        """
        # Calculate favorite count per book
        fav_counts = (
            db.query(Favorite.book_id, func.count(Favorite.id).label("fav_count"))
            .group_by(Favorite.book_id)
            .subquery()
        )

        books = (
            db.query(Book)
            .outerjoin(fav_counts, Book.id == fav_counts.c.book_id)
            .order_by(
                Book.rating.desc(),
                func.coalesce(fav_counts.c.fav_count, 0).desc()
            )
            .limit(limit)
            .all()
        )
        return books

    def get_content_recommendations(self, db: Session, user_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """
        Content-based recommender using cosine similarity of book embeddings.
        Takes the user's highly-rated/completed/favorited books, generates profile vectors,
        and finds closest matches in the catalog.
        """
        # 1. Fetch user's active books (favorites + completed/reading shelf)
        favs = db.query(Favorite.book_id).filter(Favorite.user_id == user_id).all()
        lists = db.query(ReadingList.book_id).filter(
            ReadingList.user_id == user_id,
            ReadingList.status.in_(["reading", "completed"])
        ).all()

        user_book_ids = {f[0] for f in favs}.union({item[0] for item in lists})
        if not user_book_ids:
            return []

        # 2. Get embeddings for the user's books
        user_books = db.query(Book).filter(Book.id.in_(user_book_ids)).all()
        user_vectors = []
        user_vector_map = {}
        for b in user_books:
            if b.description:
                emb = embedding_service.get_embedding(b.description)
                user_vectors.append(emb)
                user_vector_map[b.id] = emb

        if not user_vectors:
            return []

        # Aggregate user vector (centroid of user's books)
        user_profile_vector = np.mean(user_vectors, axis=0)
        # Normalize
        norm = np.linalg.norm(user_profile_vector)
        if norm > 0:
            user_profile_vector = user_profile_vector / norm

        # 3. Compute similarity with all OTHER books in the database
        all_other_books = db.query(Book).filter(~Book.id.in_(user_book_ids)).all()
        recommendations = []

        for book in all_other_books:
            if not book.description:
                continue

            book_vector = np.array(embedding_service.get_embedding(book.description))
            # Normalize
            b_norm = np.linalg.norm(book_vector)
            if b_norm > 0:
                book_vector = book_vector / b_norm

            similarity = float(np.dot(user_profile_vector, book_vector))

            # Find the most similar book in user's history for explainability
            best_match_book = None
            best_match_score = -1.0
            for u_b in user_books:
                if u_b.id not in user_vector_map:
                    continue
                u_vec = np.array(user_vector_map[u_b.id])
                u_norm = np.linalg.norm(u_vec)
                if u_norm > 0:
                    u_vec = u_vec / u_norm
                sim = float(np.dot(u_vec, book_vector))
                if sim > best_match_score:
                    best_match_score = sim
                    best_match_book = u_b

            explanation = ""
            if best_match_book:
                explanation = f"Because you liked '{best_match_book.title}'"
            else:
                explanation = "Similar content from your shelf"

            recommendations.append({
                "book": book,
                "score": similarity,
                "recommender_type": "content",
                "explanation": explanation
            })

        # Sort descending
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations[:limit]

    def get_collaborative_recommendations(self, db: Session, user_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """
        Collaborative filtering: Finds users with similar favorite books,
        and recommends books they liked that the target user hasn't read.
        """
        # Target user's favorites
        target_favs = {f.book_id for f in db.query(Favorite).filter(Favorite.user_id == user_id).all()}
        if not target_favs:
            return []

        # Other users
        other_users = db.query(User).filter(User.id != user_id).all()
        user_similarities = []

        # Compute overlap with other users (Jaccard similarity)
        for user in other_users:
            u_favs = {f.book_id for f in db.query(Favorite).filter(Favorite.user_id == user.id).all()}
            if not u_favs:
                continue

            intersection = target_favs.intersection(u_favs)
            union = target_favs.union(u_favs)
            jaccard = len(intersection) / len(union) if union else 0.0

            if jaccard > 0:
                user_similarities.append((user.id, jaccard, u_favs))

        if not user_similarities:
            return []

        # Sort other users by similarity
        user_similarities.sort(key=lambda x: x[1], reverse=True)

        # Aggregate recommendations from similar users
        book_scores = {}
        for _, similarity, u_favs in user_similarities[:5]:  # Look at top 5 similar users
            unseen_favs = u_favs.difference(target_favs)
            for book_id in unseen_favs:
                # Score is weighted by user similarity
                book_scores[book_id] = book_scores.get(book_id, 0.0) + similarity

        if not book_scores:
            return []

        # Fetch books
        recommended_books = db.query(Book).filter(Book.id.in_(book_scores.keys())).all()
        recommendations = []
        for book in recommended_books:
            recommendations.append({
                "book": book,
                "score": book_scores[book.id],
                "recommender_type": "collaborative",
                "explanation": "Recommended based on similar reader preferences"
            })

        # Sort descending
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        return recommendations[:limit]

    def get_hybrid_recommendations(self, db: Session, user_id: int, limit: int = 10) -> list[dict[str, Any]]:
        """
        Combines Content-based, Collaborative filtering, and Popularity recommendations.
        Checks for cold start, applies weight parameters, and merges results.
        """
        # 1. Check if user is new / has no history (Cold Start)
        user_fav_count = db.query(Favorite).filter(Favorite.user_id == user_id).count()
        user_shelf_count = db.query(ReadingList).filter(ReadingList.user_id == user_id).count()

        if user_fav_count == 0 and user_shelf_count == 0:
            logger.info(f"Cold start detected for user {user_id}. Serving popularity recommendations.")
            pop_books = self.get_popularity_recommendations(db, limit)
            results = []
            for book in pop_books:
                results.append({
                    "book": book,
                    "score": 0.8,
                    "recommender_type": "popularity",
                    "explanation": "Trending choice in the Aetheria catalog"
                })
            return results

        # 2. Fetch recommendations from pipelines
        content_hits = self.get_content_recommendations(db, user_id, limit=limit*2)
        collab_hits = self.get_collaborative_recommendations(db, user_id, limit=limit*2)
        pop_books = self.get_popularity_recommendations(db, limit=limit*2)

        # 3. Normalize scores and compile candidates
        candidates = {}

        # Max score for normalizing collab
        max_collab = max([x["score"] for x in collab_hits]) if collab_hits else 1.0

        # Add Content Candidates (Weight: 0.6)
        for hit in content_hits:
            bid = hit["book"].id
            candidates[bid] = {
                "book": hit["book"],
                "score": 0.6 * hit["score"],
                "recommender_type": "content",
                "explanation": hit.get("explanation", "Matches your reading interests")
            }

        # Add Collaborative Candidates (Weight: 0.3)
        for hit in collab_hits:
            bid = hit["book"].id
            norm_score = hit["score"] / max_collab
            if bid in candidates:
                candidates[bid]["score"] += 0.3 * norm_score
                # Content+Collab is a strong hybrid match
                candidates[bid]["explanation"] += " and similar reader tastes"
            else:
                candidates[bid] = {
                    "book": hit["book"],
                    "score": 0.3 * norm_score,
                    "recommender_type": "collaborative",
                    "explanation": hit.get("explanation", "Recommended based on similar reader preferences")
                }

        # Add Popularity fallbacks (Weight: 0.1)
        for idx, book in enumerate(pop_books):
            bid = book.id
            pop_score = 1.0 / (idx + 1.0)  # Rank-based popularity score
            if bid in candidates:
                candidates[bid]["score"] += 0.1 * pop_score
            else:
                candidates[bid] = {
                    "book": book,
                    "score": 0.1 * pop_score,
                    "recommender_type": "popularity",
                    "explanation": "Trending choice in the Aetheria catalog"
                }

        # 4. Sort and return
        final_list = list(candidates.values())
        final_list.sort(key=lambda x: x["score"], reverse=True)

        return final_list[:limit]


# Singleton instance
recommendation_service = RecommendationService()
