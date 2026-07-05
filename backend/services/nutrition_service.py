import json
import re
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Setup Groq client locally to avoid circular dependencies
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def clean_json_string(text: str) -> str:
    # Strip markdown code blocks if the model outputs them
    match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match_plain = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match_plain:
        return match_plain.group(1).strip()
    return text.strip()

def analyze_food_ai(food_description: str):
    prompt = f"""You are a nutrition expert.

User input: "{food_description}"

Return STRICT JSON:
{{
  "food": "name",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "tip": "short advice"
}}

Rules:
- realistic values
- no explanation outside JSON"""

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "user", "content": prompt},
            ],
            model="llama3-8b-8192",
            temperature=0.2,
            response_format={"type": "json_object"}  # Groq JSON Mode
        )
        raw_response = chat_completion.choices[0].message.content
        cleaned = clean_json_string(raw_response)
        parsed = json.loads(cleaned)
        return parsed
    except Exception as e:
        # Structured fallback if AI call fails or key is missing
        return {
            "food": food_description,
            "calories": 400,
            "protein": 15,
            "carbs": 45,
            "fat": 12,
            "tip": "Error reaching AI nutrition layer. Showing default estimate."
        }
