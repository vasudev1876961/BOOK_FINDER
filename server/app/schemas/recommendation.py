from pydantic import BaseModel

from app.schemas.book import BookResponse


class RecommendedBookResponse(BaseModel):
    book: BookResponse
    score: float
    explanation: str

    class Config:
        from_attributes = True
