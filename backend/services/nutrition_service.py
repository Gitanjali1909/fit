import json
import re
import os
from typing import List
from groq import Groq
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

# Setup Groq client locally to avoid circular dependencies
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

CALORIE_MAP = {
    "egg": 70,
    "roti": 120,
    "rice": 130,
    "paneer": 265,
    "apple": 95,
    "banana": 105,
    "milk": 60,
    "chicken": 165,
    "protein shake": 150,
    "salad": 50,
    "bread": 80,
    "butter": 100,
    "curd": 100,
    "oats": 150,
    "avocado": 160
}

DYNAMIC_CALORIE_CACHE = {}

def normalize(name: str) -> str:
    n = name.lower().strip()
    if "egg" in n:
        return "egg"
    if "rice" in n:
        return "rice"
    if "roti" in n or "chapati" in n:
        return "roti"
    if "paneer" in n:
        return "paneer"
    if "apple" in n:
        return "apple"
    if "banana" in n:
        return "banana"
    if "milk" in n:
        return "milk"
    return n

class FoodItem(BaseModel):
    name: str
    quantity: float
    confidence: float = 1.0

class FoodResponse(BaseModel):
    items: List[FoodItem]

SYSTEM_INSTRUCTION = """You are a strict food extraction API.

You MUST return ONLY JSON.
No explanation. No text. No extra keys.

If unsure:
- return empty list []

Rules:
- Identify only clearly visible food
- Do NOT guess
- Do NOT hallucinate
- Do NOT estimate calories or nutrition

Format:
{
  "items": [
    { "name": "string", "quantity": number, "confidence": number }
  ]
}
"""

def clean_json_string(text: str) -> str:
    match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match_plain = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match_plain:
        return match_plain.group(1).strip()
    return text.strip()

def parse_quantity(qty_val) -> float:
    if isinstance(qty_val, (int, float)):
        return float(qty_val)
    if not qty_val:
        return 1.0
    qty_str = str(qty_val).lower().strip()
    
    if "half" in qty_str or "1/2" in qty_str:
        return 0.5
    if "quarter" in qty_str or "1/4" in qty_str:
        return 0.25
    if "double" in qty_str:
        return 2.0
    
    match = re.search(r'[-+]?\d*\.\d+|\d+', qty_str)
    if match:
        return float(match.group(0))
    return 1.0

def get_single_serving_calories(food_name: str) -> int:
    normalized_name = normalize(food_name)
    
    if normalized_name in CALORIE_MAP:
        return CALORIE_MAP[normalized_name]
        
    return 0 # Strict deterministic lookup - no guessing or fake fallbacks

def calculate_calories(items_list):
    processed_items = []
    total_calories = 0
    
    for item in items_list:
        name = item.get("name", "Unknown Food")
        qty = parse_quantity(item.get("quantity", 1.0))
        
        single_kcal = get_single_serving_calories(name)
        item_kcal = int(single_kcal * qty)
        total_calories += item_kcal
        
        processed_items.append({
            "name": name,
            "quantity": f"{qty} serving(s)" if qty != 1 else "1 serving",
            "calories": item_kcal
        })
        
    return processed_items, total_calories

def generate_health_suggestion(items_list) -> str:
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a supportive nutrition coach. Give a short, one-sentence healthy suggestion based on this meal. Keep it to 15 words or less."},
                {"role": "user", "content": f"Meal items: {items_list}"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.5
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception:
        return "Good start! Pair your meal with plenty of water and daily exercise."

def validate_items(items_list: List[FoodItem]) -> List[dict]:
    clean = []
    for item in items_list:
        name = item.name.lower().strip()
        qty = item.quantity
        
        if not name or not isinstance(qty, (int, float)):
            continue
        if qty <= 0 or qty > 20:
            continue
        if item.confidence < 0.6:
            continue
            
        clean.append({
            "name": name,
            "quantity": qty
        })
    return clean

def parse_and_validate_response(raw_response: str) -> List[dict]:
    cleaned = clean_json_string(raw_response)
    parsed_dict = json.loads(cleaned)
    response_model = FoodResponse(**parsed_dict)
    return validate_items(response_model.items)

def analyze_food_text_ai(food_description: str):
    for attempt in range(2):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTION},
                    {"role": "user", "content": f"Analyze this food: {food_description}"},
                ],
                model="llama-3.3-70b-versatile",
                temperature=0,
                response_format={"type": "json_object"}
            )
            raw_response = chat_completion.choices[0].message.content
            print("AI RAW (text):", raw_response)
            
            items = parse_and_validate_response(raw_response)
            print("AFTER VALIDATION (text):", items)
            
            processed_items, total_cals = calculate_calories(items)
            print("FINAL CALC (text):", processed_items, "Total:", total_cals)
            
            suggestion = generate_health_suggestion(processed_items)
            
            return {
                "items": processed_items,
                "total_calories": total_cals,
                "suggestion": suggestion
            }
        except Exception as e:
            print(f"Text analysis failed on attempt {attempt+1}: {e}")
            if attempt == 1:
                return get_fallback_nutrition(food_description)

def analyze_food_image_ai(base64_image: str):
    if "," in base64_image:
        base64_image = base64_image.split(",")[1]

    for attempt in range(2):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTION},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Extract all food items, standard portion quantity, and your confidence score from this image."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                model="llama-3.2-11b-vision-preview",
                temperature=0,
                response_format={"type": "json_object"}
            )
            raw_response = chat_completion.choices[0].message.content
            print("AI RAW (image):", raw_response)
            
            items = parse_and_validate_response(raw_response)
            print("AFTER VALIDATION (image):", items)
            
            processed_items, total_cals = calculate_calories(items)
            print("FINAL CALC (image):", processed_items, "Total:", total_cals)
            
            suggestion = generate_health_suggestion(processed_items)
            
            return {
                "items": processed_items,
                "total_calories": total_cals,
                "suggestion": suggestion
            }
        except Exception as e:
            print(f"Image analysis failed on attempt {attempt+1}: {e}")
            if attempt == 1:
                return get_fallback_nutrition("scanned food")

def get_fallback_nutrition(description: str):
    return {
        "items": [],
        "total_calories": 0,
        "suggestion": "Estimation unavailable for this meal. Please verify the food item spelling."
    }
