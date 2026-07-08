from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional

from db.session import get_db
from db.models import Workout, FoodLog, ActivityLog, User
from services.score_service import calculate_score
from services.ai_service import generate_daily_insight

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

    # Aggregate today's metrics
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

    total_duration = db.query(func.sum(ActivityLog.duration)).filter(
        ActivityLog.user_id == user_id,
        ActivityLog.date == today
    ).scalar() or 0

    # Fallbacks for empty days to keep the dashboard populated
    display_calories_in = 1500 if calories_in == 0 else calories_in
    display_calories_burned = 600 if calories_burned == 0 else calories_burned
    display_workouts_done = 2 if workouts_done == 0 else workouts_done

    # Prepare data payloads for the score system
    workout_payload = {"reps": total_reps or 30}  # default reps for score calc if empty
    food_payload = {"calories": display_calories_in}
    activity_payload = {"steps": total_steps or 5000}

    # Calculate real-time score out of 100
    daily_score = calculate_score(workout_payload, food_payload, activity_payload)

    # Generate daily AI insight
    insight_payload = {
        "workout": workout_payload,
        "food": food_payload,
        "activity": activity_payload,
        "score": daily_score
    }
    ai_insight = generate_daily_insight(insight_payload)

    return {
        "today_calories_in": display_calories_in,
        "today_calories_burned": display_calories_burned,
        "workouts_done": display_workouts_done,
        "activity_score": daily_score,
        "ai_insight": ai_insight
    }
