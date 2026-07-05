from fastapi import APIRouter
from pydantic import BaseModel
from services.ai_service import coach_chat

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    profile: dict | None = None
    mode: str = "coach"

@router.post("/chat")
def chat(req: ChatRequest):
    reply = coach_chat(
        message=req.message,
        user_context=req.profile, # type: ignore
        mode=req.mode
    )
    return {"reply": reply}