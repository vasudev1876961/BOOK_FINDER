import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database.database import Base, get_db
from app.database.models import Author, Book
from app.main import app
from app.services.ai.comparison_service import book_comparison_service
from app.services.ai.summarizer import book_summarizer

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
        # Seed basic book records
        author = Author(name="James Clear")
        db.add(author)
        db.flush()

        b1 = Book(
            id=1,
            title="Atomic Habits",
            description="Tiny changes, remarkable results.",
            rating=4.8,
            pages=320,
            language="English",
            author=author
        )
        b2 = Book(
            id=2,
            title="Deep Work",
            description="Rules for focused success in a distracted world.",
            rating=4.7,
            pages=304,
            language="English",
            author=author
        )
        db.add_all([b1, b2])
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="client")
def client_fixture(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_summarizer_service(db_session):
    book = db_session.query(Book).filter(Book.id == 1).first()
    summary = book_summarizer.generate_summary(book)
    assert "elevator pitch" in summary.lower()
    assert "lessons" in summary.lower()


def test_comparison_service(db_session):
    book_a = db_session.query(Book).filter(Book.id == 1).first()
    book_b = db_session.query(Book).filter(Book.id == 2).first()

    comparison = book_comparison_service.compare_books(book_a, book_b)
    assert "comparison summary" in comparison.lower()
    assert "|" in comparison  # Markdown table check


def test_api_book_summary_endpoint(client):
    response = client.get("/api/v1/books/1/ai-summary")
    assert response.status_code == 200
    data = response.json()
    assert data["book_id"] == 1
    assert "summary" in data
    assert "elevator pitch" in data["summary"].lower()


def test_api_book_compare_endpoint(client):
    response = client.post("/api/v1/books/compare?book_id_a=1&book_id_b=2")
    assert response.status_code == 200
    data = response.json()
    assert data["book_a_id"] == 1
    assert data["book_b_id"] == 2
    assert "comparison" in data
    assert "comparison summary" in data["comparison"].lower()


def test_api_book_summary_not_found(client):
    # Book 999 does not exist
    response = client.get("/api/v1/books/999/ai-summary")
    assert response.status_code == 404


def test_api_book_chat_endpoint(client):
    # Register and login
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "chat_user@example.com",
            "password": "testpassword123",
            "full_name": "Chat User"
        }
    )
    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "chat_user@example.com",
            "password": "testpassword123"
        }
    )
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Call RAG Q&A chat endpoint
    response = client.post(
        f"{settings.API_V1_STR}/books/1/chat?question=What habits are discussed?",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["book_id"] == 1
    assert "question" in data
    assert "answer" in data
    assert len(data["answer"]) > 0


def test_api_global_chat_endpoint(client):
    # Register and login
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "chat_user2@example.com",
            "password": "testpassword123",
            "full_name": "Chat User"
        }
    )
    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "chat_user2@example.com",
            "password": "testpassword123"
        }
    )
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # Call global RAG Q&A chat endpoint
    response = client.post(
        f"{settings.API_V1_STR}/books/chat?question=Recommend some self-help books",
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert "question" in data
    assert "answer" in data
    assert len(data["answer"]) > 0


def test_review_sentiment_service(db_session):
    from app.database.models import Review
    from app.services.ai.sentiment_service import review_sentiment_service

    book = db_session.query(Book).filter(Book.id == 1).first()
    review_a = Review(
        book_id=book.id,
        user_id=1,
        rating=5,
        review_text="This book is outstanding! Tiny habit loops changed my life."
    )
    review_b = Review(
        book_id=book.id,
        user_id=2,
        rating=2,
        review_text="Too repetitive. Could have been a blog post."
    )
    db_session.add_all([review_a, review_b])
    db_session.commit()

    reviews = db_session.query(Review).filter(Review.book_id == book.id).all()
    report = review_sentiment_service.analyze_reviews(book.title, reviews)

    assert "review consensus" in report.lower()

def test_api_review_sentiment_endpoint(client, db_session):
    from app.database.models import Review
    book = db_session.query(Book).filter(Book.id == 1).first()
    review = Review(
        book_id=book.id,
        user_id=1,
        rating=5,
        review_text="Pure gold! Actionable and inspiring."
    )
    db_session.add(review)
    db_session.commit()

    response = client.get(f"/api/v1/reviews/book/{book.id}/sentiment")
    assert response.status_code == 200
    data = response.json()
    assert data["book_id"] == book.id
    assert "sentiment_report" in data
    assert "consensus" in data["sentiment_report"].lower()


