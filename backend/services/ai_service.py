import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def coach_chat(message: str, user_context: dict = None, mode: str = "coach"): # type: ignore
    
    personality = ""

    if mode == "roast":
        personality = """
You are a savage but funny fitness coach.
You roast laziness hard but never disrespect.
You push the user to work out.
Keep replies short and punchy.
"""
    else:
        personality = """
You are a supportive fitness coach.
You give clear, structured, practical advice.
Keep replies short and actionable.
"""

    system_prompt = f"""
{personality}

User profile:
{user_context}

Rules:
- Give fitness advice only
- Be concise
- No long paragraphs
- Focus on workouts + diet
"""

    completion = client.chat.completions.create(
        model="llama3-70b-8192",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message}
        ],
        temperature=0.7,
    )

    return completion.choices[0].message.content