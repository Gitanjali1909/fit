from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from db.session import get_db
from db.models import Workout, FoodLog, ActivityLog, ScoreLog, PlanLog
from services.ai_service import ask_coach
from services.db_service import ensure_user_exists
from datetime import date, timedelta
from typing import Optional

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    profile: Optional[dict] = None
    mode: str = "coach"
    user_id: Optional[str] = None

@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    context = req.profile or {}

    if req.user_id:
        ensure_user_exists(db, req.user_id)
        today = date.today()
        yesterday = today - timedelta(days=1)

        # Aggregate today's stats
        cals_in = db.query(func.sum(FoodLog.calories)).filter(
            FoodLog.user_id == req.user_id,
            FoodLog.date == today
        ).scalar() or 0

        cals_out = db.query(func.sum(ActivityLog.calories_burned)).filter(
            ActivityLog.user_id == req.user_id,
            ActivityLog.date == today
        ).scalar() or 0

        steps = db.query(func.sum(ActivityLog.steps)).filter(
            ActivityLog.user_id == req.user_id,
            ActivityLog.date == today
        ).scalar() or 0

        workouts = db.query(Workout).filter(
            Workout.user_id == req.user_id,
            Workout.date == today
        ).count()

        # Get yesterday's score
        yesterday_score_log = db.query(ScoreLog).filter(
            ScoreLog.user_id == req.user_id,
            ScoreLog.date == yesterday
        ).first()
        yesterday_score = yesterday_score_log.score if yesterday_score_log else "None"

        # Get latest plan adjustment
        latest_plan_log = db.query(PlanLog).filter(
            PlanLog.user_id == req.user_id
        ).order_by(PlanLog.date.desc()).first()
        latest_plan = latest_plan_log.plan_content if latest_plan_log else "None"

        # Merge database metrics into user context for AI awareness
        context.update({
            "today_calories_in": cals_in,
            "today_calories_burned": cals_out,
            "today_steps": steps,
            "today_workouts": workouts,
            "yesterday_score": yesterday_score,
            "latest_plan": latest_plan
        })

    reply = ask_coach(
        message=req.message,
        user_context=context,
        mode=req.mode
    )
    return {"reply": reply}