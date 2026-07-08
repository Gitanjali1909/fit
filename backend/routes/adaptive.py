from fastapi import APIRouter
from services.adaptive_service import analyze_user, adjust_plan

router = APIRouter()

@router.post("/adaptive/analyze")
def adaptive(data: dict):
    insights = analyze_user(data)
    plan = adjust_plan(insights)

    return {
        "insights": insights,
        "plan_update": plan
    }
