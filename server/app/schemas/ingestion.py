from pydantic import BaseModel, Field


class GoogleBookSearchResult(BaseModel):
    id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    publisher: str | None = None
    published_date: str | None = None
    description: str | None = None
    isbn: str | None = None
    pages: int | None = None
    cover_url: str | None = None
    language: str = "en"
    categories: list[str] = Field(default_factory=list)
    already_exists: bool = False


class GoogleBookIngestRequest(BaseModel):
    title: str
    author_name: str | None = None
    publisher_name: str | None = None
    description: str | None = None
    isbn: str | None = None
    pub_date: str | None = None
    pages: int | None = None
    cover_url: str | None = None
    language: str = "English"
    genres: list[str] = Field(default_factory=list)
