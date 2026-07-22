from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewBase(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    review_text: str | None = None

class ReviewCreate(ReviewBase):
    book_id: int

class ReviewResponse(ReviewBase):
    id: int
    user_id: int
    book_id: int
    created_at: datetime
    user_name: str | None = None  # Flatten user's name for ease of consumption in frontend

    model_config = ConfigDict(from_attributes=True)
