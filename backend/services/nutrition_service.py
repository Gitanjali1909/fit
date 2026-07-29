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
    "boiled egg": 70,
    "omelette": 150,
    "roti": 120,
    "chapati": 120,
    "rice": 200,
    "jeera rice": 220,
    "dal": 180,
    "dal tadka": 220,
    "paneer": 265,
    "paneer butter masala": 320,
    "chicken": 250,
    "chicken curry": 300,
    "grilled chicken": 220,
    "fish": 200,
    "fried fish": 300,
    "biryani": 350,
    "veg biryani": 300,
    "poha": 250,
    "upma": 230,
    "idli": 60,
    "dosa": 180,
    "masala dosa": 250,
    "vada": 150,
    "samosa": 260,
    "pakora": 200,
    "paratha": 250,
    "aloo paratha": 300,
    "butter naan": 260,
    "naan": 220,
    "rajma": 220,
    "chole": 250,
    "bhindi": 150,
    "aloo sabzi": 180,
    "mixed veg": 150,
    "palak paneer": 280,
    "kadhi": 200,
    "curd": 100,
    "lassi": 180,
    "milk": 120,
    "tea": 80,
    "coffee": 50,
    "banana": 105,
    "apple": 95,
    "mango": 200,
    "orange": 80,
    "bread": 70,
    "butter": 100,
    "jam": 50,
    "cake": 300,
    "ice cream": 200,
    "chocolate": 150
}

def clean_name(name: str) -> str:
    words_to_remove = [
        "slice", "piece", "of", "with",
        "fresh", "delicious", "homemade"
    ]
    name = name.lower()
    for w in words_to_remove:
        name = name.replace(w, " ")
    name = re.sub(r'\s+', ' ', name)
    return name.strip()

def match_food(name: str) -> str:
    name = name.lower()
    for key in CALORIE_MAP:
        if key in name:
            return key
    
    # extra fallback (VERY IMPORTANT)
    if "cake" in name:
        return "cake"
    if "ice cream" in name:
        return "ice cream"
    if "chocolate" in name:
        return "chocolate"
        
    return None

def normalize_food(name: str) -> str:
    name = name.lower().strip()

    if "egg" in name:
        return "egg"
    if "roti" in name or "chapati" in name:
        return "roti"
    if "rice" in name:
        return "rice"
    if "dal" in name:
        return "dal"
    if "paneer" in name:
        return "paneer"

    return name

class FoodItemNameQty(BaseModel):
    name: str
    quantity: float

class FoodDetectionResponse(BaseModel):
    status: str
    items: List[FoodItemNameQty]

MASTER_SYSTEM_INSTRUCTION = """You are a FOOD DETECTION module for a fitness app.

Your job is ONLY to identify food items.
NOT calories. NOT nutrition.

STRICT RULES:

1. First decide:
   Is this FOOD or NOT?

- If NOT food -> return:
  { "status": "not_food", "items": [] }

2. If it IS food:

- Identify only clearly visible food items
- Do NOT guess
- Do NOT hallucinate
- Keep list small and realistic
- Return ONLY simple food names. Use common names only (e.g. "cake", "rice", "dal"). Do NOT describe. Do NOT add adjectives. Do NOT say "slice of", "piece of", "delicious", etc.
  - BAD: "slice of chocolate cake with frosting"
  - GOOD: "cake"

3. Quantity rules:

- For image inputs:
  ALWAYS return quantity = 1
- For text inputs:
  extract numbers if clearly present

4. Output ONLY JSON in this format:
{
  "status": "success",
  "items": [
    { "name": "food_name", "quantity": number }
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

def estimate_item_calories_fallback(item_name: str) -> int:
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a calorie estimation API. Given a food name, estimate standard calories for 1 normal serving. Return ONLY an integer count of calories. If you are totally unsure, return 0. Do not write text, only the integer number. Do not use emojis."},
                {"role": "user", "content": f"Food item: {item_name}"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1
        )
        raw_response = chat_completion.choices[0].message.content.strip()
        match = re.search(r'\d+', raw_response)
        if match:
            return int(match.group(0))
        return 0
    except Exception:
        return 0

def calculate_calories(items_list: list) -> dict:
    processed_items = []
    total_calories = 0
    status = "success"
    
    for item in items_list:
        raw_name = item.get("name", "").lower().strip()
        qty = item.get("quantity", 1.0)
        if not raw_name:
            continue
            
        cleaned = clean_name(raw_name)
        matched = match_food(cleaned)
        
        print("RAW:", raw_name)
        print("CLEAN:", cleaned)
        print("MATCH:", matched)
        
        # Check if in CALORIE_MAP
        if matched and matched in CALORIE_MAP:
            normalized_name = normalize_food(matched)
            calories_per_unit = CALORIE_MAP[normalized_name]
            calories = int(round(calories_per_unit * qty))
            total_calories += calories
            processed_items.append({
                "name": normalized_name,
                "quantity": qty,
                "calories": calories,
                "estimated": False
            })
        else:
            # Try AI fallback estimation
            est_cals = estimate_item_calories_fallback(cleaned)
            if est_cals > 0:
                calories = int(round(est_cals * qty))
                total_calories += calories
                processed_items.append({
                    "name": cleaned,
                    "quantity": qty,
                    "calories": calories,
                    "estimated": True
                })
            else:
                status = "unknown_food"
                processed_items.append({
                    "name": f"{raw_name} (Food not recognized)",
                    "quantity": qty,
                    "calories": 0,
                    "estimated": True
                })
                
    if not processed_items:
        status = "unknown_food"
    elif any(i["calories"] == 0 for i in processed_items):
        status = "unknown_food"
        
    return {
        "status": status,
        "items": processed_items if status == "success" else [],
        "total_calories": total_calories if status == "success" else 0
    }

def generate_health_suggestion(items_list) -> str:
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are a supportive nutrition coach. Give a short, one-sentence healthy suggestion based on this meal. Keep it to 15 words or less. Do not use emojis."},
                {"role": "user", "content": f"Meal items: {items_list}"}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.5
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception:
        return "Good start. Pair your meal with plenty of water and daily exercise."

def parse_and_validate_response(raw_response: str) -> dict:
    cleaned = clean_json_string(raw_response)
    parsed_dict = json.loads(cleaned)
    response_model = FoodDetectionResponse(**parsed_dict)
    return {
        "status": response_model.status,
        "items": [item.dict() for item in response_model.items]
    }

def analyze_food_text_ai(food_description: str):
    for attempt in range(2):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": MASTER_SYSTEM_INSTRUCTION},
                    {"role": "user", "content": f"Analyze this food: {food_description}"},
                ],
                model="llama-3.3-70b-versatile",
                temperature=0,
                response_format={"type": "json_object"}
            )
            raw_response = chat_completion.choices[0].message.content
            print("AI RESPONSE:", raw_response)
            
            parsed = parse_and_validate_response(raw_response)
            print("AFTER PARSING (text):", parsed)
            
            if parsed.get("status") == "not_food" or not parsed.get("items", []):
                return {
                    "status": "not_food",
                    "items": [],
                    "total_calories": 0,
                    "suggestion": "No food detected in your description. Please try describing food."
                }
            
            calc_result = calculate_calories(parsed.get("items", []))
            print("FINAL CALC (text):", calc_result)
            
            suggestion = generate_health_suggestion(calc_result.get("items", []))
            
            return {
                "status": calc_result.get("status", "success"),
                "items": calc_result.get("items", []),
                "total_calories": calc_result.get("total_calories", 0),
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
                    {"role": "system", "content": MASTER_SYSTEM_INSTRUCTION},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Determine if this image contains food, and extract visible items."},
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
            print("AI RESPONSE:", raw_response)
            
            parsed = parse_and_validate_response(raw_response)
            print("AFTER PARSING (image):", parsed)
            
            if parsed.get("status") == "not_food" or not parsed.get("items", []):
                return {
                    "status": "not_food",
                    "items": [],
                    "total_calories": 0,
                    "suggestion": "No food detected in this image. Please capture a clear meal photo."
                }
            
            calc_result = calculate_calories(parsed.get("items", []))
            print("FINAL CALC (image):", calc_result)
            
            suggestion = generate_health_suggestion(calc_result.get("items", []))
            
            return {
                "status": calc_result.get("status", "success"),
                "items": calc_result.get("items", []),
                "total_calories": calc_result.get("total_calories", 0),
                "suggestion": suggestion
            }
        except Exception as e:
            print(f"Image analysis failed on attempt {attempt+1}: {e}")
            if attempt == 1:
                return get_fallback_nutrition("scanned food")

def get_fallback_nutrition(description: str):
    return {
        "status": "unknown_food",
        "items": [],
        "total_calories": 0,
        "suggestion": "Estimation unavailable for this meal. Please verify the food item spelling."
    }
