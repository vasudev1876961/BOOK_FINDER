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

    # Reading Speed & Goals
    reading_speed: float
    daily_pages_goal: int
    monthly_books_goal: int
    yearly_books_goal: int
    daily_pages_progress: int
    monthly_books_progress: int
    yearly_books_progress: int


class UpdateGoalsRequest(BaseModel):
    daily_pages_goal: int | None = None
    monthly_books_goal: int | None = None
    yearly_books_goal: int | None = None
    reading_speed: float | None = None


class LogPagesRequest(BaseModel):
    pages: int
