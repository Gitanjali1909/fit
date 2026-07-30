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

FOOD_DB = {
    "egg": {"calories_per_unit": 70, "unit": "piece"},
    "boiled egg": {"calories_per_unit": 70, "unit": "piece"},
    "omelette": {"calories_per_unit": 150, "unit": "piece"},
    "roti": {"calories_per_unit": 120, "unit": "piece"},
    "chapati": {"calories_per_unit": 120, "unit": "piece"},
    "rice": {"calories_per_unit": 200, "unit": "bowl"},
    "jeera rice": {"calories_per_unit": 220, "unit": "bowl"},
    "dal": {"calories_per_unit": 180, "unit": "bowl"},
    "dal tadka": {"calories_per_unit": 220, "unit": "bowl"},
    "paneer": {"calories_per_unit": 265, "unit": "gram"},
    "paneer butter masala": {"calories_per_unit": 320, "unit": "bowl"},
    "chicken": {"calories_per_unit": 250, "unit": "gram"},
    "chicken curry": {"calories_per_unit": 300, "unit": "bowl"},
    "grilled chicken": {"calories_per_unit": 220, "unit": "gram"},
    "fish": {"calories_per_unit": 200, "unit": "gram"},
    "fried fish": {"calories_per_unit": 300, "unit": "gram"},
    "biryani": {"calories_per_unit": 350, "unit": "bowl"},
    "veg biryani": {"calories_per_unit": 300, "unit": "bowl"},
    "poha": {"calories_per_unit": 250, "unit": "bowl"},
    "upma": {"calories_per_unit": 230, "unit": "bowl"},
    "idli": {"calories_per_unit": 60, "unit": "piece"},
    "dosa": {"calories_per_unit": 180, "unit": "piece"},
    "masala dosa": {"calories_per_unit": 250, "unit": "piece"},
    "vada": {"calories_per_unit": 150, "unit": "piece"},
    "samosa": {"calories_per_unit": 260, "unit": "piece"},
    "pakora": {"calories_per_unit": 200, "unit": "plate"},
    "paratha": {"calories_per_unit": 250, "unit": "piece"},
    "aloo paratha": {"calories_per_unit": 300, "unit": "piece"},
    "butter naan": {"calories_per_unit": 260, "unit": "piece"},
    "naan": {"calories_per_unit": 220, "unit": "piece"},
    "rajma": {"calories_per_unit": 220, "unit": "bowl"},
    "chole": {"calories_per_unit": 250, "unit": "bowl"},
    "bhindi": {"calories_per_unit": 150, "unit": "bowl"},
    "aloo sabzi": {"calories_per_unit": 180, "unit": "bowl"},
    "mixed veg": {"calories_per_unit": 150, "unit": "bowl"},
    "palak paneer": {"calories_per_unit": 280, "unit": "bowl"},
    "kadhi": {"calories_per_unit": 200, "unit": "bowl"},
    "curd": {"calories_per_unit": 100, "unit": "bowl"},
    "lassi": {"calories_per_unit": 180, "unit": "glass"},
    "milk": {"calories_per_unit": 120, "unit": "cup"},
    "tea": {"calories_per_unit": 80, "unit": "cup"},
    "coffee": {"calories_per_unit": 50, "unit": "cup"},
    "banana": {"calories_per_unit": 105, "unit": "piece"},
    "apple": {"calories_per_unit": 95, "unit": "piece"},
    "mango": {"calories_per_unit": 200, "unit": "piece"},
    "orange": {"calories_per_unit": 80, "unit": "piece"},
    "bread": {"calories_per_unit": 70, "unit": "slice"},
    "butter": {"calories_per_unit": 100, "unit": "gram"},
    "jam": {"calories_per_unit": 50, "unit": "tablespoon"},
    "cake": {"calories_per_unit": 300, "unit": "slice"},
    "ice cream": {"calories_per_unit": 200, "unit": "cup"},
    "chocolate": {"calories_per_unit": 150, "unit": "bar"},
    "salad": {"calories_per_unit": 50, "unit": "bowl"}
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

def normalize_food(name: str) -> str:
    name = name.lower().strip()

    # Normalization mappings
    if "coffee" in name:
        return "coffee"
    if "tea" in name:
        return "tea"
    if "egg" in name:
        return "egg"
    if "roti" in name or "chapati" in name:
        return "roti"
    if "rice" in name:
        return "rice"
    if "dal" in name or "daal" in name:
        return "dal"
    if "paneer" in name:
        return "paneer"
    if "chicken" in name:
        return "chicken"
    if "salad" in name:
        return "salad"
    if "banana" in name:
        return "banana"
    if "apple" in name:
        return "apple"
    if "bread" in name:
        return "bread"
    if "butter" in name:
        return "butter"
    if "milk" in name:
        return "milk"

    return name

def match_food(name: str) -> str:
    name = name.lower()
    
    # First match direct normalization keys
    normalized = normalize_food(name)
    if normalized in FOOD_DB:
        return normalized

    # Then check substring matches in database
    for key in FOOD_DB:
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

# Vision models expect only item names. Quantities default to 1 on backend.
class FoodItemVisionName(BaseModel):
    name: str

class FoodVisionResponse(BaseModel):
    status: str
    items: List[FoodItemVisionName]

# Text models extract both food names and mentioned quantities.
class FoodItemTextNameQty(BaseModel):
    name: str
    quantity: float

class FoodTextResponse(BaseModel):
    status: str
    items: List[FoodItemTextNameQty]

VISION_SYSTEM_INSTRUCTION = """You are a FOOD VISION DETECTOR.

Your job is NOT to be smart.
Your job is to be STRICT and RELIABLE.

Step 1: Determine if the image contains FOOD.

Rules:
- If NO food -> return:
  { "status": "not_food", "items": [] }

- Do NOT guess
- Do NOT hallucinate
- Humans, objects, random scenes = NOT FOOD

---

Step 2: If food is present

Extract ONLY clearly visible food items.

Rules:
- Keep it simple (1-3 items max)
- Use common names (rice, egg, roti, cake, etc.)
- Do NOT add items that are not clearly visible

---

Step 3: Output STRICT JSON ONLY

{
  "status": "success",
  "items": [
    { "name": "string" }
  ]
}

---

IMPORTANT:
- Do NOT calculate calories
- Do NOT estimate quantity
- Do NOT explain anything
- If unsure -> return empty list
"""

TEXT_SYSTEM_INSTRUCTION = """You are a FOOD TEXT DETECTOR.

Your job is to identify common, real-world food items and their quantities from the description.

Step 1: Determine if the text describes FOOD.

Rules:
- If NO food -> return:
  { "status": "not_food", "items": [] }

- Do NOT guess
- Do NOT hallucinate

---

Step 2: If food is present

Extract food items and their mentioned quantities.

Rules:
- Keep it simple (1-3 items max)
- Use common names (rice, egg, roti, etc.)
- Extract numbers if clearly present, otherwise default to 1.

---

Step 3: Output STRICT JSON ONLY

{
  "status": "success",
  "items": [
    { "name": "string", "quantity": number }
  ]
}

---

IMPORTANT:
- Do NOT calculate calories
- Do NOT explain anything
- If unsure -> return empty list
"""

def clean_json_string(text: str) -> str:
    match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match_plain = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if match_plain:
        return match_plain.group(1).strip()
    return text.strip()

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
        
        # Check if in FOOD_DB and quantity is valid
        if matched and matched in FOOD_DB and qty > 0:
            calories_per_unit = FOOD_DB[matched]["calories_per_unit"]
            calories = int(round(calories_per_unit * qty))
            total_calories += calories
            processed_items.append({
                "name": matched,
                "quantity": qty,
                "calories": calories,
                "estimated": False
            })
        else:
            # If any item cannot be matched in DB -> reject immediately
            status = "rejected"
            break
                
    if not processed_items:
        status = "rejected"
        
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

def parse_and_validate_vision_response(raw_response: str) -> dict:
    cleaned = clean_json_string(raw_response)
    parsed_dict = json.loads(cleaned)
    response_model = FoodVisionResponse(**parsed_dict)
    return {
        "status": response_model.status,
        "items": [{"name": item.name, "quantity": 1.0} for item in response_model.items]
    }

def parse_and_validate_text_response(raw_response: str) -> dict:
    cleaned = clean_json_string(raw_response)
    parsed_dict = json.loads(cleaned)
    response_model = FoodTextResponse(**parsed_dict)
    return {
        "status": response_model.status,
        "items": [item.dict() for item in response_model.items]
    }

def analyze_food_text_ai(food_description: str):
    for attempt in range(2):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": TEXT_SYSTEM_INSTRUCTION},
                    {"role": "user", "content": f"Analyze this food: {food_description}"},
                ],
                model="llama-3.3-70b-versatile",
                temperature=0,
                response_format={"type": "json_object"}
            )
            raw_response = chat_completion.choices[0].message.content
            print("AI RESPONSE:", raw_response)
            
            parsed = parse_and_validate_text_response(raw_response)
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
                return {
                    "status": "error",
                    "items": [],
                    "total_calories": 0,
                    "suggestion": "Text description analysis failed. Please try describing simplified items."
                }

def analyze_food_image_ai(base64_image: str):
    if not base64_image or not base64_image.strip():
        return {
            "status": "rejected",
            "items": [],
            "total_calories": 0,
            "suggestion": "No image data provided."
        }

    # Debug logs
    print("BASE64 LENGTH:", len(base64_image))
    raw_image_data = base64_image
    if "," in raw_image_data:
        raw_image_data = raw_image_data.split(",")[1]
    image_size_bytes = len(raw_image_data) * 3 // 4
    print("IMAGE SIZE (bytes):", image_size_bytes)

    for attempt in range(2):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": VISION_SYSTEM_INSTRUCTION},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Determine if this image contains food, and extract visible items."},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{raw_image_data}"
                                }
                            }
                        ]
                    }
                ],
                model="qwen/qwen3.6-27b",
                temperature=0,
                response_format={"type": "json_object"}
            )
            raw_response = chat_completion.choices[0].message.content
            print("AI RESPONSE:", raw_response)
            
            parsed = parse_and_validate_vision_response(raw_response)
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
                return {
                    "status": "error",
                    "items": [],
                    "total_calories": 0,
                    "suggestion": "Image analysis failed. Please try manual text entry or ensure your image is clear."
                }
