from sqlalchemy.orm import Session
from db.models import User, Workout, FoodLog, ActivityLog, ScoreLog, PlanLog
from datetime import date

def ensure_user_exists(db: Session, user_id: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(
            id=user_id,
            name="Anonymous",
            age=25,
            weight=70.0,
            height=175.0,
            goal="Maintenance"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
