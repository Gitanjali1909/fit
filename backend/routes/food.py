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
    name: Optional[str] = None
    quantity: Optional[float] = None
    food: Optional[str] = None
    image: Optional[str] = None
    portion_size: Optional[str] = None
    user_id: Optional[str] = "1"

@router.post("/analyze")
async def analyze_food(req: FoodAnalyzeRequest, db: Session = Depends(get_db)):
    if req.name is not None and req.quantity is not None:
        result = analyze_food_text_ai(f"{req.quantity} {req.name}")
    else:
        if not req.image and not req.food:
            raise HTTPException(
                status_code=400, 
                detail="Provide either direct food name + quantity, a food description text, or camera image base64 data."
            )
        
        if req.image:
            result = analyze_food_image_ai(req.image)
        else:
            result = analyze_food_text_ai(req.food)

    status = result.get("status", "success")
    items = result.get("items", [])

    # If food is not found in database, return unknown_food to show "Food not in database"
    if status == "unknown_food":
        return {
            "items": [],
            "total_calories": 0,
            "suggestion": "Food not in database.",
            "status": "unknown_food",
            "logged": False,
            "log_id": None
        }

    # If status is not success or items list is empty, reject the request
    if status != "success" or not items:
        return {
            "items": [],
            "total_calories": 0,
            "suggestion": "No valid food detected. Try again.",
            "status": "rejected",
            "logged": False,
            "log_id": None
        }

    user_id = req.user_id or "1"
    ensure_user_exists(db, user_id)
    
    logged = False
    log_id = None
    
    if status == "success":
        item_names = [item.get("name", "") for item in items]
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
        "items": items,
        "total_calories": total_cals,
        "suggestion": result.get("suggestion", ""),
        "status": status,
        "logged": logged,
        "log_id": log_id
    }
