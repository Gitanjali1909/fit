from fastapi import FastAPI
from routes import coach

app = FastAPI()
app.include_router(coach.router, prefix="/coach")