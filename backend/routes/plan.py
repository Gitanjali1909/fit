from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.session import get_db
from db.models import PlanLog
from services.db_service import ensure_user_exists
from pydantic import BaseModel
from datetime import date

router = APIRouter()

class PlanSaveRequest(BaseModel):
    user_id: str
    plan_content: str

@router.post("/plan/save")
def save_plan(req: PlanSaveRequest, db: Session = Depends(get_db)):
    ensure_user_exists(db, req.user_id)
    # Check if a plan for today already exists, if so update it, otherwise insert new
    plan = db.query(PlanLog).filter(
        PlanLog.user_id == req.user_id,
        PlanLog.date == date.today()
    ).first()
    
    if plan:
        plan.plan_content = req.plan_content
    else:
        plan = PlanLog(
            user_id=req.user_id,
            plan_content=req.plan_content,
            date=date.today()
        )
        db.add(plan)
        
    db.commit()
    return {"status": "success", "message": "Plan saved successfully"}

@router.get("/plan/{user_id}")
def get_plan(user_id: str, db: Session = Depends(get_db)):
    ensure_user_exists(db, user_id)
    # Retrieve the latest plan
    plan = db.query(PlanLog).filter(
        PlanLog.user_id == user_id
    ).order_by(PlanLog.date.desc()).first()
    
    if plan:
        return {"plan_content": plan.plan_content}
        
    return {"plan_content": "No active plan adjusted yet. Complete a workout to start."}
