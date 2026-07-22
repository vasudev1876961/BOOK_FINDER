import os

import pytest

from app.services.rag.vector_store import NumpyVectorStore


@pytest.fixture
def temp_vector_store(tmp_path):
    # Create a vector store saving to a temporary test file
    db_file = tmp_path / "test_vector_store.pkl"
    store = NumpyVectorStore(filepath=str(db_file))
    yield store
    # Clean up file after test
    if os.path.exists(str(db_file)):
        os.remove(str(db_file))

def test_numpy_store_basic_operations(temp_vector_store):
    store = temp_vector_store

    # 1. Add sample chunks
    ids = ["chunk_1", "chunk_2"]
    vectors = [
        [1.0, 0.0, 0.0],  # Orthogonal vectors
        [0.0, 1.0, 0.0]
    ]
    texts = ["This is context A.", "This is context B."]
    metadatas = [
        {"book_id": 1, "section": "intro"},
        {"book_id": 2, "section": "chapter_1"}
    ]

    store.add_chunks(ids, vectors, texts, metadatas)

    # Verify data is stored
    assert len(store.data) == 2
    assert store.data["chunk_1"]["text"] == "This is context A."

    # 2. Query matches closest vector (query [1, 0, 0] should match chunk_1 perfectly)
    results = store.query(query_vector=[1.0, 0.0, 0.0], top_n=1)
    assert len(results) == 1
    assert results[0]["id"] == "chunk_1"
    assert pytest.approx(results[0]["score"]) == 1.0

    # 3. Query with metadata filter
    results_filtered = store.query(
        query_vector=[1.0, 0.0, 0.0],
        top_n=5,
        filter_metadata={"book_id": 2}
    )
    # Even though query is closer to chunk_1, it should only return chunk_2 due to filter
    assert len(results_filtered) == 1
    assert results_filtered[0]["id"] == "chunk_2"
    assert pytest.approx(results_filtered[0]["score"]) == 0.0  # Orthogonal

def test_numpy_store_delete_by_book(temp_vector_store):
    store = temp_vector_store

    ids = ["chunk_1", "chunk_2", "chunk_3"]
    vectors = [[1.0, 0.0], [0.0, 1.0], [0.5, 0.5]]
    texts = ["Text A", "Text B", "Text C"]
    metadatas = [
        {"book_id": 1},
        {"book_id": 1},
        {"book_id": 2}
    ]

    store.add_chunks(ids, vectors, texts, metadatas)
    assert len(store.data) == 3

    # Delete chunks for book_id 1
    store.delete_by_book(book_id=1)

    # Should only leave chunk_3 (associated with book_id 2)
    assert len(store.data) == 1
    assert "chunk_3" in store.data
    assert "chunk_1" not in store.data

def test_numpy_store_persistence(tmp_path):
    db_file = tmp_path / "persistent_test.pkl"

    # Initialize first instance and add chunks
    store_1 = NumpyVectorStore(filepath=str(db_file))
    store_1.add_chunks(
        ids=["c1"],
        vectors=[[1.0, 0.0]],
        texts=["Data content"],
        metadatas=[{"book_id": 5}]
    )

    # Initialize second instance using same file path
    store_2 = NumpyVectorStore(filepath=str(db_file))

    # Verify second instance loaded data from file
    assert "c1" in store_2.data
    assert store_2.data["c1"]["text"] == "Data content"

    # Clean up
    if os.path.exists(str(db_file)):
        os.remove(str(db_file))
