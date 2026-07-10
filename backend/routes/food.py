from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from db.session import get_db
from db.models import FoodLog
from services.nutrition_service import analyze_food_text_ai, analyze_food_image_ai
from services.db_service import ensure_user_exists

router = APIRouter()

class FoodAnalyzeRequest(BaseModel):
    food: Optional[str] = None
    image: Optional[str] = None
    user_id: Optional[str] = "1"

@router.post("/analyze")
async def analyze_food(req: FoodAnalyzeRequest, db: Session = Depends(get_db)):
    if not req.image and not req.food:
        raise HTTPException(status_code=400, detail="Provide either food description or camera image base64 data.")

    # 1. Analyze food using Groq AI (Vision vs Text model)
    if req.image:
        result = analyze_food_image_ai(req.image)
    else:
        result = analyze_food_text_ai(req.food)

    # 2. Log to Database under user_id
    user_id = req.user_id or "1"
    ensure_user_exists(db, user_id)
    
    # Construct combined item names for logging
    item_names = [item.get("name", "") for item in result.get("items", [])]
    combined_name = ", ".join(filter(None, item_names)) or req.food or "Scanned Meal"
    total_cals = result.get("total_calories", 0)

    food_log = FoodLog(
        user_id=user_id,
        food_name=combined_name,
        calories=total_cals,
        protein=0,
        carbs=0,
        fat=0,
        date=date.today()
    )
    db.add(food_log)
    db.commit()
    db.refresh(food_log)

    # Return estimated JSON schema matching prompt specifications
    return {
        "items": result.get("items", []),
        "total_calories": total_cals,
        "suggestion": result.get("suggestion", ""),
        "logged": True,
        "log_id": food_log.id
    }
