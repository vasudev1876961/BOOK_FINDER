import csv
import io
import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import StreamingResponse
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
    current_user: UserResponse = Depends(get_current_user),
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
    current_user: UserResponse = Depends(get_current_user),
):
    # Verify book exists
    book = db.query(Book).filter(Book.id == shelf_in.book_id).first()
    if not book:
        raise EntityNotFoundException(
            entity_name="Book", entity_id=str(shelf_in.book_id)
        )

    # Look for existing record
    shelf = (
        db.query(ReadingList)
        .filter(
            ReadingList.user_id == current_user.id,
            ReadingList.book_id == shelf_in.book_id,
        )
        .first()
    )

    now = datetime.now(UTC)
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
            completed_at=completed_time,
        )
        db.add(shelf)

    db.commit()
    db.refresh(shelf)
    return shelf


@router.get("/export")
def export_user_reading_list(
    export_format: str = Query("csv", alias="format"),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Export current user's reading list to CSV or JSON format.
    """
    shelves = (
        db.query(ReadingList)
        .filter(ReadingList.user_id == current_user.id)
        .all()
    )

    if export_format.lower() == "json":
        data = [
            {
                "title": s.book.title if s.book else "Unknown",
                "author": s.book.author.name if s.book and s.book.author else "Unknown",
                "status": s.status,
                "rating": s.book.rating if s.book else None,
                "pages": s.book.pages if s.book else None,
                "isbn": s.book.isbn if s.book else None,
                "genres": [g.name for g in s.book.genres] if s.book and s.book.genres else [],
                "added_at": s.added_at.isoformat() if s.added_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in shelves
        ]
        json_str = json.dumps(data, indent=2)
        return StreamingResponse(
            io.BytesIO(json_str.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="aetheria_reading_list.json"'},
        )
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Title", "Author", "Status", "Rating", "Pages", "ISBN", "Genres", "Added At", "Completed At"])
        for s in shelves:
            genres_str = ", ".join([g.name for g in s.book.genres]) if s.book and s.book.genres else ""
            writer.writerow([
                s.book.title if s.book else "",
                s.book.author.name if s.book and s.book.author else "",
                s.status,
                s.book.rating if s.book else "",
                s.book.pages if s.book else "",
                s.book.isbn if s.book else "",
                genres_str,
                s.added_at.strftime("%Y-%m-%d %H:%M:%S") if s.added_at else "",
                s.completed_at.strftime("%Y-%m-%d %H:%M:%S") if s.completed_at else "",
            ])
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="aetheria_reading_list.csv"'},
        )


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_reading_list(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    shelf = (
        db.query(ReadingList)
        .filter(ReadingList.user_id == current_user.id, ReadingList.book_id == book_id)
        .first()
    )

    if not shelf:
        raise EntityNotFoundException(
            entity_name="Reading List Entry", entity_id=str(book_id)
        )

    db.delete(shelf)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- FAVORITES ENDPOINTS ---


@router.post("/{book_id}/favorite", status_code=status.HTTP_200_OK)
def toggle_favorite(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    fav = (
        db.query(Favorite)
        .filter(Favorite.user_id == current_user.id, Favorite.book_id == book_id)
        .first()
    )

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
    current_user: UserResponse = Depends(get_current_user),
):
    favs = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    books = [f.book for f in favs]
    return books
