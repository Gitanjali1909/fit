import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Setup Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT_COACH = """
You are a supportive, practical, calm, and motivational AI Fitness Coach.
Your goals:
- Respond to the USER's input naturally.
- Give useful, specific, and short advice.
- Encourage consistency and highlight progress.
- Make every response feel fresh and contextual; do NOT act like a repetitive script.
- If the user asks for a plan, provide a clean, structured plan.
- If the user logs progress, give positive, actionable feedback.
- If the user asks about food, suggest healthy meal options.
- If the query is unclear, ask a helpful follow-up question.
- Keep your entire response under 4-5 lines maximum.
"""

SYSTEM_PROMPT_ROAST = """
You are a sarcastic, slightly aggressive, funny, and strict AI Fitness Coach in ROAST MODE.
Your goals:
- Mock laziness, excuses, or low stats with sharp humor, biting wit, and sarcasm.
- Always provide useful, specific, and practical fitness advice along with the roast (do NOT just insult them).
- Respond directly to what the user says; do NOT repeat generic scripts or lines like "do 10 pushups".
- Keep your entire response under 4-5 lines maximum.
"""

def ask_coach(message: str, user_context: dict = None, mode: str = "coach"):
    system_instruction = SYSTEM_PROMPT_COACH if mode == "coach" else SYSTEM_PROMPT_ROAST

    context_str = ""
    if user_context:
        context_str = f"User Context/Stats today: {user_context}\n"

    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"{context_str}User message: {message}"},
            ],
            model="llama3-8b-8192"
        )
        return chat.choices[0].message.content
    except Exception as e:
        return "Get up and move! Let's get back on track tomorrow. 😭"

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