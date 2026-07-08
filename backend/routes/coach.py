from fastapi import APIRouter
from pydantic import BaseModel
from services.ai_service import ask_coach

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    profile: dict | None = None
    mode: str = "coach"

@router.post("/chat")
def chat(req: ChatRequest):
    reply = ask_coach(
        message=req.message,
        user_context=req.profile, # type: ignore
        mode=req.mode # type: ignore
    )
    return {"reply": reply}