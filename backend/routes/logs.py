from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from typing import Optional

from db.session import get_db
from db.models import Workout, FoodLog, ActivityLog, User, ScoreLog
from services.score_service import calculate_score
from services.ai_service import generate_daily_insight, generate_adaptive_insight
from services.adaptive_service import analyze_user, adjust_plan
from services.db_service import ensure_user_exists

router = APIRouter()

class WorkoutCreate(BaseModel):
    user_id: str
    type: str
    reps: int

class FoodCreate(BaseModel):
    user_id: str
    food_name: str
    calories: int

class ActivityCreate(BaseModel):
    user_id: str
    activity_type: str
    duration: int
    steps: Optional[int] = None
    calories_burned: Optional[int] = None


@router.post("/log/workout")
async def log_workout(req: WorkoutCreate, db: Session = Depends(get_db)):
    ensure_user_exists(db, req.user_id)
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
    ensure_user_exists(db, req.user_id)
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
    user = ensure_user_exists(db, req.user_id)

    # Constant MET calculation map
    MET_MAP = {
        "walk": 3.5,
        "run": 7.0,
        "cycling": 6.0,
        "skipping": 8.0,
        "other": 4.0
    }

    activity_key = req.activity_type.lower().strip()
    met = MET_MAP.get(activity_key, 4.0)

    # MET calculation: calories = MET * weight(kg) * duration(hours)
    user_weight = user.weight or 70.0
    duration_hours = req.duration / 60.0
    calories = req.calories_burned

    if calories is None or calories == 0:
        calories = int(met * user_weight * duration_hours)

    activity = ActivityLog(
        user_id=req.user_id,
        activity_type=req.activity_type,
        duration=req.duration,
        steps=req.steps,
        calories_burned=calories,
        date=date.today()
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return {
        "status": "success", 
        "message": "Activity logged", 
        "id": activity.id,
        "calories_burned": calories
    }


@router.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str, db: Session = Depends(get_db)):
    today = date.today()
    ensure_user_exists(db, user_id)

    # 1. Query today's raw totals directly from database
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

    # 2. Check if any data has been logged today (if not, show empty state with no fake numbers)
    has_logs = (calories_in > 0) or (calories_burned > 0) or (workouts_done > 0) or (total_steps > 0)

    if not has_logs:
        return {
            "today_calories_in": 0,
            "today_calories_burned": 0,
            "workouts_done": 0,
            "activity_score": 0,
            "ai_insight": None,
            "adaptive_insights": [],
            "plan_adjustment": None,
            
            # Spec-compliant properties
            "calories_in": 0,
            "calories_out": 0,
            "steps": 0,
            "reps": 0,
            "score": 0,
            "insight": None,
            "has_data": False
        }

    # 3. Calculate Score using the formula:
    # score = (calories_burned / goal_burn) * 40 + (workout_done ? 30 : 0) + (activity_logged ? 30 : 0)
    goal_burn = 500.0  # target daily calorie burn threshold
    burn_points = min((calories_burned / goal_burn) * 40.0, 40.0)
    workout_points = 30.0 if workouts_done > 0 else 0.0
    activity_points = 30.0 if (calories_burned > 0 or total_steps > 0) else 0.0
    daily_score = int(burn_points + workout_points + activity_points)

    # 4. Save calculated score to DB
    score_log = db.query(ScoreLog).filter(
        ScoreLog.user_id == user_id,
        ScoreLog.date == today
    ).first()
    if score_log:
        score_log.score = daily_score
    else:
        score_log = ScoreLog(user_id=user_id, score=daily_score, date=today)
        db.add(score_log)
    db.commit()

    # 5. Run adaptive planning engine
    adaptive_payload = {
        "steps": total_steps,
        "calories": calories_in,
        "workouts": workouts_done
    }
    insights = analyze_user(adaptive_payload)
    plan_update = adjust_plan(insights)

    # 6. Generate dynamic AI advice using Groq
    ai_insight = generate_adaptive_insight(adaptive_payload)

    return {
        # Frontend-backward-compatible properties
        "today_calories_in": calories_in,
        "today_calories_burned": calories_burned,
        "workouts_done": workouts_done,
        "activity_score": daily_score,
        "ai_insight": ai_insight,
        "adaptive_insights": insights,
        "plan_adjustment": plan_update,
        
        # Spec-compliant properties
        "calories_in": calories_in,
        "calories_out": calories_burned,
        "steps": total_steps,
        "reps": total_reps,
        "score": daily_score,
        "insight": ai_insight,
        "has_data": True
      }
