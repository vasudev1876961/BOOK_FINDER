import os
import pickle
from typing import Any

import numpy as np

from app.core.config import settings
from app.core.logging import logger


class BaseVectorStore:
    def add_chunks(self, ids: list[str], vectors: list[list[float]], texts: list[str], metadatas: list[dict[str, Any]]):
        raise NotImplementedError()

    def query(self, query_vector: list[float], top_n: int = 5, filter_metadata: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        raise NotImplementedError()

    def delete_by_book(self, book_id: int):
        raise NotImplementedError()


class ChromaVectorStore(BaseVectorStore):
    """
    Implementation of vector search using ChromaDB persistent client.
    """
    def __init__(self):
        import chromadb
        logger.info(f"Initializing ChromaDB vector store at: {settings.CHROMA_PERSIST_DIRECTORY}")
        self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        self.collection = self.client.get_or_create_collection(name="book_chunks")

    def add_chunks(self, ids: list[str], vectors: list[list[float]], texts: list[str], metadatas: list[dict[str, Any]]):
        self.collection.add(
            ids=ids,
            embeddings=vectors,
            documents=texts,
            metadatas=metadatas
        )

    def query(self, query_vector: list[float], top_n: int = 5, filter_metadata: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        where_clause = None
        if filter_metadata:
            # Reformat for Chroma where syntax e.g., {"book_id": 5}
            where_clause = filter_metadata

        results = self.collection.query(
            query_embeddings=[query_vector],
            n_results=top_n,
            where=where_clause
        )

        formatted = []
        if results and results["ids"] and len(results["ids"][0]) > 0:
            for i in range(len(results["ids"][0])):
                # Chroma distance is L2 by default; we convert/report it as similarity
                # score = 1.0 / (1.0 + distance)
                dist = results["distances"][0][i] if "distances" in results and results["distances"] else 0.0
                similarity_score = 1.0 / (1.0 + dist)

                formatted.append({
                    "id": results["ids"][0][i],
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "score": float(similarity_score)
                })
        return formatted

    def delete_by_book(self, book_id: int):
        self.collection.delete(where={"book_id": book_id})


class NumpyVectorStore(BaseVectorStore):
    """
    Fallback vector store implemented in pure Python/Numpy.
    Loads and saves vectors to a pickle file.
    """
    def __init__(self, filepath: str = "./numpy_vector_store.pkl"):
        self.filepath = filepath
        self.data: dict[str, dict[str, Any]] = {}
        self.load()

    def load(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "rb") as f:
                    self.data = pickle.load(f)
                logger.info(f"Loaded {len(self.data)} vectors from local pickle vector store.")
            except Exception as e:
                logger.error(f"Failed to load local pickle vector store: {e}. Starting fresh.")
                self.data = {}

    def save(self):
        try:
            with open(self.filepath, "wb") as f:
                pickle.dump(self.data, f)
        except Exception as e:
            logger.error(f"Failed to save local pickle vector store: {e}")

    def add_chunks(self, ids: list[str], vectors: list[list[float]], texts: list[str], metadatas: list[dict[str, Any]]):
        for idx, chunk_id in enumerate(ids):
            self.data[chunk_id] = {
                "vector": vectors[idx],
                "text": texts[idx],
                "metadata": metadatas[idx]
            }
        self.save()

    def query(self, query_vector: list[float], top_n: int = 5, filter_metadata: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        if not self.data:
            return []

        q_vec = np.array(query_vector)
        # Normalize query vector
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        candidates = []
        for chunk_id, entry in self.data.items():
            # Apply metadata filter if exists
            if filter_metadata:
                match = True
                for k, v in filter_metadata.items():
                    if entry["metadata"].get(k) != v:
                        match = False
                        break
                if not match:
                    continue

            doc_vec = np.array(entry["vector"])
            # Normalize doc vector
            doc_norm = np.linalg.norm(doc_vec)
            if doc_norm > 0:
                doc_vec = doc_vec / doc_norm

            # Cosine similarity
            similarity = float(np.dot(q_vec, doc_vec))
            candidates.append({
                "id": chunk_id,
                "text": entry["text"],
                "metadata": entry["metadata"],
                "score": similarity
            })

        # Sort by similarity score descending
        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates[:top_n]

    def delete_by_book(self, book_id: int):
        keys_to_delete = []
        for chunk_id, entry in self.data.items():
            if entry["metadata"].get("book_id") == book_id:
                keys_to_delete.append(chunk_id)

        for k in keys_to_delete:
            self.data.pop(k, None)

        if keys_to_delete:
            self.save()
            logger.info(f"Deleted {len(keys_to_delete)} vectors associated with book {book_id}.")


# Initialize Vector Store Singleton with Try/Except Adapter
vector_store = None
try:
    vector_store = ChromaVectorStore()
except Exception as e:
    logger.warning(
        f"ChromaDB library could not be imported: {e}. "
        f"Initializing portable Numpy-based Local Vector Store."
    )
    vector_store = NumpyVectorStore()
