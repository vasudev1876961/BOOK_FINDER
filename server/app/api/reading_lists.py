from datetime import datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.auth.auth_service import get_current_user
from app.core.exceptions import EntityNotFoundException
from app.database.database import get_db
from app.database.models import Book, Favorite, ReadingList
from app.schemas.book import BookResponse
from app.schemas.reading_list import (
    ReadingListCreate,
    ReadingListResponse,
)
from app.schemas.user import UserResponse

router = APIRouter(prefix="/reading-lists", tags=["Reading Lists & Favorites"])

@router.get("/", response_model=list[ReadingListResponse])
def get_user_reading_list(
    status: str | None = None,  # 'want_to_read', 'reading', 'completed'
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    query = db.query(ReadingList).filter(ReadingList.user_id == current_user.id)
    if status:
        query = query.filter(ReadingList.status == status)

    shelves = query.all()
    return shelves

@router.post("/", response_model=ReadingListResponse)
def add_or_update_reading_shelf(
    shelf_in: ReadingListCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    # Verify book exists
    book = db.query(Book).filter(Book.id == shelf_in.book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(shelf_in.book_id))

    # Look for existing record
    shelf = db.query(ReadingList).filter(
        ReadingList.user_id == current_user.id,
        ReadingList.book_id == shelf_in.book_id
    ).first()

    now = datetime.utcnow()
    completed_time = now if shelf_in.status == "completed" else None

    if shelf:
        # Update existing status
        # If transitioning to completed, set completed_at
        if shelf_in.status == "completed" and shelf.status != "completed":
            shelf.completed_at = now
        elif shelf_in.status != "completed":
            shelf.completed_at = None

        shelf.status = shelf_in.status
    else:
        # Create new shelf item
        shelf = ReadingList(
            user_id=current_user.id,
            book_id=shelf_in.book_id,
            status=shelf_in.status,
            added_at=now,
            completed_at=completed_time
        )
        db.add(shelf)

    db.commit()
    db.refresh(shelf)
    return shelf

@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_reading_list(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    shelf = db.query(ReadingList).filter(
        ReadingList.user_id == current_user.id,
        ReadingList.book_id == book_id
    ).first()

    if not shelf:
        raise EntityNotFoundException(entity_name="Reading List Entry", entity_id=str(book_id))

    db.delete(shelf)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- FAVORITES ENDPOINTS ---

@router.post("/{book_id}/favorite", status_code=status.HTTP_200_OK)
def toggle_favorite(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    fav = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.book_id == book_id
    ).first()

    if fav:
        db.delete(fav)
        db.commit()
        return {"book_id": book_id, "favorited": False}
    else:
        fav = Favorite(user_id=current_user.id, book_id=book_id)
        db.add(fav)
        db.commit()
        return {"book_id": book_id, "favorited": True}

@router.get("/favorites", response_model=list[BookResponse])
def get_user_favorites(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    favs = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    books = [f.book for f in favs]
    return books
