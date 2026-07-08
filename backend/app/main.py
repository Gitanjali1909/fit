from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import coach, logs, food, score, adaptive
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Fit AI API")

# Add CORS Middleware to enable communication with Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(coach.router, prefix="/coach")
app.include_router(food.router, prefix="/food")
app.include_router(logs.router)
app.include_router(score.router)
app.include_router(adaptive.router)