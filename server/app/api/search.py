from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.auth.auth_service import get_optional_current_user
from app.database.database import SessionLocal, get_db
from app.database.models import SearchHistory
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

    # Execute search pipeline ( spell-correction -> BM25 + Semantic -> RRF -> filters )
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
