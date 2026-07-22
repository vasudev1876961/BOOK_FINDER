from sqlalchemy.orm import Session

from app.core.logging import logger
from app.database.models import Book, Recommendation
from app.services.rag.rag_service import rag_service
from app.services.recommendations.recommender import recommendation_service


def background_index_book(db_session_factory, book_id: int):
    """
    Asynchronously chunks and indexes a book description into the vector database.
    Takes a session factory to create a safe session in a separate thread.
    """
    db: Session = db_session_factory()
    try:
        book = db.query(Book).filter(Book.id == book_id).first()
        if not book:
            logger.error(f"Background task failed: Book {book_id} not found.")
            return

        logger.info(f"[Background Task] Indexing book: '{book.title}' (ID: {book_id})")
        rag_service.index_book(db, book)

    except Exception as e:
        logger.error(f"[Background Task] Error indexing book {book_id}: {e}")
    finally:
        db.close()


def background_generate_recommendations(db_session_factory, user_id: int):
    """
    Asynchronously precomputes recommendations for a user and updates the cache.
    """
    db: Session = db_session_factory()
    try:
        logger.info(f"[Background Task] Precomputing hybrid recommendations for User {user_id}...")

        # 1. Generate recommendations
        recommended_books = recommendation_service.get_hybrid_recommendations(db, user_id, limit=20)

        if not recommended_books:
            logger.info(f"[Background Task] No recommendations generated for User {user_id}.")
            return

        # 2. Clear old cached recommendations for this user
        db.query(Recommendation).filter(Recommendation.user_id == user_id).delete()

        # 3. Save new recommendations to the cache table
        for idx, book in enumerate(recommended_books):
            # Assign relative score based on rank
            score = 1.0 - (idx * 0.04)  # Rank 0 gets 1.0, Rank 1 gets 0.96...
            rec = Recommendation(
                user_id=user_id,
                book_id=book.id,
                score=score,
                recommender_type="hybrid"
            )
            db.add(rec)

        db.commit()
        logger.info(f"[Background Task] Successfully cached {len(recommended_books)} recommendations for User {user_id}.")

    except Exception as e:
        db.rollback()
        logger.error(f"[Background Task] Error generating recommendations for User {user_id}: {e}")
    finally:
        db.close()


def background_rebuild_vocabulary(db_session_factory):
    """
    Asynchronously rebuilds the search spelling vocabulary.
    """
    db: Session = db_session_factory()
    try:
        logger.info("[Background Task] Rebuilding search spelling vocabulary...")
        from app.services.search.search_pipeline import search_pipeline
        search_pipeline.build_vocabulary(db)
    except Exception as e:
        logger.error(f"[Background Task] Error rebuilding vocabulary: {e}")
    finally:
        db.close()
