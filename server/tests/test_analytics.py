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
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db_session")
def db_session_fixture():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
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

@pytest.fixture(name="auth_headers")
def auth_headers_fixture(client):
    # Register and login cleanly
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "analytics_tester@example.com",
            "password": "testpassword123",
            "full_name": "Analytics Tester"
        }
    )
    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={
            "email": "analytics_tester@example.com",
            "password": "testpassword123"
        }
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_goals_default_and_updates(client, auth_headers):
    # 1. Fetch defaults
    response = client.get(f"{settings.API_V1_STR}/analytics/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["daily_pages_goal"] == 30
    assert data["monthly_books_goal"] == 2
    assert data["yearly_books_goal"] == 12
    assert data["reading_speed"] == 1.5
    assert data["daily_pages_progress"] == 0

    # 2. Update Goals
    update_resp = client.post(
        f"{settings.API_V1_STR}/analytics/goals",
        json={
            "daily_pages_goal": 50,
            "monthly_books_goal": 5,
            "yearly_books_goal": 20,
            "reading_speed": 2.0
        },
        headers=auth_headers
    )
    assert update_resp.status_code == 200

    # 3. Verify changes
    response2 = client.get(f"{settings.API_V1_STR}/analytics/", headers=auth_headers)
    data2 = response2.json()
    assert data2["daily_pages_goal"] == 50
    assert data2["monthly_books_goal"] == 5
    assert data2["yearly_books_goal"] == 20
    assert data2["reading_speed"] == 2.0

def test_log_pages_progress(client, auth_headers):
    # 1. Log 15 pages
    log_resp = client.post(
        f"{settings.API_V1_STR}/analytics/log-pages",
        json={"pages": 15},
        headers=auth_headers
    )
    assert log_resp.status_code == 200
    assert log_resp.json()["daily_pages_read"] == 15

    # 2. Log another 10 pages
    log_resp2 = client.post(
        f"{settings.API_V1_STR}/analytics/log-pages",
        json={"pages": 10},
        headers=auth_headers
    )
    assert log_resp2.status_code == 200
    assert log_resp2.json()["daily_pages_read"] == 25

    # 3. Retrieve analytics and confirm
    response = client.get(f"{settings.API_V1_STR}/analytics/", headers=auth_headers)
    data = response.json()
    assert data["daily_pages_progress"] == 25
