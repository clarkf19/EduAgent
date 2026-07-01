"""
flashcard_agent.py
------------------
Spaced repetition flashcard generation agent.
"""

import json
import logging
import re
from typing import Optional, List

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from ..chroma_client import semantic_search

logger = logging.getLogger(__name__)

FLASHCARD_SYSTEM_PROMPT = """You are EduAgent's Flashcard Master — an expert at creating high-quality, memorable, and concise spaced repetition flashcards for STEM and technical subjects.

Generate exactly the number of flashcards requested. Each flashcard MUST follow this exact JSON format (return ONLY a JSON array, no extra text):

[
  {
    "front": "A concise question, term, or concept to define or solve.",
    "back": "A concise, clear answer explaining the concept."
  }
]

RULES FOR HIGH-QUALITY FLASHCARDS:
1. **Concise and Focused**: Each card should test exactly one concept, term, or equation. Keep the back of the card short, readable, and easy to memorize.
2. **Clear Question/Prompt**: The front should be clear, unambiguous, and formatted as a question or key term.
3. **No Placeholders**: Do not include any placeholder text. Return fully formed questions and detailed but concise answers.
4. **Output**: Return ONLY the raw JSON array. No markdown blocks, no leading/trailing explanations.
"""


def run_flashcard_generator(
    subject: str,
    api_key: str,
    topic: Optional[str] = None,
    num_cards: int = 5,
    user_id: Optional[int] = None,
) -> dict:
    """
    Generate flashcards from the user's knowledge base or general knowledge.
    """
    num_cards = min(max(1, num_cards), 20)
    query_topic = topic.strip() if (topic and topic.strip()) else subject

    # Step 1: Retrieve relevant context from ChromaDB if possible
    where_filter = {}
    if user_id is not None:
        where_filter["user_id"] = str(user_id)

    context_text = ""
    try:
        results = semantic_search(
            query=query_topic,
            n_results=4,
            where=where_filter if where_filter else None,
        )
        chunks = results.get("chunks", [])
        if chunks:
            context_parts = [chunk.get("text", "") for chunk in chunks]
            context_text = "\n\n".join(context_parts)
    except Exception as e:
        logger.warning(f"ChromaDB search failed for flashcards: {e}")

    # Step 2: Build prompt
    search_prompt = f"Subject: {subject}"
    if topic:
        search_prompt += f"\nSpecific Topic: {topic}"

    if context_text:
        user_content = f"""Generate {num_cards} flashcards for the following:
{search_prompt}

Use this knowledge base content as your primary source:
---
{context_text[:3000]}
---

Return ONLY the JSON array."""
    else:
        user_content = f"""Generate {num_cards} flashcards for the following:
{search_prompt}

Return ONLY the JSON array."""

    # Step 3: Call Groq
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=api_key,
        temperature=0.5,
        max_tokens=2048,
    )

    messages = [
        SystemMessage(content=FLASHCARD_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    # Step 4: Parse JSON response
    cards = _parse_cards(raw)

    return {
        "cards": cards,
        "subject": subject,
        "topic": topic,
        "num_cards": len(cards),
        "used_knowledge_base": bool(context_text),
        "model": "llama-3.3-70b-versatile (Groq)",
    }


def _parse_cards(raw: str) -> List[dict]:
    """Parse JSON response into a list of card dicts."""
    clean = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    
    try:
        cards = json.loads(clean)
        if isinstance(cards, list):
            return _validate_cards(cards)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\[.*\]", clean, re.DOTALL)
    if match:
        try:
            cards = json.loads(match.group())
            if isinstance(cards, list):
                return _validate_cards(cards)
        except json.JSONDecodeError:
            pass

    logger.error(f"Failed to parse flashcards JSON. Raw response: {raw[:500]}")
    return []


def _validate_cards(cards: List[dict]) -> List[dict]:
    """Ensure each card has front and back."""
    valid = []
    for c in cards:
        if not isinstance(c, dict):
            continue
        if "front" not in c or "back" not in c:
            continue
        valid.append({
            "front": c["front"].strip(),
            "back": c["back"].strip()
        })
    return valid
