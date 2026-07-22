from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.book import BookResponse


class ReadingListBase(BaseModel):
    status: Literal["want_to_read", "reading", "completed"]

class ReadingListCreate(ReadingListBase):
    book_id: int

class ReadingListUpdate(BaseModel):
    status: Literal["want_to_read", "reading", "completed"]

class ReadingListResponse(ReadingListBase):
    id: int
    user_id: int
    book_id: int
    added_at: datetime
    completed_at: datetime | None = None
    book: BookResponse | None = None

    model_config = ConfigDict(from_attributes=True)
