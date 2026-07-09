from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from datetime import date
from db.session import Base, engine


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # UUID from frontend
    name = Column(String, index=True, nullable=True)
    age = Column(Integer, nullable=True)
    weight = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    goal = Column(String, nullable=True)

    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    food_logs = relationship("FoodLog", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    scores = relationship("ScoreLog", back_populates="user", cascade="all, delete-orphan")
    plans = relationship("PlanLog", back_populates="user", cascade="all, delete-orphan")


class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)  # FIXED
    user_id = Column(String, ForeignKey("users.id"))
    type = Column(String)
    reps = Column(Integer)
    date = Column(Date, default=lambda: date.today())

    user = relationship("User", back_populates="workouts")


class FoodLog(Base):
    __tablename__ = "food_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    food_name = Column(String)
    calories = Column(Integer)
    protein = Column(Integer, default=0)
    carbs = Column(Integer, default=0)
    fat = Column(Integer, default=0)
    date = Column(Date, default=lambda: date.today())

    user = relationship("User", back_populates="food_logs")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    activity_type = Column(String)
    duration = Column(Integer)
    steps = Column(Integer, nullable=True)
    calories_burned = Column(Integer)
    date = Column(Date, default=lambda: date.today())

    user = relationship("User", back_populates="activity_logs")


class ScoreLog(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    score = Column(Integer)
    date = Column(Date, default=lambda: date.today())

    user = relationship("User", back_populates="scores")


class PlanLog(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    plan_content = Column(String)
    date = Column(Date, default=lambda: date.today())

    user = relationship("User", back_populates="plans")

Base.metadata.create_all(bind=engine)