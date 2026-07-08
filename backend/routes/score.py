from fastapi import APIRouter
from services.score_service import calculate_score
from services.ai_service import generate_daily_insight

router = APIRouter()

@router.post("/score")
async def get_score(data: dict):
    score = calculate_score(
        data.get("workout"),
        data.get("food"),
        data.get("activity")
    )
    return {"score": score}

@router.post("/insight")
async def get_insight(data: dict):
    # Calculate score first if not passed in request body
    score = data.get("score")
    if score is None:
        score = calculate_score(
            data.get("workout"),
            data.get("food"),
            data.get("activity")
        )
        data["score"] = score
        
    insight = generate_daily_insight(data)
    return {"insight": insight}
