import math
import re
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import logger
from app.database.models import Author, Book, Genre
from app.services.ai.embedding_service import embedding_service
from app.services.rag.vector_store import vector_store

try:
    from rapidfuzz import process, utils
    has_rapidfuzz = True
except ImportError:
    has_rapidfuzz = False


class SearchPipeline:
    def __init__(self):
        self.vocabulary = set()

    def build_vocabulary(self, db: Session):
        """
        Builds a vocabulary of valid terms from books, authors, and genres to use for spell-checking.
        """
        try:
            vocab = set()
            # Get all book titles, author names, and genres
            books = db.query(Book.title, Book.description).all()
            authors = db.query(Author.name).all()
            genres = db.query(Genre.name).all()

            for title, desc in books:
                vocab.update(self._tokenize(title))
                if desc:
                    vocab.update(self._tokenize(desc))
            for (name,) in authors:
                vocab.update(self._tokenize(name))
            for (name,) in genres:
                vocab.update(self._tokenize(name))

            # Filter out short or numeric tokens
            self.vocabulary = {t for t in vocab if len(t) > 2 and not t.isdigit()}
            logger.info(f"Built spellcheck vocabulary with {len(self.vocabulary)} terms.")
        except Exception as e:
            logger.error(f"Failed to build search vocabulary: {e}")

    def _tokenize(self, text: str) -> list[str]:
        if not text:
            return []
        # Lowercase and split by alphanumeric characters
        return re.findall(r"\b\w+\b", text.lower())

    def spell_correct_query(self, query: str) -> str | None:
        """
        Corrects typos in the query using Levenshtein distance vocabulary matching.
        """
        if not query or not has_rapidfuzz or not self.vocabulary:
            return query

        tokens = self._tokenize(query)
        corrected_tokens = []
        changed = False

        for token in tokens:
            if token.isdigit() or len(token) <= 2:
                corrected_tokens.append(token)
                continue

            # If token is already in vocabulary, keep it
            if token in self.vocabulary:
                corrected_tokens.append(token)
                continue

            # Find closest match in vocabulary
            # score_cutoff restricts matching to reasonably close words
            match = process.extractOne(
                token,
                self.vocabulary,
                processor=utils.default_process,
                score_cutoff=65
            )

            if match:
                corrected_word = match[0]
                corrected_tokens.append(corrected_word)
                changed = True
                logger.info(f"Corrected typo '{token}' -> '{corrected_word}' (score: {match[1]})")
            else:
                corrected_tokens.append(token)

        return " ".join(corrected_tokens) if changed else None

    def _calculate_bm25_scores(self, db: Session, query: str) -> dict[int, float]:
        """
        Pure Python implementation of BM25 Keyword Search.
        Provides a database-agnostic full-text search fallback.
        """
        query_tokens = self._tokenize(query)
        if not query_tokens:
            return {}

        # Fetch all books with joined author/genres for content scoring
        books = db.query(Book).all()
        if not books:
            return {}

        # Parameters for BM25
        k1 = 1.5
        b = 0.75

        # 1. Document representation (Tokenization of books)
        # We index: Title (weight 4.0), Author (weight 2.0), Genres (weight 2.0), Description (weight 1.0)
        corpus: dict[int, list[str]] = {}
        doc_lengths: dict[int, int] = {}

        for book in books:
            title_tokens = self._tokenize(book.title)
            author_tokens = self._tokenize(book.author.name) if book.author else []
            genre_tokens = []
            for g in book.genres:
                genre_tokens.extend(self._tokenize(g.name))
            desc_tokens = self._tokenize(book.description) if book.description else []

            # Weighted virtual document
            tokens = (title_tokens * 4) + (author_tokens * 2) + (genre_tokens * 2) + desc_tokens
            corpus[book.id] = tokens
            doc_lengths[book.id] = len(tokens)

        # Average document length
        avg_doc_len = sum(doc_lengths.values()) / len(doc_lengths)

        # 2. Document frequency (DF) of query terms in the corpus
        doc_frequency: dict[str, int] = {}
        for term in query_tokens:
            count = 0
            for _, tokens in corpus.items():
                if term in tokens:
                    count += 1
            doc_frequency[term] = count

        # 3. Calculate IDF for each query term
        # IDF = log(1 + (N - DF + 0.5) / (DF + 0.5))
        N = len(books)
        idf: dict[str, float] = {}
        for term, df in doc_frequency.items():
            if df == 0:
                idf[term] = 0.0
            else:
                idf[term] = max(0.0001, math.log(1.0 + (N - df + 0.5) / (df + 0.5)))

        # 4. Calculate BM25 scores
        scores: dict[int, float] = {}
        for book_id, tokens in corpus.items():
            score = 0.0
            doc_len = doc_lengths[book_id]
            for term in query_tokens:
                term_count_in_doc = tokens.count(term)
                if term_count_in_doc == 0:
                    continue

                # BM25 tf score
                numerator = term_count_in_doc * (k1 + 1)
                denominator = term_count_in_doc + k1 * (1.0 - b + b * (doc_len / avg_doc_len))
                tf_score = numerator / denominator

                score += idf[term] * tf_score

            if score > 0:
                scores[book_id] = score

        return scores

    def _get_semantic_scores(self, query: str) -> dict[int, float]:
        """
        Retrieves matching chunks from vector store, rolling scores up to book-level.
        """
        query_vector = embedding_service.get_embedding(query)
        # Retrieve top 50 chunks for broader roll-up coverage
        chunk_hits = vector_store.query(query_vector, top_n=50)

        book_scores: dict[int, float] = {}
        # Roll up chunk scores: Take the max similarity score for each book
        for hit in chunk_hits:
            book_id = hit["metadata"].get("book_id")
            if book_id is None:
                continue

            score = hit["score"]
            if book_id not in book_scores or score > book_scores[book_id]:
                book_scores[book_id] = score

        return book_scores

    def search(
        self,
        db: Session,
        query: str,
        search_type: str = "hybrid",
        genres_filter: list[str] | None = None,
        min_rating: float | None = None,
        max_pages: int | None = None,
        language_filter: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Primary search entry point executing Keyword, Semantic, or Hybrid fusion search.
        """
        # Build vocabulary dynamically if empty
        if not self.vocabulary:
            self.build_vocabulary(db)

        # Spellcheck query
        spell_corrected = self.spell_correct_query(query)
        effective_query = spell_corrected if spell_corrected else query

        # Retrieve keyword and semantic scores
        kw_scores = {}
        sem_scores = {}

        if search_type in ["keyword", "hybrid"]:
            kw_scores = self._calculate_bm25_scores(db, effective_query)
        if search_type in ["semantic", "hybrid"]:
            sem_scores = self._get_semantic_scores(effective_query)

        # Final book scores
        final_scores: dict[int, float] = {}

        if search_type == "keyword":
            final_scores = kw_scores
        elif search_type == "semantic":
            final_scores = sem_scores
        elif search_type == "hybrid":
            # Reciprocal Rank Fusion (RRF) algorithm
            # Sort keys to establish ranking lists
            kw_ranked = sorted(kw_scores.keys(), key=lambda x: kw_scores[x], reverse=True)
            sem_ranked = sorted(sem_scores.keys(), key=lambda x: sem_scores[x], reverse=True)

            # Constant k for RRF (standard is 60)
            k = 60

            all_book_ids = set(kw_ranked).union(set(sem_ranked))
            for book_id in all_book_ids:
                rrf_score = 0.0
                if book_id in kw_ranked:
                    # rank is 0-indexed, so add 1
                    rank = kw_ranked.index(book_id) + 1
                    rrf_score += 1.0 / (k + rank)
                if book_id in sem_ranked:
                    rank = sem_ranked.index(book_id) + 1
                    rrf_score += 1.0 / (k + rank)
                final_scores[book_id] = rrf_score

        # Retrieve full Book models for final hits
        results = []
        if not final_scores:
            return []

        # Load matched books from DB
        matched_books = db.query(Book).filter(Book.id.in_(final_scores.keys())).all()
        book_map = {b.id: b for b in matched_books}

        for book_id, score in final_scores.items():
            book = book_map.get(book_id)
            if not book:
                continue

            # Apply filters
            if genres_filter:
                book_genre_names = {g.name.lower() for g in book.genres}
                if not any(gf.lower() in book_genre_names for gf in genres_filter):
                    continue

            if min_rating and book.rating < min_rating:
                continue

            if max_pages and book.pages and book.pages > max_pages:
                continue

            if language_filter and book.language and book.language.lower() != language_filter.lower():
                continue

            # Apply boosting: Score = Score * (1 + 0.1 * rating)
            boosted_score = score
            if book.rating:
                boosted_score *= (1.0 + 0.05 * book.rating)
            if book.rating_count:
                # Slight boost for high popularity
                boosted_score *= (1.0 + 0.02 * min(5.0, math.log1p(book.rating_count)))

            results.append({
                "book": book,
                "score": boosted_score
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results

# Singleton instance
search_pipeline = SearchPipeline()
