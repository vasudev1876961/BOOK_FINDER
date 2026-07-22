import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.database import Base
from app.database.models import Author, Book, Genre, Publisher
from app.services.search.search_pipeline import search_pipeline

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create test author, publisher, and genre
    author = Author(name="James Clear", bio="Author bio")
    publisher = Publisher(name="Avery")
    genre = Genre(name="Self-Help")
    db.add_all([author, publisher, genre])
    db.flush()

    # Create test books
    book_1 = Book(
        title="Atomic Habits",
        description="Tiny daily improvements yield compounding, massive results over time.",
        isbn="9780735211292",
        rating=4.8,
        rating_count=50,
        author=author,
        publisher=publisher,
        genres=[genre]
    )
    book_2 = Book(
        title="Deep Work",
        description="Rules for focused, distraction-free concentration on cognitively demanding tasks.",
        isbn="9781455586691",
        rating=4.6,
        rating_count=30,
        author=author,
        publisher=publisher,
        genres=[genre]
    )
    db.add_all([book_1, book_2])
    db.commit()

    # Rebuild search pipeline vocabulary
    search_pipeline.build_vocabulary(db)

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)

def test_spell_correct_query(setup_db):
    _db = setup_db
    # Type query with typo
    corrected = search_pipeline.spell_correct_query("Atmoc Habits")
    assert "atomic" in corrected.lower()

def test_keyword_bm25_search(setup_db):
    db = setup_db
    # Query matching title tokens
    results = search_pipeline.search(db, query="Habits", search_type="keyword")
    assert len(results) > 0
    assert results[0]["book"].title == "Atomic Habits"

    # Query matching description tokens
    results = search_pipeline.search(db, query="concentration", search_type="keyword")
    assert len(results) > 0
    assert results[0]["book"].title == "Deep Work"

def test_hybrid_search(setup_db):
    db = setup_db
    # Running hybrid search combines rankings
    results = search_pipeline.search(db, query="habits", search_type="hybrid")
    assert len(results) > 0
    # Checks that it retrieved matching items
    matched_titles = [r["book"].title for r in results]
    assert "Atomic Habits" in matched_titles
