import os
import sys

# Add current directory to python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.agents.explainer_agent import run_explainer
from app.agents.quiz_agent import run_quiz_generator

api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("Error: GROQ_API_KEY not found in environment!")
    sys.exit(1)

print("1. Testing Explainer Agent for Conversational input...")
res_chat_conv = run_explainer(
    question="Hello! Who are you and how can you help me today?",
    api_key=api_key,
)
print("Answer:")
print(res_chat_conv["answer"])
print("Used knowledge base:", res_chat_conv["used_knowledge_base"])
print("-" * 50)

print("2. Testing Explainer Agent for Technical input...")
res_chat_tech = run_explainer(
    question="Explain what Big O notation is.",
    api_key=api_key,
)
print("Answer:")
print(res_chat_tech["answer"])
print("Used knowledge base:", res_chat_tech["used_knowledge_base"])
print("-" * 50)

print("3. Testing Quiz Generator...")
res_quiz = run_quiz_generator(
    topic="Python Loops and Math calculations",
    api_key=api_key,
    difficulty="Intermediate",
    num_questions=3,
)
print("Questions generated:")
for q in res_quiz["questions"]:
    print(f"ID: {q['id']}")
    print(f"Q: {q['question']}")
    print(f"Options: {q['options']}")
    print(f"Correct: {q['correct_answer']}")
    print(f"Explanation: {q['explanation']}")
    print("-" * 20)
