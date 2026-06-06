"""
quiz_agent.py
-------------
Adaptive quiz generation agent.

Generates multiple-choice quiz questions from the user's knowledge base
or a given topic. Supports three difficulty levels: Beginner, Intermediate, Advanced.

Output format is structured JSON-parseable text for the frontend quiz engine.
"""

import os
import json
import logging
import re
from typing import Optional, List

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..chroma_client import semantic_search

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_PROMPT = """You are EduAgent's Quiz Master — an expert at creating educational assessments.

Generate exactly the number of multiple-choice questions requested. Each question MUST follow this exact JSON format (return ONLY a JSON array, no extra text):

[
  {
    "id": 1,
    "question": "What is...?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "Brief explanation of why A is correct.",
    "difficulty": "Beginner"
  }
]

Rules:
- Options MUST always start with A), B), C), D)
- correct_answer MUST be just the letter: A, B, C, or D
- Explanations should be 1-2 sentences, educational and clear
- Questions should test understanding, not just memorization
- For Advanced difficulty: include edge cases, complexity analysis, or design tradeoffs
- Return ONLY the JSON array. No markdown, no extra text."""


def run_quiz_generator(
    topic: str,
    api_key: str,
    difficulty: str = "Intermediate",
    num_questions: int = 5,
    user_id: Optional[int] = None,
) -> dict:
    """
    Generate an adaptive quiz from the user's knowledge base.
    
    Args:
        topic: Topic or concept to quiz on
        api_key: Google Gemini API key  
        difficulty: 'Beginner', 'Intermediate', or 'Advanced'
        num_questions: Number of questions to generate (1-10)
        user_id: Optional user ID to filter ChromaDB search
    
    Returns:
        dict with 'questions' list and metadata
    """
    num_questions = min(max(1, num_questions), 50)
    
    if difficulty not in ["Beginner", "Intermediate", "Advanced"]:
        difficulty = "Intermediate"

    # Step 1: Retrieve relevant context
    where_filter = {}
    if user_id is not None:
        where_filter["user_id"] = str(user_id)

    context_text = ""
    try:
        results = semantic_search(
            query=topic,
            n_results=4,
            where=where_filter if where_filter else None,
        )
        chunks = results.get("chunks", [])
        if chunks:
            context_parts = [chunk.get("text", "") for chunk in chunks]
            context_text = "\n\n".join(context_parts)
    except Exception as e:
        logger.warning(f"ChromaDB search failed for quiz: {e}")

    # Step 2: Build prompt
    difficulty_guidance = {
        "Beginner": "Focus on definitions, basic concepts, and simple facts. Questions should be straightforward.",
        "Intermediate": "Focus on application, comparison between concepts, and understanding of mechanisms.",
        "Advanced": "Focus on edge cases, performance tradeoffs, design decisions, and deep understanding.",
    }

    if context_text:
        user_content = f"""Generate {num_questions} {difficulty} level multiple-choice questions about: "{topic}"

Use this knowledge base content as your primary source:
---
{context_text[:3000]}
---

Difficulty guidance: {difficulty_guidance[difficulty]}

Return ONLY the JSON array."""
    else:
        user_content = f"""Generate {num_questions} {difficulty} level multiple-choice questions about: "{topic}"

Difficulty guidance: {difficulty_guidance[difficulty]}

Return ONLY the JSON array."""

    # Step 3: Call Gemini
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key,
        temperature=0.4,
        max_tokens=2048,
    )

    messages = [
        SystemMessage(content=QUIZ_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    # Step 4: Parse JSON response
    questions = _parse_questions(raw)

    return {
        "questions": questions,
        "topic": topic,
        "difficulty": difficulty,
        "num_questions": len(questions),
        "used_knowledge_base": bool(context_text),
        "model": "gemini-1.5-flash",
    }


def _parse_questions(raw: str) -> List[dict]:
    """Parse Gemini's JSON response into a list of question dicts."""
    # Strip markdown code fences if present
    clean = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    
    try:
        questions = json.loads(clean)
        if isinstance(questions, list):
            return _validate_questions(questions)
    except json.JSONDecodeError:
        pass

    # Try to extract JSON array with regex
    match = re.search(r"\[.*\]", clean, re.DOTALL)
    if match:
        try:
            questions = json.loads(match.group())
            if isinstance(questions, list):
                return _validate_questions(questions)
        except json.JSONDecodeError:
            pass

    logger.error(f"Failed to parse quiz JSON. Raw response: {raw[:500]}")
    return []


def _validate_questions(questions: List[dict]) -> List[dict]:
    """Ensure each question has the required fields."""
    valid = []
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        if not all(k in q for k in ["question", "options", "correct_answer"]):
            continue
        # Normalize
        q.setdefault("id", i + 1)
        q.setdefault("explanation", "")
        q.setdefault("difficulty", "Intermediate")
        valid.append(q)
    return valid
