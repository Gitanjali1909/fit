from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import Workout, FoodLog, ActivityLog, ScoreLog, PlanLog
from services.ai_service import ask_coach
from services.db_service import ensure_user_exists
from datetime import date, timedelta
from typing import Optional, List

router = APIRouter()

class UserProfileSchema(BaseModel):
    age: int
    weight: int
    goal: str

class RecentActivitySchema(BaseModel):
    workouts: str
    calories: str
    steps: str

class HistoryMessageSchema(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    user_profile: UserProfileSchema
    recent_activity: RecentActivitySchema
    conversation_history: List[HistoryMessageSchema]
    current_message: str
    mode: str = "coach"
    user_id: Optional[str] = None

@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    if req.user_id:
        ensure_user_exists(db, req.user_id)

    profile_dict = req.user_profile.dict()
    activity_dict = req.recent_activity.dict()
    history_list = [h.dict() for h in req.conversation_history]

    reply = ask_coach(
        user_profile=profile_dict,
        recent_activity=activity_dict,
        conversation_history=history_list,
        current_message=req.current_message,
        mode=req.mode
    )
    return {"reply": reply}