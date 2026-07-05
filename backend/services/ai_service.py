import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """
You are a strict but funny fitness coach.
You give simple, practical advice.
You can roast lazy users lightly.
Keep answers short.
"""

# def ask_coach(message: str):
#     chat = client.chat.completions.create(
#         messages=[
#             {"role": "system", "content": SYSTEM_PROMPT},
#             {"role": "user", "content": message},
#         ],
#         model="llama3-8b-8192"
#     )

#     return chat.choices[0].message.content
def ask_coach(message: str):
    return "stop being lazy and do 10 pushups 😭"