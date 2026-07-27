import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.database import Base, get_db
from app.database.models import Author, Book, Favorite, Genre, User
from app.main import app
from app.services.recommendations.recommender import recommendation_service

# 1. Setup in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    # Use StaticPool to persist memory connection across threads in tests
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
        # Seed basic mock books, authors, genres
        author_1 = Author(name="James Clear")
        author_2 = Author(name="Cal Newport")
        db.add_all([author_1, author_2])
        db.flush()

        genre_self = Genre(name="Self-Help")
        genre_tech = Genre(name="Technology")
        db.add_all([genre_self, genre_tech])
        db.flush()

        # Create books
        b1 = Book(title="Atomic Habits", description="Tiny changes, habits...", rating=4.8, author=author_1, genres=[genre_self])
        b2 = Book(title="Deep Work", description="Focus in a distracted world...", rating=4.7, author=author_2, genres=[genre_self, genre_tech])
        b3 = Book(title="Digital Minimalism", description="Decluttering your digital life...", rating=4.5, author=author_2, genres=[genre_self, genre_tech])
        b4 = Book(title="Clean Code", description="A handbook of agile software craftsmanship...", rating=4.9, author=author_2, genres=[genre_tech])
        db.add_all([b1, b2, b3, b4])
        db.flush()

        # Create users
        u1 = User(email="user1@example.com", hashed_password="pw1", full_name="User One", is_active=True, role="user")
        u2 = User(email="user2@example.com", hashed_password="pw2", full_name="User Two", is_active=True, role="user")
        u3 = User(email="user3@example.com", hashed_password="pw3", full_name="User Three", is_active=True, role="user")
        db.add_all([u1, u2, u3])
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


def test_popularity_recommender(db_session):
    # Returns books ordered by rating since there are no favorites yet
    books = recommendation_service.get_popularity_recommendations(db_session, limit=2)
    assert len(books) == 2
    # Clean Code (4.9) should be first, then Atomic Habits (4.8)
    assert books[0].title == "Clean Code"
    assert books[1].title == "Atomic Habits"


def test_content_recommender_cold_start_fallback(db_session):
    # User 1 has no history: content recommender returns empty list (handled in hybrid as fallback)
    u1 = db_session.query(User).filter(User.email == "user1@example.com").first()
    recs = recommendation_service.get_content_recommendations(db_session, user_id=u1.id)
    assert len(recs) == 0


def test_collaborative_filtering_jaccard(db_session):
    # Fetch entities
    u1 = db_session.query(User).filter(User.email == "user1@example.com").first()
    u2 = db_session.query(User).filter(User.email == "user2@example.com").first()

    b1 = db_session.query(Book).filter(Book.title == "Atomic Habits").first()
    b2 = db_session.query(Book).filter(Book.title == "Deep Work").first()
    b3 = db_session.query(Book).filter(Book.title == "Digital Minimalism").first()

    # User 1 likes b1 and b2
    db_session.add_all([
        Favorite(user_id=u1.id, book_id=b1.id),
        Favorite(user_id=u1.id, book_id=b2.id)
    ])
    # User 2 likes b1, b2, and b3
    db_session.add_all([
        Favorite(user_id=u2.id, book_id=b1.id),
        Favorite(user_id=u2.id, book_id=b2.id),
        Favorite(user_id=u2.id, book_id=b3.id)
    ])
    db_session.commit()

    # Collaborative filtering for User 1 should recommend b3 because User 2 has high overlap (likes b1, b2)
    recs = recommendation_service.get_collaborative_recommendations(db_session, user_id=u1.id)
    assert len(recs) > 0
    assert recs[0]["book"].id == b3.id
    assert recs[0]["score"] > 0.0


def test_api_recommendations_endpoint_guest_blocked(client):
    # Direct recommendation endpoint requires authentication
    response = client.get("/api/v1/recommendations/")
    assert response.status_code == 401


def test_api_recalculate_endpoint_guest_blocked(client):
    # Recalculate endpoint requires authentication
    response = client.post("/api/v1/recommendations/recalculate")
    assert response.status_code == 401


def test_recommendation_explanations(db_session):
    u1 = db_session.query(User).filter(User.email == "user1@example.com").first()
    b1 = db_session.query(Book).filter(Book.title == "Atomic Habits").first()

    # User 1 favorites Atomic Habits
    db_session.add(Favorite(user_id=u1.id, book_id=b1.id))
    db_session.commit()

    # Content recommender should generate explanation based on favorite
    recs = recommendation_service.get_content_recommendations(db_session, user_id=u1.id)
    assert len(recs) > 0
    assert "explanation" in recs[0]
    assert recs[0]["explanation"].startswith("Because you liked")

    # Hybrid recommender should return items with explanations
    hybrid_recs = recommendation_service.get_hybrid_recommendations(db_session, user_id=u1.id)
    assert len(hybrid_recs) > 0
    assert "explanation" in hybrid_recs[0]
    assert "recommender_type" in hybrid_recs[0]
