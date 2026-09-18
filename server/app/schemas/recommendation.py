from pydantic import BaseModel, ConfigDict

from app.schemas.book import BookResponse


class RecommendedBookResponse(BaseModel):
    book: BookResponse
    score: float
    explanation: str

    model_config = ConfigDict(from_attributes=True)
