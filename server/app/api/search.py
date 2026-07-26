from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.auth_service import get_current_user, get_optional_current_user
from app.database.database import SessionLocal, get_db
from app.database.models import Author, Book, Genre, SearchHistory
from app.schemas.book import BookResponse
from app.schemas.search import SearchRequest, SearchResponse, SearchResultItem
from app.services.search.search_pipeline import search_pipeline

router = APIRouter(prefix="/search", tags=["Search"])


def log_search_query(db_session_factory, user_id: int | None, query: str):
    """
    Log user queries for search analytics and spellcheck training.
    """
    db = db_session_factory()
    try:
        log_item = SearchHistory(
            user_id=user_id,
            query=query,
            timestamp=datetime.utcnow()
        )
        db.add(log_item)
        db.commit()
    except Exception as e:
        import traceback
        print(f"Error logging search query: {e}")
        traceback.print_exc()
    finally:
        db.close()


@router.post("/", response_model=SearchResponse)
def execute_search(
    request: SearchRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Any | None = Depends(get_optional_current_user)
):
    # Execute search pipeline (spell-correction -> BM25 + Semantic -> RRF -> filters)
    search_hits = search_pipeline.search(
        db=db,
        query=request.query,
        search_type=request.search_type,
        genres_filter=request.genres,
        min_rating=request.min_rating,
        max_pages=request.max_pages,
        language_filter=request.language
    )

    # 1. Log query to search history table in the background
    user_id = current_user.id if current_user else None
    background_tasks.add_task(log_search_query, SessionLocal, user_id, request.query)

    # 2. Paginate results
    total = len(search_hits)
    start_idx = (request.page - 1) * request.page_size
    end_idx = start_idx + request.page_size
    paginated_hits = search_hits[start_idx:end_idx]

    # 3. Format response items
    formatted_results = []
    for hit in paginated_hits:
        formatted_results.append(
            SearchResultItem(
                book=BookResponse.from_orm(hit["book"]),
                score=hit["score"]
            )
        )

    # Detect if query was spellcorrected
    spell_corrected = search_pipeline.spell_correct_query(request.query)

    return SearchResponse(
        query=request.query,
        spell_corrected_query=spell_corrected,
        search_type=request.search_type,
        total=total,
        page=request.page,
        page_size=request.page_size,
        results=formatted_results
    )


@router.get("/autocomplete")
def get_autocomplete(
    q: str,
    db: Session = Depends(get_db)
):
    """
    Get autocomplete search suggestions matching titles, author names, or genres.
    """
    if not q or len(q) < 2:
        return []

    # Search title, author names, and genres
    title_matches = db.query(Book.title).filter(Book.title.ilike(f"%{q}%")).limit(5).all()
    author_matches = db.query(Author.name).join(Book).filter(Author.name.ilike(f"%{q}%")).distinct().limit(3).all()
    genre_matches = db.query(Genre.name).filter(Genre.name.ilike(f"%{q}%")).limit(3).all()

    results = []
    for (t,) in title_matches:
        results.append(t)
    for (n,) in author_matches:
        results.append(f"by {n}")
    for (g,) in genre_matches:
        results.append(g)

    return list(set(results))[:8]


@router.get("/history")
def get_history(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Retrieve search history for the authenticated user.
    """
    history = db.query(SearchHistory.query)\
                .filter(SearchHistory.user_id == current_user.id)\
                .order_by(SearchHistory.timestamp.desc())\
                .limit(10).all()

    seen = set()
    unique_history = []
    for (q,) in history:
        if q not in seen:
            seen.add(q)
            unique_history.append(q)
    return unique_history[:5]


@router.get("/trending")
def get_trending(
    db: Session = Depends(get_db)
):
    """
    Retrieve trending search queries compiled from all searches in the last 24 hours.
    """
    cutoff = datetime.utcnow() - timedelta(hours=24)
    trending = db.query(SearchHistory.query, func.count(SearchHistory.query).label("cnt"))\
                 .filter(SearchHistory.timestamp >= cutoff)\
                 .group_by(SearchHistory.query)\
                 .order_by(func.count(SearchHistory.query).desc())\
                 .limit(8).all()

    results = [q for (q, _) in trending]

    # Cold-start fallback seeds
    if len(results) < 3:
        fallbacks = ["Atomic Habits", "Deep Work", "Clean Code", "Focus", "Success", "Productivity"]
        for f in fallbacks:
            if f not in results:
                results.append(f)

    return results[:5]
