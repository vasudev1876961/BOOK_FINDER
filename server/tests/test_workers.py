import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base
from app.database.models import Book, Favorite, Recommendation, User
from app.services.search.search_pipeline import search_pipeline
from app.services.workers.tasks import (
    background_generate_recommendations,
    background_index_book,
    background_rebuild_vocabulary,
)

# 1. Setup in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session")
def db_session_fixture():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed basic book and user records
        b1 = Book(
            title="Sapiens",
            description="A brief history of humankind.",
            rating=4.8
        )
        u1 = User(
            email="worker_test@example.com",
            hashed_password="hashed_pw",
            full_name="Worker Tester",
            is_active=True,
            role="user"
        )
        db.add_all([b1, u1])
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def test_background_index_book(db_session):
    book = db_session.query(Book).filter(Book.title == "Sapiens").first()
    assert book is not None

    # Run the background indexing task synchronously in our test runner thread
    # passing our testing session factory
    background_index_book(TestingSessionLocal, book.id)

    # Verify that the book is indexed by checking that we can query vector chunks
    # (Since RAG service uses our local Numpy vector store adapter, we can check it)
    from app.services.rag.vector_store import vector_store
    results = vector_store.query([0.1] * 384, top_n=5, filter_metadata={"book_id": book.id})
    assert len(results) > 0
    assert results[0]["metadata"]["book_id"] == book.id


def test_background_rebuild_vocabulary(db_session):
    # Clear vocabulary first
    search_pipeline.vocabulary = set()
    assert len(search_pipeline.vocabulary) == 0

    # Run vocabulary builder task
    background_rebuild_vocabulary(TestingSessionLocal)

    # Sapiens has tokens 'sapiens', 'brief', 'history', 'humankind'
    # Check that vocabulary is rebuilt and contains tokens from Sapiens description
    assert len(search_pipeline.vocabulary) > 0
    assert "sapiens" in search_pipeline.vocabulary
    assert "history" in search_pipeline.vocabulary


def test_background_generate_recommendations(db_session):
    user = db_session.query(User).filter(User.email == "worker_test@example.com").first()
    book = db_session.query(Book).filter(Book.title == "Sapiens").first()

    # User favorites the book
    fav = Favorite(user_id=user.id, book_id=book.id)
    db_session.add(fav)
    db_session.commit()

    # Verify no cached recommendations exist yet
    cached = db_session.query(Recommendation).filter(Recommendation.user_id == user.id).all()
    assert len(cached) == 0

    # Run recommendation precomputation worker
    background_generate_recommendations(TestingSessionLocal, user.id)

    # Recommendations should be calculated and stored in cache table
    cached = db_session.query(Recommendation).filter(Recommendation.user_id == user.id).all()
    assert len(cached) > 0
    assert cached[0].book_id == book.id
    assert cached[0].score > 0.0
