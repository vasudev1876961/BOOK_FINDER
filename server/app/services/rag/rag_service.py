from sqlalchemy.orm import Session

from app.core.logging import logger
from app.database.models import Book
from app.database.models import Embedding as DbEmbedding
from app.services.ai.embedding_service import embedding_service
from app.services.ai.llm_provider import llm_provider
from app.services.rag.vector_store import vector_store


class RagService:
    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
        """
        Splits text recursively using paragraphs, sentences, and words to respect semantic boundaries.
        """
        if not text:
            return []

        separators = ["\n\n", "\n", " ", ""]

        def split_recursive(text_to_split: str, separators_list: list[str]) -> list[str]:
            if len(text_to_split) <= chunk_size:
                return [text_to_split]

            if not separators_list:
                return [text_to_split[i:i+chunk_size] for i in range(0, len(text_to_split), chunk_size)]

            sep = separators_list[0]
            next_seps = separators_list[1:]

            if sep == "":
                splits = list(text_to_split)
            else:
                splits = text_to_split.split(sep)

            final_splits = []
            for s in splits:
                if len(s) > chunk_size:
                    final_splits.extend(split_recursive(s, next_seps))
                else:
                    final_splits.append(s)
            return final_splits

        # 1. Get fine-grained splits
        raw_splits = split_recursive(text, separators)

        # 2. Merge small splits into overlapping chunks of max size chunk_size
        chunks = []
        current_chunk = []
        current_length = 0

        for s in raw_splits:
            if not s.strip():
                continue
            if current_length + len(s) > chunk_size and current_chunk:
                merged = " ".join(current_chunk).strip()
                if merged:
                    chunks.append(merged)

                # Keep items from the end of current_chunk that total up to the overlap length
                overlap_items = []
                overlap_len = 0
                for item in reversed(current_chunk):
                    if overlap_len + len(item) <= overlap:
                        overlap_items.insert(0, item)
                        overlap_len += len(item)
                    else:
                        break
                current_chunk = overlap_items
                current_length = sum(len(x) for x in current_chunk) + len(current_chunk)

            current_chunk.append(s)
            current_length += len(s) + 1

        if current_chunk:
            merged = " ".join(current_chunk).strip()
            if merged:
                chunks.append(merged)

        return chunks


    def index_book(self, db: Session, book: Book):
        """
        Chunks and indexes a book's description into the vector store.
        """
        if not book.description:
            logger.info(f"Skipping indexing for book '{book.title}' due to empty description.")
            return

        logger.info(f"Indexing book: '{book.title}' (ID: {book.id})...")

        # 1. Clean existing index for this book if any
        self.clear_book_index(db, book.id)

        # 2. Chunk text
        chunks = self.chunk_text(book.description)
        if not chunks:
            return

        # 3. Generate embeddings
        embeddings = embedding_service.get_embeddings(chunks)

        # 4. Prepare batch datasets for Vector Store
        vector_ids = [f"book_{book.id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"book_id": book.id, "chunk_index": i, "title": book.title} for i in range(len(chunks))]

        # Save to Vector Store
        vector_store.add_chunks(
            ids=vector_ids,
            vectors=embeddings,
            texts=chunks,
            metadatas=metadatas
        )

        # 5. Save metadata link to local SQLite DB
        for idx, chunk in enumerate(chunks):
            db_emb = DbEmbedding(
                book_id=book.id,
                chunk_index=idx,
                chunk_text=chunk,
                vector_id=vector_ids[idx]
            )
            db.add(db_emb)

        db.commit()
        logger.info(f"Successfully indexed '{book.title}' into Vector Store with {len(chunks)} chunks.")

    def clear_book_index(self, db: Session, book_id: int):
        """
        Removes vector index elements and SQL references for a book.
        """
        # Delete from vector store
        vector_store.delete_by_book(book_id)

        # Delete from SQL Db
        db.query(DbEmbedding).filter(DbEmbedding.book_id == book_id).delete()
        db.commit()

    def chat_with_book(self, db: Session, book: Book, question: str) -> str:
        """
        Retrieves matching book chunks and queries LLM to answer questions.
        """
        # 1. Get query embedding
        query_vector = embedding_service.get_embedding(question)

        # 2. Query vector database restricted to this book
        filter_meta = {"book_id": book.id}
        chunk_hits = vector_store.query(query_vector, top_n=3, filter_metadata=filter_meta)

        if not chunk_hits:
            # Fall back to book description directly if no chunks found
            context = book.description or "No description available."
        else:
            # Join matching texts
            context = "\n\n---\n\n".join([hit["text"] for hit in chunk_hits])

        # 3. Build Prompt
        system_prompt = (
            f"You are the virtual 'AI Librarian' for the book '{book.title}' by {book.author.name if book.author else 'Unknown'}. "
            "Use only the provided passages (context) from the book to answer the reader's question. "
            "If the answer cannot be found in the context, use your general knowledge of the book to formulate a polite, "
            "helpful response, but explicitly state that you are supplementing the context with general knowledge."
        )

        prompt = (
            f"Reader's Question: {question}\n\n"
            f"Book Reference Passages:\n{context}\n\n"
            "Formulate a detailed, structured response for the reader using Markdown formatting."
        )

        try:
            logger.info(f"RAG query for book '{book.title}': {question[:50]}...")
            answer = llm_provider.generate_text(prompt, system_prompt)
            return answer
        except Exception as e:
            logger.error(f"Failed to perform RAG chat for '{book.title}': {e}")
            return "Failed to get AI response. Please check LLM provider logs."

    def chat_with_library(self, db: Session, question: str) -> str:
        """
        Retrieves matching chunks across the entire library catalog and queries LLM to answer questions.
        """
        query_vector = embedding_service.get_embedding(question)
        chunk_hits = vector_store.query(query_vector, top_n=5)

        if not chunk_hits:
            books = db.query(Book).limit(3).all()
            context = "\n\n---\n\n".join([f"Book: '{b.title}' - {b.description or 'No description'}" for b in books])
        else:
            passages = []
            for hit in chunk_hits:
                title = hit["metadata"].get("title", "Unknown Book")
                passages.append(f"Book: '{title}'\nPassage: {hit['text']}")
            context = "\n\n---\n\n".join(passages)

        system_prompt = (
            "You are the virtual 'AI Librarian' for Aetheria. "
            "Use the provided book reference passages (context) from our library catalog to answer the reader's question. "
            "If the answer cannot be fully resolved from the passages, use your general literary knowledge to assist the reader, "
            "but make sure to mention which books you are referencing."
        )

        prompt = (
            f"Reader's Question: {question}\n\n"
            f"Library Reference Passages:\n{context}\n\n"
            "Formulate a friendly, detailed response for the reader using Markdown formatting."
        )

        try:
            logger.info(f"Global RAG library query: {question[:50]}...")
            return llm_provider.generate_text(prompt, system_prompt)
        except Exception as e:
            logger.error(f"Failed to perform global library RAG chat: {e}")
            return "Failed to get AI response. Please check LLM provider logs."

# Singleton instance
rag_service = RagService()
