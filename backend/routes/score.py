from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from db.session import get_db
from db.models import ScoreLog, Workout, FoodLog, ActivityLog
from services.db_service import ensure_user_exists
from services.score_service import calculate_score
from services.ai_service import generate_daily_insight
from datetime import date

router = APIRouter()

class ResetRequest(BaseModel):
    user_id: str

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

@router.get("/score/{user_id}")
def get_today_score(user_id: str, db: Session = Depends(get_db)):
    today = date.today()
    ensure_user_exists(db, user_id)
    score_log = db.query(ScoreLog).filter(
        ScoreLog.user_id == user_id,
        ScoreLog.date == today
    ).first()
    return {"score": score_log.score if score_log else 0}

@router.get("/score")
def get_today_score_query(user_id: str, db: Session = Depends(get_db)):
    return get_today_score(user_id, db)

@router.get("/progress/{user_id}")
def get_today_progress(user_id: str, db: Session = Depends(get_db)):
    today = date.today()
    ensure_user_exists(db, user_id)
    
    # Aggregates for today
    calories_in = db.query(func.sum(FoodLog.calories)).filter(
        FoodLog.user_id == user_id,
        FoodLog.date == today
    ).scalar() or 0
    
    calories_burned = db.query(func.sum(ActivityLog.calories_burned)).filter(
        ActivityLog.user_id == user_id,
        ActivityLog.date == today
    ).scalar() or 0
    
    workouts_done = db.query(Workout).filter(
        Workout.user_id == user_id,
        Workout.date == today
    ).count()
    
    total_reps = db.query(func.sum(Workout.reps)).filter(
        Workout.user_id == user_id,
        Workout.date == today
    ).scalar() or 0
    
    total_steps = db.query(func.sum(ActivityLog.steps)).filter(
        ActivityLog.user_id == user_id,
        ActivityLog.date == today
    ).scalar() or 0
    
    return {
        "calories_in": calories_in,
        "calories_out": calories_burned,
        "workouts_done": workouts_done,
        "reps": total_reps,
        "steps": total_steps
    }

@router.get("/progress")
def get_today_progress_query(user_id: str, db: Session = Depends(get_db)):
    return get_today_progress(user_id, db)

@router.post("/reset-today")
def reset_today(req: ResetRequest, db: Session = Depends(get_db)):
    today = date.today()
    ensure_user_exists(db, req.user_id)
    
    # Delete workouts logged today
    db.query(Workout).filter(Workout.user_id == req.user_id, Workout.date == today).delete()
    # Delete food logged today
    db.query(FoodLog).filter(FoodLog.user_id == req.user_id, FoodLog.date == today).delete()
    # Delete activity logged today
    db.query(ActivityLog).filter(ActivityLog.user_id == req.user_id, ActivityLog.date == today).delete()
    # Delete score logged today
    db.query(ScoreLog).filter(ScoreLog.user_id == req.user_id, ScoreLog.date == today).delete()
    
    db.commit()
    return {"status": "success", "message": "Today's logs reset successfully"}

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
