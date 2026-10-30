import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.database.database import Base, get_db
from app.database.models import Author, Book
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session")
def db_session_fixture():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Create a test book
        author = Author(name="Cal Newport")
        db.add(author)
        db.flush()
        book = Book(
            title="Deep Work",
            description="Rules for focused success in a distracted world.",
            pages=304,
            rating=4.8,
            isbn="9781455586691",
            author=author,
        )
        db.add(book)
        db.commit()
        db.refresh(book)
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
    client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={
            "email": "reader@example.com",
            "password": "Password123!",
            "full_name": "Reading List Tester",
        },
    )
    login_resp = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": "reader@example.com", "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_reading_list_lifecycle(client, auth_headers, db_session):
    book = db_session.query(Book).first()
    assert book is not None

    # 1. Add book to 'want_to_read'
    add_resp = client.post(
        f"{settings.API_V1_STR}/reading-lists/",
        json={"book_id": book.id, "status": "want_to_read"},
        headers=auth_headers,
    )
    assert add_resp.status_code == 200
    data = add_resp.json()
    assert data["status"] == "want_to_read"
    assert data["book_id"] == book.id

    # 2. Get reading lists
    list_resp = client.get(
        f"{settings.API_V1_STR}/reading-lists/",
        headers=auth_headers,
    )
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["book"]["title"] == "Deep Work"

    # 3. Update status to 'completed'
    update_resp = client.post(
        f"{settings.API_V1_STR}/reading-lists/",
        json={"book_id": book.id, "status": "completed"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "completed"

    # 4. Export to CSV
    csv_resp = client.get(
        f"{settings.API_V1_STR}/reading-lists/export?format=csv",
        headers=auth_headers,
    )
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "Deep Work" in csv_resp.text
    assert "completed" in csv_resp.text

    # 5. Export to JSON
    json_resp = client.get(
        f"{settings.API_V1_STR}/reading-lists/export?format=json",
        headers=auth_headers,
    )
    assert json_resp.status_code == 200
    assert "application/json" in json_resp.headers["content-type"]
    json_data = json_resp.json()
    assert len(json_data) == 1
    assert json_data[0]["title"] == "Deep Work"
    assert json_data[0]["status"] == "completed"

    # 6. Favorite toggle
    fav_resp = client.post(
        f"{settings.API_V1_STR}/reading-lists/{book.id}/favorite",
        headers=auth_headers,
    )
    assert fav_resp.status_code == 200
    assert fav_resp.json()["favorited"] is True

    favs_resp = client.get(
        f"{settings.API_V1_STR}/reading-lists/favorites",
        headers=auth_headers,
    )
    assert favs_resp.status_code == 200
    assert len(favs_resp.json()) == 1

    # 7. Remove from reading list
    del_resp = client.delete(
        f"{settings.API_V1_STR}/reading-lists/{book.id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    # Verify empty reading list
    list_resp_after = client.get(
        f"{settings.API_V1_STR}/reading-lists/",
        headers=auth_headers,
    )
    assert list_resp_after.status_code == 200
    assert len(list_resp_after.json()) == 0
