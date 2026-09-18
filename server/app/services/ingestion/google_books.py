import re

import httpx
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core.exceptions import DuplicateEntityException
from app.core.logging import logger
from app.database.database import SessionLocal
from app.database.models import Author, Book, Genre, Publisher
from app.schemas.ingestion import GoogleBookIngestRequest, GoogleBookSearchResult
from app.services.cache.cache_service import cache_service
from app.services.workers.tasks import (
    background_index_book,
    background_rebuild_vocabulary,
)


class GoogleBooksService:
    GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"

    @staticmethod
    def clean_isbn(isbn_raw: str | None) -> str | None:
        if not isbn_raw:
            return None
        # Strip dashes, spaces, and non-alphanumeric characters
        cleaned = re.sub(r"[^0-9X]", "", isbn_raw.strip().upper())
        return cleaned if len(cleaned) in (10, 13) else None

    @staticmethod
    def clean_text(text: str | None) -> str:
        if not text:
            return ""
        # Remove HTML tags if present in description
        clean = re.sub(r"<[^>]+>", " ", text)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean

    def search_google_books(
        self, query: str, db: Session, limit: int = 10
    ) -> list[GoogleBookSearchResult]:
        if not query or not query.strip():
            return []

        query_clean = query.strip()
        params = {
            "q": query_clean,
            "maxResults": min(max(limit, 1), 20),
            "printType": "books",
        }

        try:
            with httpx.Client(timeout=8.0) as client:
                resp = client.get(self.GOOGLE_BOOKS_API_URL, params=params)
                if resp.status_code != 200:
                    logger.warning(
                        f"Google Books API returned status {resp.status_code} for query '{query_clean}'"
                    )
                    return []
                data = resp.json()
        except Exception as e:
            logger.error(f"Error querying Google Books API for '{query_clean}': {e}")
            return []

        items = data.get("items", [])
        results: list[GoogleBookSearchResult] = []

        for item in items:
            volume_id = item.get("id", "")
            vol_info = item.get("volumeInfo", {})

            title = vol_info.get("title", "Untitled").strip()
            authors = vol_info.get("authors", [])
            publisher = vol_info.get("publisher")
            pub_date = vol_info.get("publishedDate")
            raw_desc = vol_info.get("description", "")
            desc = self.clean_text(raw_desc)
            pages = vol_info.get("pageCount")
            categories = vol_info.get("categories", [])
            lang = vol_info.get("language", "en")

            # Extract ISBN
            identifiers = vol_info.get("industryIdentifiers", [])
            extracted_isbn = None
            # Prefer ISBN-13 over ISBN-10
            for ident in identifiers:
                itype = ident.get("type", "")
                ival = ident.get("identifier", "")
                clean_val = self.clean_isbn(ival)
                if itype == "ISBN_13" and clean_val:
                    extracted_isbn = clean_val
                    break
                elif itype == "ISBN_10" and clean_val and not extracted_isbn:
                    extracted_isbn = clean_val

            # Cover URL
            img_links = vol_info.get("imageLinks", {})
            cover_url = img_links.get("thumbnail") or img_links.get("smallThumbnail")
            if cover_url and cover_url.startswith("http://"):
                cover_url = "https://" + cover_url[7:]

            # Check if book already exists in local DB
            already_exists = False
            if extracted_isbn:
                existing_isbn = (
                    db.query(Book).filter(Book.isbn == extracted_isbn).first()
                )
                if existing_isbn:
                    already_exists = True

            if not already_exists and title:
                # Secondary check by title and first author
                first_author = authors[0].strip() if authors else ""
                q_book = db.query(Book).filter(Book.title.ilike(title))
                if first_author:
                    q_book = q_book.join(Book.author).filter(
                        Author.name.ilike(first_author)
                    )
                if q_book.first():
                    already_exists = True

            results.append(
                GoogleBookSearchResult(
                    id=volume_id,
                    title=title,
                    authors=authors,
                    publisher=publisher,
                    published_date=pub_date,
                    description=desc,
                    isbn=extracted_isbn,
                    pages=pages,
                    cover_url=cover_url,
                    language=lang,
                    categories=categories,
                    already_exists=already_exists,
                )
            )

        return results

    def ingest_book(
        self,
        req: GoogleBookIngestRequest,
        db: Session,
        background_tasks: BackgroundTasks,
    ) -> Book:
        clean_isbn_val = self.clean_isbn(req.isbn)
        clean_title_val = req.title.strip()

        # 1. Deduplication check by ISBN
        if clean_isbn_val:
            existing_isbn = db.query(Book).filter(Book.isbn == clean_isbn_val).first()
            if existing_isbn:
                raise DuplicateEntityException("Book (ISBN)", clean_isbn_val)

        # 2. Deduplication check by Title + Author
        if req.author_name:
            existing_title_author = (
                db.query(Book)
                .join(Book.author)
                .filter(
                    Book.title.ilike(clean_title_val),
                    Author.name.ilike(req.author_name.strip()),
                )
                .first()
            )
            if existing_title_author:
                raise DuplicateEntityException(
                    "Book (Title & Author)", f"{clean_title_val} by {req.author_name}"
                )

        # 3. Resolve Author
        author_obj = None
        if req.author_name and req.author_name.strip():
            author_clean = req.author_name.strip()
            author_obj = (
                db.query(Author).filter(Author.name.ilike(author_clean)).first()
            )
            if not author_obj:
                author_obj = Author(name=author_clean)
                db.add(author_obj)
                db.flush()

        # 4. Resolve Publisher
        publisher_obj = None
        if req.publisher_name and req.publisher_name.strip():
            pub_clean = req.publisher_name.strip()
            publisher_obj = (
                db.query(Publisher).filter(Publisher.name.ilike(pub_clean)).first()
            )
            if not publisher_obj:
                publisher_obj = Publisher(name=pub_clean)
                db.add(publisher_obj)
                db.flush()

        # 5. Resolve Genres
        genre_objects = []
        for g_name in req.genres:
            cleaned_g = g_name.strip()
            if not cleaned_g:
                continue
            genre_obj = db.query(Genre).filter(Genre.name.ilike(cleaned_g)).first()
            if not genre_obj:
                genre_obj = Genre(name=cleaned_g)
                db.add(genre_obj)
                db.flush()
            genre_objects.append(genre_obj)

        # 6. Create Book
        book = Book(
            title=clean_title_val,
            description=req.description.strip() if req.description else None,
            isbn=clean_isbn_val,
            pub_date=req.pub_date,
            pages=req.pages,
            cover_url=req.cover_url,
            language=req.language or "English",
            author=author_obj,
            publisher=publisher_obj,
            genres=genre_objects,
        )

        db.add(book)
        db.commit()
        db.refresh(book)

        # 7. Invalidate books cache
        cache_service.delete_pattern("book:*")

        # 8. Trigger background worker to chunk description, embed in vector DB, and rebuild search vocab
        background_tasks.add_task(background_index_book, SessionLocal, book.id)
        background_tasks.add_task(background_rebuild_vocabulary, SessionLocal)

        logger.info(
            f"Successfully ingested book: '{book.title}' (ID: {book.id}, ISBN: {book.isbn}) via Google Books pipeline"
        )
        return book


google_books_service = GoogleBooksService()
