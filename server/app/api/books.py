
from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.auth.auth_service import get_current_admin, get_current_user
from app.core.exceptions import EntityNotFoundException
from app.database.database import SessionLocal, get_db
from app.database.models import Author, Book, Genre, Publisher
from app.schemas.book import BookCreate, BookResponse, BookUpdate
from app.schemas.user import UserResponse
from app.services.ai.comparison_service import book_comparison_service
from app.services.ai.summarizer import book_summarizer
from app.services.cache.cache_service import cache_service
from app.services.rag.rag_service import rag_service
from app.services.workers.tasks import (
    background_index_book,
    background_rebuild_vocabulary,
)

router = APIRouter(prefix="/books", tags=["Books"])

@router.get("/", response_model=list[BookResponse])
def list_books(
    skip: int = 0,
    limit: int = 12,
    db: Session = Depends(get_db)
):
    books = db.query(Book).offset(skip).limit(limit).all()
    return books

@router.post("/", response_model=BookResponse, status_code=status.HTTP_201_CREATED)
def create_book(
    book_in: BookCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_admin)  # Guarded: Admin only
):
    # 1. Author Lookup or Creation
    author = None
    if book_in.author_name:
        author = db.query(Author).filter(Author.name == book_in.author_name).first()
        if not author:
            author = Author(name=book_in.author_name)
            db.add(author)
            db.flush()

    # 2. Publisher Lookup or Creation
    publisher = None
    if book_in.publisher_name:
        publisher = db.query(Publisher).filter(Publisher.name == book_in.publisher_name).first()
        if not publisher:
            publisher = Publisher(name=book_in.publisher_name)
            db.add(publisher)
            db.flush()

    # 3. Genres Lookup or Creation
    genre_objects = []
    for g_name in book_in.genres:
        genre = db.query(Genre).filter(Genre.name == g_name).first()
        if not genre:
            genre = Genre(name=g_name)
            db.add(genre)
            db.flush()
        genre_objects.append(genre)

    # 4. Create Book
    db_book = Book(
        title=book_in.title,
        description=book_in.description,
        isbn=book_in.isbn,
        pub_date=book_in.pub_date,
        pages=book_in.pages,
        cover_url=book_in.cover_url,
        language=book_in.language,
        author=author,
        publisher=publisher,
        genres=genre_objects
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)

    # 5. Add background task to chunk and index book embedding, and rebuild search vocab
    background_tasks.add_task(background_index_book, SessionLocal, db_book.id)
    background_tasks.add_task(background_rebuild_vocabulary, SessionLocal)

    return db_book

@router.get("/{book_id}", response_model=BookResponse)
def get_book(book_id: int, db: Session = Depends(get_db)):
    cache_key = f"book:detail:{book_id}"
    cached = cache_service.get(cache_key)
    if cached:
        return cached

    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    serialized = BookResponse.model_validate(book).model_dump(mode="json")
    cache_service.set(cache_key, serialized, expire_seconds=3600)
    return book

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(
    book_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_admin)  # Guarded: Admin only
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    # Clean up vector database index in background or sync
    rag_service.clear_book_index(db, book_id)

    db.delete(book)
    db.commit()

    # Invalidate cache
    cache_service.delete(f"book:detail:{book_id}")

    # Rebuild search vocabulary in background
    background_tasks.add_task(background_rebuild_vocabulary, SessionLocal)
    return None

@router.put("/{book_id}", response_model=BookResponse)
def update_book(
    book_id: int,
    book_in: BookUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_admin)
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    update_data = book_in.model_dump(exclude_unset=True)

    # 1. Update basic fields
    for field in ["title", "description", "isbn", "pub_date", "pages", "cover_url", "language"]:
        if field in update_data:
            setattr(book, field, update_data[field])

    # 2. Update author relationship
    if "author_id" in update_data:
        author = db.query(Author).filter(Author.id == update_data["author_id"]).first()
        if author:
            book.author = author

    # 3. Update publisher relationship
    if "publisher_id" in update_data:
        publisher = db.query(Publisher).filter(Publisher.id == update_data["publisher_id"]).first()
        if publisher:
            book.publisher = publisher

    # 4. Update genres relationship
    if "genres" in update_data and update_data["genres"] is not None:
        genre_objects = []
        for g_name in update_data["genres"]:
            genre = db.query(Genre).filter(Genre.name == g_name).first()
            if not genre:
                genre = Genre(name=g_name)
                db.add(genre)
                db.flush()
            genre_objects.append(genre)
        book.genres = genre_objects

    db.commit()
    db.refresh(book)

    # Invalidate cache
    cache_service.delete(f"book:detail:{book.id}")

    # 5. If description changed, clear old index and re-index book chunks in background
    if "description" in update_data:
        rag_service.clear_book_index(db, book.id)
        background_tasks.add_task(background_index_book, SessionLocal, book.id)

    # Rebuild search vocabulary in background
    background_tasks.add_task(background_rebuild_vocabulary, SessionLocal)

    return book

@router.get("/{book_id}/ai-summary")
def get_book_ai_summary(book_id: int, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    summary = book_summarizer.generate_summary(book)
    return {"book_id": book_id, "summary": summary}

@router.post("/compare")
def compare_books(
    book_id_a: int,
    book_id_b: int,
    db: Session = Depends(get_db)
):
    book_a = db.query(Book).filter(Book.id == book_id_a).first()
    book_b = db.query(Book).filter(Book.id == book_id_b).first()
    if not book_a or not book_b:
        missing = []
        if not book_a:
            missing.append(f"Book A ({book_id_a})")
        if not book_b:
            missing.append(f"Book B ({book_id_b})")
        raise EntityNotFoundException(entity_name="Book Comparison Target", entity_id=", ".join(missing))

    comparison = book_comparison_service.compare_books(book_a, book_b)
    return {
        "book_a_id": book_id_a,
        "book_b_id": book_id_b,
        "comparison": comparison
    }

@router.post("/{book_id}/chat")
def chat_with_book(
    book_id: int,
    question: str,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    answer = rag_service.chat_with_book(db, book, question)
    return {
        "book_id": book_id,
        "question": question,
        "answer": answer
    }


@router.post("/chat")
def chat_with_library(
    question: str,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    answer = rag_service.chat_with_library(db, question)
    return {
        "question": question,
        "answer": answer
    }
