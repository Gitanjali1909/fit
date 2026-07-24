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

FOOD_DATABASE = {
    "egg": {"unit": "piece", "calories_per_unit": 70},
    "roti": {"unit": "piece", "calories_per_unit": 120},
    "chapati": {"unit": "piece", "calories_per_unit": 120},
    "rice": {"unit": "bowl", "calories_per_unit": 200},
    "dal": {"unit": "bowl", "calories_per_unit": 180},
    "paneer": {"unit": "serving", "calories_per_unit": 265},
    "chicken": {"unit": "gram", "calories_per_unit": 1.65},
    "milk": {"unit": "cup", "calories_per_unit": 120},
    "banana": {"unit": "piece", "calories_per_unit": 105},
    "apple": {"unit": "piece", "calories_per_unit": 95},
    "bread": {"unit": "piece", "calories_per_unit": 80},
    "butter": {"unit": "gram", "calories_per_unit": 7.17},
    "curd": {"unit": "bowl", "calories_per_unit": 100},
    "oats": {"unit": "bowl", "calories_per_unit": 150},
    "avocado": {"unit": "piece", "calories_per_unit": 160},
    "salad": {"unit": "bowl", "calories_per_unit": 50},
    "protein shake": {"unit": "cup", "calories_per_unit": 150},
    "fish": {"unit": "gram", "calories_per_unit": 2.06},
    "almonds": {"unit": "piece", "calories_per_unit": 7},
    "egg whites": {"unit": "piece", "calories_per_unit": 17},
    "coffee": {"unit": "cup", "calories_per_unit": 2},
    "tea": {"unit": "cup", "calories_per_unit": 30}
}

PORTION_FACTORS = {
    "small": 0.8,
    "medium": 1.0,
    "large": 1.3
}

def normalize(name: str) -> str:
    n = name.lower().strip()
    if "egg" in n:
        if "white" in n:
            return "egg whites"
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
    if "chicken" in n:
        return "chicken"
    if "dal" in n or "lentil" in n:
        return "dal"
    return n

class FoodItemName(BaseModel):
    name: str

class FoodValidationResponse(BaseModel):
    is_food: bool
    items: List[FoodItemName]

SYSTEM_INSTRUCTION_TEXT = """You are a food validation and recognition system.
Analyze the input text.

Determine:
1. Is the text describing actual food items/meals/beverages? (true/false)
2. If true, extract all clearly mentioned food items. Do not guess, do not hallucinate unseen items.

Return ONLY a JSON response in the following format:
{
  "is_food": boolean,
  "items": [
    { "name": "string" }
  ]
}
"""

SYSTEM_INSTRUCTION_IMAGE = """You are a food validation and recognition system.
Analyze the image.

Determine:
1. Is the image depicting food/meals/beverages? (true/false)
2. If true, extract all clearly visible food items. Do not guess, do not hallucinate unseen items.

Return ONLY a JSON response in the following format:
{
  "is_food": boolean,
  "items": [
    { "name": "string" }
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
                {"role": "system", "content": "You are a calorie estimation API. Given a food name, estimate standard calories for 1 normal serving. Return ONLY an integer count of calories. If you are totally unsure, return 0. Do not write text, only the integer number."},
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

def calculate_calories(items_list: list, portion_size: str = "medium") -> dict:
    portion_factor = PORTION_FACTORS.get(portion_size.lower(), 1.0)
    processed_items = []
    total_calories = 0
    status = "success"
    
    for item in items_list:
        raw_name = item.get("name", "").lower().strip()
        if not raw_name:
            continue
            
        normalized_name = normalize(raw_name)
        
        # Check if in DB
        if normalized_name in FOOD_DATABASE:
            calories_per_unit = FOOD_DATABASE[normalized_name]["calories_per_unit"]
            calories = int(round(calories_per_unit * portion_factor))
            total_calories += calories
            processed_items.append({
                "name": normalized_name,
                "calories": calories,
                "estimated": False
            })
        else:
            # Try AI fallback estimation
            est_cals = estimate_item_calories_fallback(raw_name)
            if est_cals > 0:
                calories = int(round(est_cals * portion_factor))
                total_calories += calories
                processed_items.append({
                    "name": raw_name,
                    "calories": calories,
                    "estimated": True
                })
            else:
                status = "unknown_food"
                processed_items.append({
                    "name": f"{raw_name} (Food not recognized)",
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

def analyze_food_manual(name: str, quantity: float, portion_size: str = "medium") -> dict:
    normalized_name = normalize(name)
    portion_factor = PORTION_FACTORS.get(portion_size.lower(), 1.0)
    
    if normalized_name in FOOD_DATABASE:
        calories_per_unit = FOOD_DATABASE[normalized_name]["calories_per_unit"]
        calories = int(round(calories_per_unit * quantity * portion_factor))
        
        return {
            "status": "success",
            "items": [
                {
                    "name": normalized_name,
                    "calories": calories,
                    "estimated": False
                }
            ],
            "total_calories": calories,
            "suggestion": "Log recorded. Stay consistent with your diet!"
        }
    else:
        # Fallback estimation for custom manual entries
        est_cals = estimate_item_calories_fallback(name)
        if est_cals > 0:
            calories = int(round(est_cals * quantity * portion_factor))
            return {
                "status": "success",
                "items": [
                    {
                        "name": name,
                        "calories": calories,
                        "estimated": True
                    }
                ],
                "total_calories": calories,
                "suggestion": "Log recorded using AI estimated calories. Stay consistent!"
            }
        else:
            return {
                "status": "unknown_food",
                "items": [],
                "total_calories": 0,
                "suggestion": "Estimation unavailable for this meal. Please verify the food item spelling."
            }

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

def parse_and_validate_response(raw_response: str) -> dict:
    cleaned = clean_json_string(raw_response)
    parsed_dict = json.loads(cleaned)
    response_model = FoodValidationResponse(**parsed_dict)
    return {
        "is_food": response_model.is_food,
        "items": [item.dict() for item in response_model.items]
    }

def analyze_food_text_ai(food_description: str, portion_size: str = "medium"):
    for attempt in range(2):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTION_TEXT},
                    {"role": "user", "content": f"Analyze this food: {food_description}"},
                ],
                model="llama-3.3-70b-versatile",
                temperature=0,
                response_format={"type": "json_object"}
            )
            raw_response = chat_completion.choices[0].message.content
            print("AI RAW (text):", raw_response)
            
            validation = parse_and_validate_response(raw_response)
            print("AFTER VALIDATION (text):", validation)
            
            if not validation.get("is_food", False) or not validation.get("items", []):
                return {
                    "status": "not_food",
                    "items": [],
                    "total_calories": 0,
                    "suggestion": "No food detected in your description. Please try describing food."
                }
            
            calc_result = calculate_calories(validation.get("items", []), portion_size)
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

def analyze_food_image_ai(base64_image: str, portion_size: str = "medium"):
    if "," in base64_image:
        base64_image = base64_image.split(",")[1]

    for attempt in range(2):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": SYSTEM_INSTRUCTION_IMAGE},
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
            print("AI RAW (image):", raw_response)
            
            validation = parse_and_validate_response(raw_response)
            print("AFTER VALIDATION (image):", validation)
            
            if not validation.get("is_food", False) or not validation.get("items", []):
                return {
                    "status": "not_food",
                    "items": [],
                    "total_calories": 0,
                    "suggestion": "No food detected in this image. Please capture a clear meal photo."
                }
            
            calc_result = calculate_calories(validation.get("items", []), portion_size)
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
