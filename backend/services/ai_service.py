import os
import json
from typing import Optional
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_INSTRUCTION = """You are an AI fitness coach inside Fit. No emojis. Plain text only.
Classify intent into: plan_request, progress_update, question, motivation, general.

Rules:
1. Tone: Calm/strict. Light roast if lazy.
2. Fitness queries: Respond like a coach, short and actionable.
3. Keep response under 2 lines. Return JSON only. No formatting cards.
4. Only update plan if user explicitly asks (action.type = "update_plan").

JSON Schema:
{
  "intent": "intent",
  "tone": "coach" | "roast",
  "response": "message",
  "action": {"type": "none" | "update_plan", "data": {"plan_summary": "summary"}}
}"""

def ask_coach(user_profile: dict, recent_activity: dict, conversation_history: list, current_message: str, mode: str = "coach") -> dict:
    context_prompt = f"""
    User Profile: Age: {user_profile.get('age', 24)}, Weight: {user_profile.get('weight', 75)} kg, Goal: {user_profile.get('goal', 'fat loss')}.
    Recent Activity: Workouts: {recent_activity.get('workouts', '0')}, Calories: {recent_activity.get('calories', '0')}, Steps: {recent_activity.get('steps', '0')}.
    """
    
    messages = [
        {"role": "system", "content": SYSTEM_INSTRUCTION},
    ]
    
    for msg in conversation_history[-4:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
        
    messages.append({
        "role": "user",
        "content": f"{context_prompt}\nUser Message: {current_message}"
    })
    
    for attempt in range(2):
        try:
            chat = client.chat.completions.create(
                messages=messages,
                model="llama-3.3-70b-versatile",
                temperature=0.5,
                max_tokens=100,
                timeout=5.0,
                response_format={"type": "json_object"}
            )
            raw = chat.choices[0].message.content.strip()
            parsed = json.loads(raw)
            
            if "intent" in parsed and "tone" in parsed and "response" in parsed:
                return parsed
            
            raise ValueError("Mismatched keys")
            
        except Exception as e:
            print("Chat API call failed or timed out:", e)
            if attempt == 0:
                messages.append({
                    "role": "user",
                    "content": "Return ONLY valid JSON."
                })
            else:
                return {
                    "intent": "general",
                    "tone": mode,
                    "response": "Try again",
                    "action": {
                        "type": "none",
                        "data": {}
                    }
                }

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
    - Do NOT use emojis under any circumstance. No emojis in your responses.
    - Be concise (max 2-3 lines)
    - Be realistic (no exaggeration)
    - If data is missing, acknowledge it
    - If performance is poor -> lightly roast
    - If good -> encourage
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
            temperature=0.5,
            max_tokens=100,
            timeout=5.0,
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
    Explain in 1-2 short lines how the score was built.

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
            temperature=0.5,
            max_tokens=60,
            timeout=5.0
        )
        return chat.choices[0].message.content.strip()
    except Exception:
        return f"+{workout_score:.0f} workout, +{diet_score:.0f} diet, +{steps_score:.0f} activity."