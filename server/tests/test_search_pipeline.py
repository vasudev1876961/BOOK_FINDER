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

    # Create test books with publication dates to verify year boosts
    book_1 = Book(
        title="Atomic Habits",
        description="Tiny daily improvements yield compounding, massive results over time.",
        isbn="9780735211292",
        rating=4.8,
        rating_count=50,
        pub_date="2018-10-16",
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
        pub_date="2016-01-05",
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
    corrected = search_pipeline.spell_correct_query("Atmoc Habits")
    assert "atomic" in corrected.lower()

def test_keyword_bm25_search(setup_db):
    db = setup_db
    results = search_pipeline.search(db, query="Habits", search_type="keyword")
    assert len(results) > 0
    assert results[0]["book"].title == "Atomic Habits"

    results = search_pipeline.search(db, query="concentration", search_type="keyword")
    assert len(results) > 0
    assert results[0]["book"].title == "Deep Work"

def test_hybrid_search(setup_db):
    db = setup_db
    results = search_pipeline.search(db, query="habits", search_type="hybrid")
    assert len(results) > 0
    matched_titles = [r["book"].title for r in results]
    assert "Atomic Habits" in matched_titles

def test_query_normalization(setup_db):
    # Verify that casing and excessive spaces are normalized
    normalized = search_pipeline.normalize_query("  ATOMIC    HABITS!!!  ")
    assert normalized == "atomic habits"

def test_synonym_expansion(setup_db):
    # Verify synonyms dictionary expands keywords
    tokens = ["craftsmanship"]
    expanded_tokens = list(tokens)
    for token in tokens:
        if token in search_pipeline.synonyms:
            expanded_tokens.extend(search_pipeline.synonyms[token])
    assert "clean" in expanded_tokens
    assert "design" in expanded_tokens

def test_freshness_boosting(setup_db):
    # Verify year parsing from strings
    year_1 = search_pipeline._get_pub_year("2018-10-16")
    year_2 = search_pipeline._get_pub_year("2016-01-05")
    year_3 = search_pipeline._get_pub_year("Undated")
    assert year_1 == 2018
    assert year_2 == 2016
    assert year_3 is None
