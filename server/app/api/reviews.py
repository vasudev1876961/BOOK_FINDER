
from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.auth_service import get_current_user
from app.core.exceptions import EntityNotFoundException
from app.database.database import get_db
from app.database.models import Book, Review
from app.schemas.review import ReviewCreate, ReviewResponse
from app.schemas.user import UserResponse
from app.services.ai.sentiment_service import review_sentiment_service

router = APIRouter(prefix="/reviews", tags=["Reviews & Ratings"])

def update_book_rating_stats(db: Session, book_id: int):
    """
    Recalculates average rating and review counts for a book.
    """
    stats = (
        db.query(
            func.avg(Review.rating).label("avg_rating"),
            func.count(Review.id).label("count")
        )
        .filter(Review.book_id == book_id)
        .first()
    )

    book = db.query(Book).filter(Book.id == book_id).first()
    if book:
        book.rating = float(round(stats.avg_rating, 2)) if stats.avg_rating else 0.0
        book.rating_count = int(stats.count) if stats.count else 0
        db.add(book)
        db.commit()

@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    review_in: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    # Check if book exists
    book = db.query(Book).filter(Book.id == review_in.book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(review_in.book_id))

    # Check if user already reviewed this book (allow updating existing review)
    existing_review = db.query(Review).filter(
        Review.user_id == current_user.id,
        Review.book_id == review_in.book_id
    ).first()

    if existing_review:
        existing_review.rating = review_in.rating
        existing_review.review_text = review_in.review_text
        existing_review.created_at = func.now()
        db_review = existing_review
    else:
        db_review = Review(
            user_id=current_user.id,
            book_id=review_in.book_id,
            rating=review_in.rating,
            review_text=review_in.review_text
        )
        db.add(db_review)

    db.commit()
    db.refresh(db_review)

    # Trigger book rating synchronization
    update_book_rating_stats(db, review_in.book_id)

    # Flatten user name into response schema
    response_item = ReviewResponse.from_orm(db_review)
    response_item.user_name = current_user.full_name or current_user.email
    return response_item

@router.get("/book/{book_id}", response_model=list[ReviewResponse])
def get_book_reviews(
    book_id: int,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    # Verify book exists
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    reviews = (
        db.query(Review)
        .filter(Review.book_id == book_id)
        .order_by(Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    formatted_reviews = []
    for r in reviews:
        item = ReviewResponse.from_orm(r)
        item.user_name = r.user.full_name or r.user.email
        formatted_reviews.append(item)

    return formatted_reviews

@router.get("/book/{book_id}/sentiment")
def get_book_reviews_ai_consensus(
    book_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns an AI synthesized summary consensus (pros, cons) of all book reviews.
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise EntityNotFoundException(entity_name="Book", entity_id=str(book_id))

    reviews = db.query(Review).filter(Review.book_id == book_id).all()
    sentiment_report = review_sentiment_service.analyze_reviews(book.title, reviews)

    return {
        "book_id": book_id,
        "sentiment_report": sentiment_report
    }
