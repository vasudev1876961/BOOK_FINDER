from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database.database import Base, get_db
from app.main import app

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


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(client):
    # Register and login to generate authorization headers
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "ocr_test@user.com",
            "password": "testpassword123",
            "full_name": "OCR Tester",
        },
    )
    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": "ocr_test@user.com", "password": "testpassword123"},
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_parse_cover_endpoint(client, auth_headers):
    # Prepare mock file
    files = {"file": ("atomic_habits.jpg", b"fake image bytes", "image/jpeg")}

    response = client.post(
        f"{settings.API_V1_STR}/ocr/parse-cover", files=files, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Atomic Habits"
    assert data["author_name"] == "James Clear"


@patch("httpx.Client")
def test_scan_barcode_endpoint(mock_client_class, client, auth_headers):
    # Mock Open Library API HTTP response
    mock_client = MagicMock()
    mock_client_class.return_value.__enter__.return_value = mock_client

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "ISBN:9780062316097": {
            "title": "Sapiens",
            "subtitle": "A Brief History of Humankind",
            "authors": [{"name": "Yuval Noah Harari"}],
            "publishers": [{"name": "Harper"}],
            "publish_date": "2015",
            "number_of_pages": 443,
            "cover": {"large": "https://cover-link.com"},
        }
    }
    mock_client.get.return_value = mock_response

    files = {"file": ("barcode.png", b"fake barcode bytes", "image/png")}
    response = client.post(
        f"{settings.API_V1_STR}/ocr/scan-barcode", files=files, headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["isbn"] == "9780062316097"
    assert data["details"]["title"] == "Sapiens"
    assert data["details"]["author_name"] == "Yuval Noah Harari"

