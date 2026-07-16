from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional

from db.session import get_db
from db.models import Workout, FoodLog, ActivityLog, User, ScoreLog
from services.score_service import calculate_score
from services.ai_service import generate_daily_insight, generate_adaptive_insight, generate_score_explanation
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

    steps = req.steps
    if (steps is None or steps == 0) and req.activity_type.lower().strip() in ["walk", "run", "walking", "running"]:
        steps = int(round((req.duration * 110) / 100.0) * 100)
        if steps == 0 and req.duration > 0:
            steps = 100

    activity = ActivityLog(
        user_id=req.user_id,
        activity_type=req.activity_type,
        duration=req.duration,
        steps=steps,
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


@router.delete("/log/{log_type}/{id}")
async def delete_log(log_type: str, id: int, db: Session = Depends(get_db)):
    today = date.today()
    log_type_clean = log_type.lower().strip()
    
    if log_type_clean == "workout":
        log = db.query(Workout).filter(Workout.id == id).first()
    elif log_type_clean == "food":
        log = db.query(FoodLog).filter(FoodLog.id == id).first()
    elif log_type_clean == "activity":
        log = db.query(ActivityLog).filter(ActivityLog.id == id).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid log type")
        
    if not log:
        raise HTTPException(status_code=404, detail="Log entry not found")
        
    user_id = log.user_id
    db.delete(log)
    db.commit()
    
    updated_logs = []
    if log_type_clean == "workout":
        items = db.query(Workout).filter(Workout.user_id == user_id, Workout.date == today).order_by(Workout.id.desc()).all()
        updated_logs = [{"id": item.id, "type": item.type, "reps": item.reps} for item in items]
    elif log_type_clean == "food":
        items = db.query(FoodLog).filter(FoodLog.user_id == user_id, FoodLog.date == today).order_by(FoodLog.id.desc()).all()
        updated_logs = [{"id": item.id, "food_name": item.food_name, "calories": item.calories} for item in items]
    elif log_type_clean == "activity":
        items = db.query(ActivityLog).filter(ActivityLog.user_id == user_id, ActivityLog.date == today).order_by(ActivityLog.id.desc()).all()
        updated_logs = [{
            "id": item.id,
            "activity_type": item.activity_type,
            "duration": item.duration,
            "steps": item.steps,
            "calories_burned": item.calories_burned
        } for item in items]
        
    return {
        "success": True,
        "message": f"{log_type} log deleted successfully",
        "updated_logs": updated_logs
    }


@router.delete("/log/{id}")
async def delete_food_log(id: int, db: Session = Depends(get_db)):
    return await delete_log("food", id, db)




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
            "has_data": False,
            "workouts": [],
            "food": [],
            "activity": []
        }

    # 3. Fetch today's detailed lists (ordered latest first)
    workouts_list = db.query(Workout).filter(Workout.user_id == user_id, Workout.date == today).order_by(Workout.id.desc()).all()
    food_list = db.query(FoodLog).filter(FoodLog.user_id == user_id, FoodLog.date == today).order_by(FoodLog.id.desc()).all()
    activity_list = db.query(ActivityLog).filter(ActivityLog.user_id == user_id, ActivityLog.date == today).order_by(ActivityLog.id.desc()).all()

    # 4. Core Score Calculation
    # Workout (40 pts max, target 50 reps)
    workout_score = min(total_reps / 50.0, 1.0) * 40.0
    
    # Diet (40 pts max, target <= 2000 kcal)
    if calories_in <= 2000.0:
        diet_score = 40.0
    else:
        diff_penalty = (calories_in - 2000.0) / 25.0
        diet_score = max(0.0, 40.0 - diff_penalty)
        
    # Steps (20 pts max, target 8000 steps)
    steps_score = min(total_steps / 8000.0, 1.0) * 20.0
    
    daily_score = int(workout_score + diet_score + steps_score)

    # 5. Save calculated score to DB
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

    # 6. Run adaptive planning engine
    adaptive_payload = {
        "steps": total_steps,
        "calories": calories_in,
        "workouts": workouts_done
    }
    insights = analyze_user(adaptive_payload)
    plan_update = adjust_plan(insights)

    # 7. Query yesterday's score for context
    yesterday = today - timedelta(days=1)
    yesterday_score_log = db.query(ScoreLog).filter(
        ScoreLog.user_id == user_id,
        ScoreLog.date == yesterday
    ).first()
    yesterday_score = yesterday_score_log.score if yesterday_score_log else None

    # 8. Generate dynamic AI coach insight using strict JSON formatting
    insight_payload = {
        "score": daily_score,
        "workout_reps": total_reps,
        "calories_in": calories_in,
        "calories_out": calories_burned,
        "steps": total_steps,
        "previous_day_score": yesterday_score
    }
    ai_insight = generate_adaptive_insight(insight_payload)
    score_explanation = generate_score_explanation(workout_score, diet_score, steps_score)

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
        "has_data": True,
        "score_explanation": score_explanation,
        "score_breakdown": {
            "workout": int(workout_score),
            "diet": int(diet_score),
            "steps": int(steps_score)
        },
        
        # Lists
        "workouts": [{"type": w.type, "reps": w.reps, "id": w.id} for w in workouts_list],
        "food": [{"food_name": f.food_name, "calories": f.calories, "id": f.id} for f in food_list],
        "activity": [{"activity_type": a.activity_type, "duration": a.duration, "steps": a.steps, "calories_burned": a.calories_burned, "id": a.id} for a in activity_list]
      }
