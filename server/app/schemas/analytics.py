
from pydantic import BaseModel


class GenreCount(BaseModel):
    genre: str
    count: int

class MonthlyReadCount(BaseModel):
    month: str  # e.g., 'Jan', 'Feb'
    count: int

class StreakResponse(BaseModel):
    current_streak: int
    longest_streak: int
    last_activity_date: str

class UserAnalyticsResponse(BaseModel):
    total_books_read: int
    total_pages_read: int
    average_rating: float
    genre_distribution: list[GenreCount]
    monthly_activity: list[MonthlyReadCount]
    reading_streak: StreakResponse
