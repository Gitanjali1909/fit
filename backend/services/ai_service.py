import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """
You are a strict but funny fitness coach.
You give simple, practical advice.
You can roast lazy users lightly.
Keep answers short.
"""

def ask_coach(message: str):
    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ],
            model="llama3-8b-8192"
        )
        return chat.choices[0].message.content
    except Exception as e:
        return "Stop being lazy and do 10 pushups 😭"

def generate_daily_insight(data: dict):
    prompt = f"""
    User data:
    Workout: {data.get('workout')}
    Food: {data.get('food')}
    Activity: {data.get('activity')}
    Score: {data.get('score')}

    Give a short, savage but helpful fitness insight in 1-2 lines.
    """
    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a strict, savage, and funny fitness coach. Provide a roasting but helpful fitness insight based on user data in 1-2 lines. Keep it extremely brief."},
                {"role": "user", "content": prompt},
            ],
            model="llama3-8b-8192",
            max_tokens=60
        )
        return chat.choices[0].message.content.strip()
    except Exception as e:
        return "You ate like a king but moved like a rock. Fix it tomorrow. 😭"

def generate_adaptive_insight(data: dict):
    prompt = f"""
    User Data:
    Steps: {data.get('steps')}
    Calories: {data.get('calories')}
    Workouts: {data.get('workouts')}

    Give a short fitness insight + suggestion.
    """
    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a smart, professional fitness analyst. Give a short fitness insight + practical suggestion in 1-2 lines based on the user's steps, calories, and workouts today. Keep it brief and actionable."},
                {"role": "user", "content": prompt},
            ],
            model="llama3-8b-8192",
            max_tokens=80
        )
        return chat.choices[0].message.content.strip()
    except Exception as e:
        return "Insight: Activity is low. Try adding a 15-minute walk to balance calorie intake."