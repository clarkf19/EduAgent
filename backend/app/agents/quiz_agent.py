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

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from ..chroma_client import semantic_search

logger = logging.getLogger(__name__)

QUIZ_SYSTEM_PROMPT = """You are EduAgent's Quiz Master — a world-class creator of academic STEM and technical assessments.

Generate exactly the number of multiple-choice questions requested. Each question MUST follow this exact JSON format (return ONLY a JSON array, no extra text):

[
  {
    "id": 1,
    "question": "What is...?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": "A",
    "explanation": "Detailed step-by-step mathematical calculation, code tracing path, or logical deduction showing why A is correct.",
    "difficulty": "Beginner"
  }
]

RULES FOR HIGH-QUALITY & APPLIED QUESTIONS:
1. **At least 50% of the questions MUST be sum-solving, numeric computation, code execution tracing, or logical puzzle questions** where the student must compute a value, trace a loop/recursion, analyze a function, or calculate a metric (e.g. math calculations, probability, Big-O space/time complexity math, data structure capacity, electrical or networking sums, code output prediction). Avoid pure term definition questions.
2. **Options** MUST start with A), B), C), D). Ensure all options are plausible, distinct, and relate directly to the question (no jokes, and avoid simple "all of the above" or "none of the above").
3. **Correct Answer** MUST be a single letter: A, B, C, or D.
4. **Detailed Explanation**: If the question involves a calculation or code trace, the explanation MUST write out the step-by-step calculations or line-by-line code execution path so that the student learns the exact reasoning.
5. **Difficulty Guidelines**:
   - **Beginner**: Straightforward calculations, basic formulas, or short code snippet traces (1-3 lines).
   - **Intermediate**: Multi-step calculations, loops or nested loops traces, comparative analysis with multiple features.
   - **Advanced**: Complex calculations (e.g., networking subnet math, advanced algorithmic complexity, probability), recursive code traces, edge cases, system design tradeoffs.
6. **Output**: Return ONLY the raw JSON array. No markdown blocks, no leading/trailing explanation."""


def run_quiz_generator(
    topic: str,
    api_key: str,
    difficulty: str = "Intermediate",
    num_questions: int = 5,
    user_id: Optional[int] = None,
    subject: Optional[str] = None,
) -> dict:
    """
    Generate an adaptive quiz from the user's knowledge base.
    
    Args:
        topic: Topic or concept to quiz on
        api_key: Google Gemini API key  
        difficulty: 'Beginner', 'Intermediate', or 'Advanced'
        num_questions: Number of questions to generate (1-10)
        user_id: Optional user ID to filter ChromaDB search
        subject: Optional subject name to filter search
    
    Returns:
        dict with 'questions' list and metadata
    """
    num_questions = min(max(1, num_questions), 50)
    
    if difficulty not in ["Beginner", "Intermediate", "Advanced"]:
        difficulty = "Intermediate"

    topic = topic.strip() or "your uploaded study materials"

    # Step 1: Retrieve relevant context
    where_filter = {}
    if user_id is not None:
        where_filter["user_id"] = str(user_id)
    if subject and subject != "All Subjects":
        where_filter["subject"] = subject

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
        "Beginner": "Simple and straightforward problem solving, basic calculations, or simple 1-3 line code execution tracing.",
        "Intermediate": "Multi-step calculations, logic puzzles, loop analysis, function outputs, or comparative STEM problems.",
        "Advanced": "High-complexity calculations (e.g., probability, networking formulas, advanced math sums), recursion tracing, edge cases, and performance tradeoffs.",
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

    # Step 3: Call Groq (free tier: 14,400 req/day)
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=api_key,
        temperature=0.4,
        max_tokens=4096,
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
        "model": "llama-3.3-70b-versatile (Groq)",
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
