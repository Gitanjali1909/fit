from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import PlanLog
from services.db_service import ensure_user_exists
from services.adaptive_service import analyze_user, adjust_plan
from datetime import date

router = APIRouter()

@router.post("/adaptive/analyze")
def adaptive(data: dict, db: Session = Depends(get_db)):
    insights = analyze_user(data)
    plan = adjust_plan(insights)

    user_id = data.get("user_id")
    if user_id:
        ensure_user_exists(db, user_id)
        # Check if plan for today already exists, if so update it, otherwise create new
        plan_log = db.query(PlanLog).filter(
            PlanLog.user_id == user_id,
            PlanLog.date == date.today()
        ).first()
        
        if plan_log:
            plan_log.plan_content = plan
        else:
            plan_log = PlanLog(
                user_id=user_id,
                plan_content=plan,
                date=date.today()
            )
            db.add(plan_log)
            
        db.commit()

    return {
        "insights": insights,
        "plan_update": plan
    }
