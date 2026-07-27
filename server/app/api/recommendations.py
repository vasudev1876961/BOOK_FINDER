from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.orm import Session

from app.auth.auth_service import get_current_user
from app.database.database import SessionLocal, get_db
from app.database.models import Recommendation
from app.schemas.book import BookResponse
from app.schemas.recommendation import RecommendedBookResponse
from app.services.recommendations.recommender import recommendation_service
from app.services.workers.tasks import background_generate_recommendations

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/", response_model=list[RecommendedBookResponse])
def get_user_recommendations(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    # 1. Look for pre-cached recommendations in database
    cached_recs = (
        db.query(Recommendation)
        .filter(Recommendation.user_id == current_user.id)
        .order_by(Recommendation.score.desc())
        .limit(limit)
        .all()
    )

    if cached_recs:
        return [
            RecommendedBookResponse(
                book=BookResponse.from_orm(rec.book),
                score=rec.score,
                explanation=rec.explanation or "Matches your reading interests"
            ) for rec in cached_recs
        ]

    # 2. Cache miss: Compute recommendations on the fly
    from app.core.logging import logger
    logger.info(f"Recommendation cache miss for user {current_user.id}. Computing on the fly.")

    hits = recommendation_service.get_hybrid_recommendations(db, current_user.id, limit)

    # 3. Schedule background cache generation
    db_session_factory = SessionLocal
    background_generate_recommendations(db_session_factory, current_user.id)

    return [
        RecommendedBookResponse(
            book=BookResponse.from_orm(hit["book"]),
            score=hit["score"],
            explanation=hit.get("explanation", "Matches your reading interests")
        ) for hit in hits
    ]


@router.post("/recalculate", status_code=status.HTTP_202_ACCEPTED)
def recalculate_user_recommendations(
    background_tasks: BackgroundTasks,
    current_user: Any = Depends(get_current_user)
):
    """
    Trigger manual pre-computation of hybrid recommendations in the background.
    """
    background_tasks.add_task(background_generate_recommendations, SessionLocal, current_user.id)
    return {"message": "Recommendation pre-computation started in background."}
