import os
import json
from typing import Optional
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

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

def ask_coach(message: str, user_context: dict = None, mode: str = "coach"): # type: ignore
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
            model="llama-3.3-70b-versatile"
        )
        return chat.choices[0].message.content
    except Exception as e:
        return "Get up and move! Let's get back on track tomorrow. 😭"

def generate_daily_insight(score: int, workout_reps: int, calories_in: int, calories_out: int, steps: int, previous_day_score: Optional[int] = None) -> dict:
    prompt = f"""
    Input Stats:
    - Daily Score: {score}/100
    - Workout Reps: {workout_reps}
    - Calories In: {calories_in} kcal
    - Calories Out: {calories_out} kcal
    - Steps: {steps}
    - Previous Day Score: {previous_day_score if previous_day_score is not None else 'N/A'}
    """

    system_prompt = """You are a fitness coach analyzing a user's daily stats.

    Rules:
    - Be concise (max 2–3 lines)
    - Be realistic (no exaggeration)
    - If data is missing, acknowledge it
    - If performance is poor → lightly roast
    - If good → encourage
    - DO NOT invent numbers
    - DO NOT repeat raw stats

    You MUST output STRICT JSON in this format:
    {
      "insight": "string content here",
      "tone": "coach" | "roast"
    }
    """

    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )
        raw = chat.choices[0].message.content.strip()
        return json.loads(raw)
    except Exception as e:
        tone = "roast" if score < 50 else "coach"
        insight = "You moved like a rock today. Let's get up and hit the squats tomorrow!" if score < 50 else "Great consistency today. Keep this momentum going!"
        return {
            "insight": insight,
            "tone": tone
        }

def generate_adaptive_insight(data: dict) -> dict:
    score = data.get("score", 0)
    workout_reps = data.get("workout_reps", 0)
    calories_in = data.get("calories_in", 0)
    calories_out = data.get("calories_out", 0)
    steps = data.get("steps", 0)
    previous_day_score = data.get("previous_day_score")

    return generate_daily_insight(
        score=score,
        workout_reps=workout_reps,
        calories_in=calories_in,
        calories_out=calories_out,
        steps=steps,
        previous_day_score=previous_day_score
    )

def generate_score_explanation(workout_score: float, diet_score: float, steps_score: float) -> str:
    prompt = f"""
    Input:
    - workout score: {workout_score:.1f}/40
    - diet score: {diet_score:.1f}/40
    - steps score: {steps_score:.1f}/20
    """

    system_prompt = """You are a fitness coach explaining a daily score.

    Task:
    Explain in 1–2 short lines how the score was built.

    Example:
    "+15 from workout, +30 from diet, +10 from activity. Improve steps tomorrow."

    Rules:
    - Keep it short
    - No fluff
    - No emojis
    """

    try:
        chat = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            model="llama-3.3-70b-versatile",
            max_tokens=60
        )
        return chat.choices[0].message.content.strip()
    except Exception:
        return f"+{workout_score:.0f} workout, +{diet_score:.0f} diet, +{steps_score:.0f} activity."