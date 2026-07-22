from typing import Literal

from pydantic import BaseModel

from app.schemas.book import BookResponse


class SearchRequest(BaseModel):
    query: str
    search_type: Literal["keyword", "semantic", "hybrid"] = "hybrid"
    genres: list[str] | None = None
    min_rating: float | None = None
    max_pages: int | None = None
    language: str | None = None
    page: int = 1
    page_size: int = 12

class SearchResultItem(BaseModel):
    book: BookResponse
    score: float  # RRF score or similarity score

class SearchResponse(BaseModel):
    query: str
    spell_corrected_query: str | None = None
    search_type: str
    total: int
    page: int
    page_size: int
    results: list[SearchResultItem]
