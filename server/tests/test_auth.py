import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database.database import Base, get_db
from app.main import app

# 1. Setup in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="setup_db")
def setup_db_fixture():
    # Create tables before each test
    Base.metadata.create_all(bind=engine)
    yield
    # Drop tables after each test
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="client")
def client_fixture(setup_db):
    # Override database dependency injection
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

def test_register_user(client):
    response = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "test@user.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@user.com"
    assert data["full_name"] == "Test User"
    assert "id" in data
    assert data["role"] == "user"

def test_login_user(client):
    # Register first
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "test@user.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
    )

    # Login
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "test@user.com",
            "password": "testpassword123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

def test_get_current_user_profile(client):
    # Register and login
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "test@user.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
    )
    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "test@user.com",
            "password": "testpassword123"
        }
    )
    access_token = login_resp.json()["access_token"]

    # Get profile
    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get(f"{settings.API_V1_STR}/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@user.com"
    assert data["full_name"] == "Test User"
