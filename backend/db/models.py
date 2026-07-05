from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from datetime import date
from db.session import Base, engine

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    weight = Column(Float)
    height = Column(Float)
    goal = Column(String)

    workouts = relationship("Workout", back_populates="user", cascade="all, delete-orphan")
    food_logs = relationship("FoodLog", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")


class Workout(Base):
    __tablename__ = "workouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(String)  # pushup, squat, etc.
    reps = Column(Integer)
    date = Column(Date, default=date.today)

    user = relationship("User", back_populates="workouts")


class FoodLog(Base):
    __tablename__ = "food_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    food_name = Column(String)
    calories = Column(Integer)
    protein = Column(Integer, default=0)
    carbs = Column(Integer, default=0)
    fat = Column(Integer, default=0)
    date = Column(Date, default=date.today)

    user = relationship("User", back_populates="food_logs")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    activity_type = Column(String)  # walk, run, manual
    duration = Column(Integer)  # minutes
    steps = Column(Integer, nullable=True)
    calories_burned = Column(Integer)
    date = Column(Date, default=date.today)

    user = relationship("User", back_populates="activity_logs")

# Create tables in database
Base.metadata.create_all(bind=engine)
