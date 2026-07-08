from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import ScoreLog
from services.db_service import ensure_user_exists
from services.score_service import calculate_score
from services.ai_service import generate_daily_insight
from datetime import date

router = APIRouter()

@router.post("/score")
async def get_score(data: dict, db: Session = Depends(get_db)):
    score = calculate_score(
        data.get("workout"),
        data.get("food"),
        data.get("activity")
    )
    user_id = data.get("user_id")
    if user_id:
        ensure_user_exists(db, user_id)
        # Check if score log for today exists, update if true, else create new
        score_log = db.query(ScoreLog).filter(
            ScoreLog.user_id == user_id,
            ScoreLog.date == date.today()
        ).first()
        if score_log:
            score_log.score = score
        else:
            score_log = ScoreLog(user_id=user_id, score=score, date=date.today())
            db.add(score_log)
        db.commit()

    return {"score": score}

@router.post("/insight")
async def get_insight(data: dict, db: Session = Depends(get_db)):
    score = data.get("score")
    user_id = data.get("user_id")

    if score is None:
        score = calculate_score(
            data.get("workout"),
            data.get("food"),
            data.get("activity")
        )
        data["score"] = score

    if user_id:
        ensure_user_exists(db, user_id)
        score_log = db.query(ScoreLog).filter(
            ScoreLog.user_id == user_id,
            ScoreLog.date == date.today()
        ).first()
        if score_log:
            score_log.score = score
        else:
            score_log = ScoreLog(user_id=user_id, score=score, date=date.today())
            db.add(score_log)
        db.commit()

    insight = generate_daily_insight(data)
    return {"insight": insight}
