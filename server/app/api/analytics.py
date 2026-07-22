from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.auth_service import get_current_user
from app.database.database import get_db
from app.database.models import ReadingList, Review
from app.schemas.analytics import (
    GenreCount,
    MonthlyReadCount,
    StreakResponse,
    UserAnalyticsResponse,
)
from app.schemas.user import UserResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/", response_model=UserAnalyticsResponse)
def get_user_reading_analytics(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    # 1. Total books completed
    completed_shelves = (
        db.query(ReadingList)
        .filter(ReadingList.user_id == current_user.id, ReadingList.status == "completed")
        .all()
    )
    total_books = len(completed_shelves)

    # 2. Total pages read
    total_pages = sum([shelf.book.pages for shelf in completed_shelves if shelf.book and shelf.book.pages]) or 0

    # 3. Average rating given by user
    avg_rating_row = (
        db.query(func.avg(Review.rating))
        .filter(Review.user_id == current_user.id)
        .first()
    )
    average_rating = float(round(avg_rating_row[0], 2)) if avg_rating_row and avg_rating_row[0] else 0.0

    # 4. Genre distribution
    # We load genres of all completed books and group them in Python
    genre_counts: dict[str, int] = {}
    for shelf in completed_shelves:
        if shelf.book and shelf.book.genres:
            for g in shelf.book.genres:
                genre_counts[g.name] = genre_counts.get(g.name, 0) + 1

    genre_distribution = [
        GenreCount(genre=name, count=count)
        for name, count in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    # 5. Monthly reading activity (over past 6 months)
    # Group completed_at dates by month
    months_labels = []
    now = datetime.utcnow()
    for i in range(5, -1, -1):
        # Generate past 6 months labels e.g. "Jan", "Feb"
        past_date = now - timedelta(days=i * 30)
        months_labels.append(past_date.strftime("%b"))

    monthly_counts = dict.fromkeys(months_labels, 0)
    for shelf in completed_shelves:
        if shelf.completed_at:
            month_name = shelf.completed_at.strftime("%b")
            if month_name in monthly_counts:
                monthly_counts[month_name] += 1

    monthly_activity = [
        MonthlyReadCount(month=m, count=count)
        for m, count in monthly_counts.items()
    ]

    # 6. Reading streak logic
    completion_dates = sorted(
        {shelf.completed_at.date() for shelf in completed_shelves if shelf.completed_at}
    )

    current_streak = 0
    longest_streak = 0
    last_active = "Never"

    if completion_dates:
        last_active = completion_dates[-1].strftime("%Y-%m-%d")

        # Calculate streaks
        temp_streak = 1
        longest_streak = 1

        for i in range(1, len(completion_dates)):
            diff = completion_dates[i] - completion_dates[i-1]
            if diff.days == 1:
                temp_streak += 1
            elif diff.days > 1:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1

        longest_streak = max(longest_streak, temp_streak)

        # Check if current streak is active (last completed book was today or yesterday)
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)

        if completion_dates[-1] in (today, yesterday):
            # Current streak is the size of the last contiguous block
            current_streak = 1
            idx = len(completion_dates) - 1
            while idx > 0 and (completion_dates[idx] - completion_dates[idx-1]).days == 1:
                current_streak += 1
                idx -= 1
        else:
            current_streak = 0

    streak_response = StreakResponse(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_activity_date=last_active
    )

    return UserAnalyticsResponse(
        total_books_read=total_books,
        total_pages_read=total_pages,
        average_rating=average_rating,
        genre_distribution=genre_distribution,
        monthly_activity=monthly_activity,
        reading_streak=streak_response
    )
