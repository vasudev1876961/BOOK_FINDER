import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database.database import Base, get_db
from app.database.models import Author, Book
from app.main import app
from app.services.cache.cache_service import cache_service

# 1. Setup database
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
        db.add(b1)
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


@pytest.fixture(autouse=True)
def clean_cache():
    cache_service.clear()
    yield
    cache_service.clear()


def test_cache_service_crud():
    cache_service.set("test_key", {"foo": "bar"}, expire_seconds=10)
    assert cache_service.get("test_key") == {"foo": "bar"}

    cache_service.delete("test_key")
    assert cache_service.get("test_key") is None

    cache_service.set("test_key2", "value2")
    cache_service.clear()
    assert cache_service.get("test_key2") is None


def test_api_cache_aside_flow(client, db_session):
    # Register / login admin to call invalidation endpoints
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "admin_cache@example.com",
            "password": "testpassword123",
            "full_name": "Admin Cache"
        }
    )
    # Mocking admin role promotion
    from app.database.models import User
    admin_user = db_session.query(User).filter(User.email == "admin_cache@example.com").first()
    admin_user.role = "admin"
    db_session.commit()

    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "admin_cache@example.com",
            "password": "testpassword123"
        }
    )
    access_token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 1. Fetch book (should read from DB and populate cache)
    cache_key = "book:detail:1"
    assert cache_service.get(cache_key) is None

    response = client.get(f"{settings.API_V1_STR}/books/1")
    assert response.status_code == 200
    assert response.json()["title"] == "Atomic Habits"

    # Verify cache is populated
    cached_val = cache_service.get(cache_key)
    assert cached_val is not None
    assert cached_val["title"] == "Atomic Habits"

    # 2. Modify book in DB directly to verify cache hit ignores DB modifications
    book = db_session.query(Book).filter(Book.id == 1).first()
    book.title = "Atomic Habits Modified Title"
    db_session.commit()

    # Querying API should still return cached original title
    response_cached = client.get(f"{settings.API_V1_STR}/books/1")
    assert response_cached.status_code == 200
    assert response_cached.json()["title"] == "Atomic Habits"

    # 3. Call update endpoint to trigger cache invalidation
    update_payload = {
        "title": "Atomic Habits New Title"
    }
    response_update = client.put(
        f"{settings.API_V1_STR}/books/1",
        json=update_payload,
        headers=headers
    )
    assert response_update.status_code == 200

    # Verify cache has been invalidated/deleted
    assert cache_service.get(cache_key) is None

    # Fetch again should pull new title from DB and populate cache
    response_fresh = client.get(f"{settings.API_V1_STR}/books/1")
    assert response_fresh.status_code == 200
    assert response_fresh.json()["title"] == "Atomic Habits New Title"
    assert cache_service.get(cache_key)["title"] == "Atomic Habits New Title"
