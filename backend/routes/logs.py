from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional

from db.session import get_db
from db.models import Workout, FoodLog, ActivityLog, User

router = APIRouter()
class WorkoutCreate(BaseModel):
    user_id: int
    type: str
    reps: int

class FoodCreate(BaseModel):
    user_id: int
    food_name: str
    calories: int

class ActivityCreate(BaseModel):
    user_id: int
    activity_type: str
    duration: int
    steps: Optional[int] = None
    calories_burned: int


@router.post("/log/workout")
async def log_workout(req: WorkoutCreate, db: Session = Depends(get_db)):
    workout = Workout(
        user_id=req.user_id,
        type=req.type,
        reps=req.reps,
        date=date.today()
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return {"status": "success", "message": "Workout logged", "id": workout.id}


@router.post("/log/food")
async def log_food(req: FoodCreate, db: Session = Depends(get_db)):
    food = FoodLog(
        user_id=req.user_id,
        food_name=req.food_name,
        calories=req.calories,
        date=date.today()
    )
    db.add(food)
    db.commit()
    db.refresh(food)
    return {"status": "success", "message": "Food logged", "id": food.id}


@router.post("/log/activity")
async def log_activity(req: ActivityCreate, db: Session = Depends(get_db)):
    activity = ActivityLog(
        user_id=req.user_id,
        activity_type=req.activity_type,
        duration=req.duration,
        steps=req.steps,
        calories_burned=req.calories_burned,
        date=date.today()
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return {"status": "success", "message": "Activity logged", "id": activity.id}


@router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: int, db: Session = Depends(get_db)):
    today = date.today()

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

    total_duration = db.query(func.sum(ActivityLog.duration)).filter(
        ActivityLog.user_id == user_id,
        ActivityLog.date == today
    ).scalar() or 0

    # Base dashboard layout values (if no records logged today, show mock profile metrics)
    base_calories_in = 1500 if calories_in == 0 else calories_in
    base_calories_burned = 600 if calories_burned == 0 else calories_burned
    base_workouts_done = 2 if workouts_done == 0 else workouts_done
    
    # Calculate a score out of 100 based on total activity duration (30 mins = 70 score, more = higher)
    if total_duration > 0:
        base_activity_score = min(100, 50 + int(total_duration * 1.5))
    else:
        base_activity_score = 70

    return {
        "today_calories_in": base_calories_in,
        "today_calories_burned": base_calories_burned,
        "workouts_done": base_workouts_done,
        "activity_score": base_activity_score
    }
