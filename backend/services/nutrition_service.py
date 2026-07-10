import json
import re
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Setup Groq client locally to avoid circular dependencies
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Standardized deterministic calories database
CALORIE_MAP = {
    "egg": 70,
    "eggs": 70,
    "boiled egg": 70,
    "boiled eggs": 70,
    "roti": 120,
    "rotis": 120,
    "chapati": 120,
    "chapatis": 120,
    "rice": 130,
    "cooked rice": 130,
    "paneer": 265,
    "paneer sabzi": 265,
    "apple": 95,
    "apples": 95,
    "banana": 105,
    "bananas": 105,
    "milk": 60,
    "chicken": 165,
    "chicken breast": 165,
    "protein shake": 150,
    "salad": 50,
    "green salad": 50,
    "bread": 80,
    "bread slice": 80,
    "butter": 100,
    "curd": 100,
    "yogurt": 100,
    "oats": 150,
    "avocado": 160
}

# In-memory lookup cache to guarantee consistency for unknown foods
DYNAMIC_CALORIE_CACHE = {}

SYSTEM_INSTRUCTION = """You are a food identification AI.
Your ONLY job is to identify the food items in the user's input (image description or text) and estimate their raw quantities.
Do not calculate calories. Do not include descriptions.

Output STRICT JSON matching this format:
{
  "items": [
    {
      "name": "food item name",
      "quantity": 1.5
    }
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
    
    # Find first digits or decimal
    match = re.search(r'[-+]?\d*\.\d+|\d+', qty_str)
    if match:
        return float(match.group(0))
    return 1.0

def get_single_serving_calories(food_name: str) -> int:
    name_lower = food_name.lower().strip()
    
    # 1. Direct match in local map
    for key, kcal in CALORIE_MAP.items():
        if key == name_lower or (len(key) > 3 and key in name_lower):
            return kcal
            
    # 2. Check dynamic cache
    if name_lower in DYNAMIC_CALORIE_CACHE:
        return DYNAMIC_CALORIE_CACHE[name_lower]
        
    # 3. Query LLM for standard single serving estimation (cached for consistency)
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a calorie estimator. Return ONLY a single integer representing the calories in 1 standard serving of the food item. No other text."},
                {"role": "user", "content": f"Estimate calories for 1 standard serving of: {food_name}"}
            ],
            model="llama3-8b-8192",
            temperature=0.1
        )
        raw = chat_completion.choices[0].message.content.strip()
        match = re.search(r'\d+', raw)
        if match:
            kcal = int(match.group(0))
            DYNAMIC_CALORIE_CACHE[name_lower] = kcal
            return kcal
    except Exception:
        pass
        
    # 4. Fallback
    return 150

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
            model="llama3-8b-8192",
            temperature=0.5
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception:
        return "Good start! Pair your meal with plenty of water and daily exercise."

def analyze_food_text_ai(food_description: str):
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {"role": "user", "content": f"Analyze this food: {food_description}"},
            ],
            model="llama3-8b-8192",
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        raw_response = chat_completion.choices[0].message.content
        cleaned = clean_json_string(raw_response)
        parsed = json.loads(cleaned)
        
        items = parsed.get("items", [])
        processed_items, total_cals = calculate_calories(items)
        suggestion = generate_health_suggestion(processed_items)
        
        return {
            "items": processed_items,
            "total_calories": total_cals,
            "suggestion": suggestion
        }
    except Exception as e:
        return get_fallback_nutrition(food_description)

def analyze_food_image_ai(base64_image: str):
    if "," in base64_image:
        base64_image = base64_image.split(",")[1]

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": SYSTEM_INSTRUCTION},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Identify the food items and standard quantity in this image."},
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
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        raw_response = chat_completion.choices[0].message.content
        cleaned = clean_json_string(raw_response)
        parsed = json.loads(cleaned)
        
        items = parsed.get("items", [])
        processed_items, total_cals = calculate_calories(items)
        suggestion = generate_health_suggestion(processed_items)
        
        return {
            "items": processed_items,
            "total_calories": total_cals,
            "suggestion": suggestion
        }
    except Exception as e:
        return get_fallback_nutrition("scanned food")

def get_fallback_nutrition(description: str):
    return {
        "items": [
            {
                "name": description,
                "quantity": "1 serving",
                "calories": 350
            }
        ],
        "total_calories": 350,
        "suggestion": "Connection error: showing safe default calorie estimate. Try a fresh meal!"
    }
