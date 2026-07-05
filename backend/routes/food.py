from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from db.session import get_db
from db.models import FoodLog
from services.nutrition_service import analyze_food_ai

router = APIRouter()

class FoodAnalyzeRequest(BaseModel):
    food: str
    user_id: Optional[int] = 1

@router.post("/analyze")
async def analyze_food(req: FoodAnalyzeRequest, db: Session = Depends(get_db)):
    # 1. Analyze food using Groq AI
    result = analyze_food_ai(req.food)

    # 2. Log to Database under user_id
    user_id = req.user_id or 1
    food_log = FoodLog(
        user_id=user_id,
        food_name=result.get("food", req.food),
        calories=result.get("calories", 0),
        protein=result.get("protein", 0),
        carbs=result.get("carbs", 0),
        fat=result.get("fat", 0),
        date=date.today()
    )
    db.add(food_log)
    db.commit()
    db.refresh(food_log)

    # Return estimated macros & tip
    return {
        "food": result.get("food", req.food),
        "calories": result.get("calories", 0),
        "protein": result.get("protein", 0),
        "carbs": result.get("carbs", 0),
        "fat": result.get("fat", 0),
        "tip": result.get("tip", "Tracked successfully!"),
        "logged": True,
        "log_id": food_log.id
    }
