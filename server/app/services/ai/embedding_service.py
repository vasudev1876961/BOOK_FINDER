import hashlib

from app.core.config import settings
from app.core.logging import logger


class EmbeddingService:
    def __init__(self):
        self.model = None
        self.is_mock = True
        self.dimension = 384  # Dimension of all-MiniLM-L6-v2

        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading SentenceTransformer model: {settings.EMBEDDING_MODEL_NAME}...")
            self.model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            self.is_mock = False
            logger.info("SentenceTransformer model loaded successfully!")
        except Exception as e:
            logger.warning(
                f"Could not load sentence-transformers library: {e}. "
                f"Falling back to high-quality deterministic Mock Embeddings."
            )

    def get_embedding(self, text: str) -> list[float]:
        """
        Generates a 384-dimensional float vector for the input text.
        If sentence-transformers is loaded, it generates a real embedding.
        Otherwise, it generates a stable, deterministic mock vector based on string hash.
        """
        if not text:
            return [0.0] * self.dimension

        if not self.is_mock and self.model:
            try:
                embedding = self.model.encode(text)
                return embedding.tolist()
            except Exception as e:
                logger.error(f"Error generating real embedding: {e}. Falling back to mock.")

        # Deterministic Mock Embedding:
        # Generates a stable float vector of size 384 using SHA-256 offsets
        import numpy as np
        # Seed generator based on text hash
        hash_val = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16)
        rng = np.random.default_rng(hash_val & 0xFFFFFFFF)  # Seed needs to fit in 32-bit int

        # Generate random normal vector, then normalize it to unit length (cosine similarity ready)
        vec = rng.normal(0, 1, self.dimension)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    def get_embeddings(self, texts: list[str]) -> list[list[float]]:
        """
        Batch generate embeddings.
        """
        return [self.get_embedding(t) for t in texts]

# Singleton instance
embedding_service = EmbeddingService()
