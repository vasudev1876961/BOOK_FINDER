from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database.database import Base, get_db
from app.database.models import User
from app.main import app
from app.services.ingestion.google_books import google_books_service

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="setup_db")
def setup_db_fixture():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def client_fixture(setup_db):
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def get_admin_header(client):
    # Register and upgrade user to admin
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "admin@aetheria.com",
            "password": "AdminPassword123!",
            "full_name": "Admin User",
        },
    )
    # Update role to admin in db directly
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "admin@aetheria.com").first()
    user.role = "admin"
    db.commit()
    db.close()

    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": "admin@aetheria.com", "password": "AdminPassword123!"},
    )
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_clean_isbn_utility():
    assert google_books_service.clean_isbn("978-0-13-235088-4") == "9780132350884"
    assert google_books_service.clean_isbn(" 0-13-235088-2 ") == "0132350882"
    assert google_books_service.clean_isbn("invalid-isbn") is None
    assert google_books_service.clean_isbn(None) is None


def test_ingest_book_and_prevent_duplicate(client):
    headers = get_admin_header(client)

    book_payload = {
        "title": "Clean Code",
        "author_name": "Robert C. Martin",
        "publisher_name": "Prentice Hall",
        "description": "A handbook of agile software craftsmanship.",
        "isbn": "978-0-13-235088-4",
        "pub_date": "2008-08-01",
        "pages": 464,
        "cover_url": "https://example.com/cleancode.jpg",
        "language": "English",
        "genres": ["Technology", "Software Engineering"],
    }

    # 1. First Ingestion: Success (201)
    resp = client.post(
        f"{settings.API_V1_STR}/books/external/ingest",
        headers=headers,
        json=book_payload,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Clean Code"
    assert data["isbn"] == "9780132350884"
    assert data["author"]["name"] == "Robert C. Martin"
    assert data["publisher"]["name"] == "Prentice Hall"

    # 2. Duplicate Ingestion by ISBN: Conflict (409)
    dup_resp = client.post(
        f"{settings.API_V1_STR}/books/external/ingest",
        headers=headers,
        json=book_payload,
    )
    assert dup_resp.status_code == 409


@patch("app.services.ingestion.google_books.httpx.Client")
def test_external_search_endpoint(mock_client_cls, client):
    headers = get_admin_header(client)

    # Mock Google Books API JSON response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "items": [
            {
                "id": "vol123",
                "volumeInfo": {
                    "title": "Refactoring",
                    "authors": ["Martin Fowler"],
                    "publisher": "Addison-Wesley",
                    "publishedDate": "2018-11-20",
                    "description": "Improving the design of existing code.",
                    "pageCount": 448,
                    "industryIdentifiers": [
                        {"type": "ISBN_13", "identifier": "9780134757599"}
                    ],
                    "imageLinks": {
                        "thumbnail": "http://books.google.com/refactoring.jpg"
                    },
                    "categories": ["Computers"],
                    "language": "en",
                },
            }
        ]
    }
    mock_client = MagicMock()
    mock_client.get.return_value = mock_response
    mock_client_cls.return_value.__enter__.return_value = mock_client

    resp = client.get(
        f"{settings.API_V1_STR}/books/external/search?q=refactoring",
        headers=headers,
    )
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 1
    assert results[0]["title"] == "Refactoring"
    assert results[0]["isbn"] == "9780134757599"
    assert results[0]["cover_url"].startswith("https://")
