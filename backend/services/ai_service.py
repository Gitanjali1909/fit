import os
import json
from typing import Optional
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_INSTRUCTION = """You are an AI fitness coach inside a fitness app called "Fit".

Your behavior is STRICTLY controlled.

-----------------------------------
CORE RULES:

1. You MUST stay consistent in tone:
- Default tone: calm, direct, slightly strict
- If user is consistent → supportive
- If user is lazy → light roast (NOT toxic, NOT abusive)
- NEVER switch randomly

2. You MUST NOT drift:
- No jokes unless in roast mode
- No unrelated advice
- No long paragraphs

3. You MUST REMEMBER CONTEXT:
You will use the provided user profile, recent activity data, and conversation history in your response.

4. You MUST classify user intent BEFORE responding.

-----------------------------------
PLAN GENERATION RULES (STRICT):

- Do NOT generate full structured plans by default.
- Do NOT include sections like:
  - Goal
  - Workout Routine
  - Nutrition Protocol
- Do NOT return empty sections or placeholders.

ONLY generate a structured plan IF:
- user explicitly asks for a plan (e.g. "give me a plan", "diet plan", "workout routine")

IF NOT explicitly asked:
- respond conversationally
- give short, direct advice only
- no structured blocks
- no formatting for UI cards
- "action.type" MUST be "none"

-----------------------------------
INTENTS:

Classify user message into ONE:
- "plan_request" → user wants diet/workout plan (action.type = "update_plan")
- "progress_update" → user shares activity/food/workout
- "question" → user asks something
- "motivation" → user feels lazy/unmotivated
- "general" → anything else

-----------------------------------
OUTPUT FORMAT (STRICT JSON ONLY)

You MUST return ONLY JSON. No text outside JSON.

{
  "intent": "one of the intents",
  "tone": "coach" | "roast",
  "response": "short message to user",
  "action": {
    "type": "none" | "update_plan",
    "data": {
      "plan_summary": "short and clean summary only (present ONLY if type is update_plan)"
    }
  }
}

-----------------------------------
BEHAVIOR RULES:
- Keep response under 2–3 lines
- Be specific (use user data if available)
- Do NOT hallucinate numbers
- Do NOT repeat same advice
- If unsure → say less, not more
"""

def ask_coach(user_profile: dict, recent_activity: dict, conversation_history: list, current_message: str, mode: str = "coach") -> dict:
    context_prompt = f"""
    User Profile:
    - Age: {user_profile.get('age', 24)}
    - Weight: {user_profile.get('weight', 75)} kg
    - Goal: {user_profile.get('goal', 'fat loss')}
    
    Recent Activity today:
    - Workouts: {recent_activity.get('workouts', '0')}
    - Calories: {recent_activity.get('calories', '0')}
    - Steps: {recent_activity.get('steps', '0')}
    """
    
    messages = [
        {"role": "system", "content": SYSTEM_INSTRUCTION},
    ]
    
    for msg in conversation_history[-6:]:
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
                temperature=0.2 if mode == "coach" else 0.5,
                response_format={"type": "json_object"}
            )
            raw = chat.choices[0].message.content.strip()
            parsed = json.loads(raw)
            
            if "intent" in parsed and "tone" in parsed and "response" in parsed:
                return parsed
            
            raise ValueError("Mismatched keys in response schema")
            
        except Exception as e:
            if attempt == 0:
                messages.append({
                    "role": "user",
                    "content": "Return ONLY valid JSON. Fix format."
                })
            else:
                return {
                    "intent": "general",
                    "tone": mode,
                    "response": "Keep moving! Let's get up and hit the reps tomorrow.",
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