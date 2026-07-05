from fastapi import APIRouter
from pydantic import BaseModel
from services.ai_service import ask_coach

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

@router.post("/chat")
async def chat(req: ChatRequest):
    reply = ask_coach(req.message)
    return {"reply": reply}