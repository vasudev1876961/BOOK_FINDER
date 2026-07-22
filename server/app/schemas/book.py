
from pydantic import BaseModel, ConfigDict

from app.schemas.author import AuthorResponse
from app.schemas.genre import GenreResponse
from app.schemas.publisher import PublisherResponse


class BookBase(BaseModel):
    title: str
    description: str | None = None
    isbn: str | None = None
    pub_date: str | None = None
    pages: int | None = None
    cover_url: str | None = None
    language: str | None = "English"

class BookCreate(BookBase):
    author_name: str | None = None  # Autocreate author if not found
    publisher_name: str | None = None  # Autocreate publisher if not found
    genres: list[str] = []  # Names of genres, created if not exists

class BookUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    isbn: str | None = None
    pub_date: str | None = None
    pages: int | None = None
    cover_url: str | None = None
    language: str | None = None
    author_id: int | None = None
    publisher_id: int | None = None
    genres: list[str] | None = None

class BookResponse(BookBase):
    id: int
    rating: float
    rating_count: int
    author: AuthorResponse | None = None
    publisher: PublisherResponse | None = None
    genres: list[GenreResponse] = []

    model_config = ConfigDict(from_attributes=True)
