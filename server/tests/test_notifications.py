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


def get_auth_header(client, email="reader@test.com"):
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "Test Reader"},
    )
    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_notification_flow(client):
    headers = get_auth_header(client)

    # 1. Initially empty
    resp = client.get(f"{settings.API_V1_STR}/notifications/", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["unread_count"] == 0
    assert len(data["notifications"]) == 0

    # 2. Create notification
    create_resp = client.post(
        f"{settings.API_V1_STR}/notifications/",
        headers=headers,
        json={"title": "Goal Achieved", "message": "You completed 30 pages!"},
    )
    assert create_resp.status_code == 201
    notif_id = create_resp.json()["id"]

    # 3. Check list shows unread
    resp = client.get(f"{settings.API_V1_STR}/notifications/", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["unread_count"] == 1
    assert data["notifications"][0]["id"] == notif_id
    assert data["notifications"][0]["is_read"] is False

    # 4. Mark as read
    read_resp = client.patch(
        f"{settings.API_V1_STR}/notifications/{notif_id}/read", headers=headers
    )
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True

    # 5. Verify unread count is now 0
    resp = client.get(f"{settings.API_V1_STR}/notifications/", headers=headers)
    assert resp.json()["unread_count"] == 0

    # 6. Delete notification
    del_resp = client.delete(
        f"{settings.API_V1_STR}/notifications/{notif_id}", headers=headers
    )
    assert del_resp.status_code == 204

    # 7. Check list is empty
    resp = client.get(f"{settings.API_V1_STR}/notifications/", headers=headers)
    assert len(resp.json()["notifications"]) == 0
