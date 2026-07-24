from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from db.session import get_db
from db.models import FoodLog
from services.nutrition_service import analyze_food_text_ai, analyze_food_image_ai, analyze_food_manual
from services.db_service import ensure_user_exists

router = APIRouter()

class FoodAnalyzeRequest(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    food: Optional[str] = None
    image: Optional[str] = None
    portion_size: Optional[str] = "medium"
    user_id: Optional[str] = "1"

@router.post("/analyze")
async def analyze_food(req: FoodAnalyzeRequest, db: Session = Depends(get_db)):
    portion = req.portion_size or "medium"
    
    # 1. Determine if this is a manual-first structured log (bypassing AI)
    if req.name is not None and req.quantity is not None:
        result = analyze_food_manual(req.name, req.quantity, portion)
    else:
        if not req.image and not req.food:
            raise HTTPException(
                status_code=400, 
                detail="Provide either direct food name + quantity, a food description text, or camera image base64 data."
            )
        
        # Analyze food using Groq AI (Vision vs Text model)
        if req.image:
            result = analyze_food_image_ai(req.image, portion)
        else:
            result = analyze_food_text_ai(req.food, portion)

    # 2. Log to Database under user_id ONLY IF status is success
    user_id = req.user_id or "1"
    ensure_user_exists(db, user_id)
    
    logged = False
    log_id = None
    status = result.get("status", "success")
    
    if status == "success":
        # Construct combined item names for logging
        item_names = [item.get("name", "") for item in result.get("items", [])]
        combined_name = ", ".join(filter(None, item_names)) or req.name or req.food or "Logged Meal"
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
        logged = True
        log_id = food_log.id
    else:
        total_cals = 0

    return {
        "items": result.get("items", []),
        "total_calories": total_cals,
        "suggestion": result.get("suggestion", ""),
        "status": status,
        "logged": logged,
        "log_id": log_id
    }

