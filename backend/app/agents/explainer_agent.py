"""
explainer_agent.py
------------------
RAG-based concept explainer agent.

Given a user question, it:
1. Performs semantic search on the ChromaDB knowledge base
2. Retrieves the top-k relevant text chunks from the user's uploaded documents
3. Passes them to Gemini as grounded context
4. Returns a detailed, markdown-formatted explanation

Falls back to general LLM knowledge if no relevant chunks found.
"""

import os
import logging
from typing import Optional

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

from ..chroma_client import semantic_search

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are EduAgent's Expert Tutor — a brilliant, encouraging, and highly adaptable AI teacher specializing in computer science, STEM subjects, and general knowledge.

Your role is to guide the student and explain concepts in deep, comprehensive detail. Avoid short summaries or overly brief responses.
- If the user's message is a greeting (e.g. "hi", "hello"), a social query (e.g. "how are you?", "who are you?"), or simple chit-chat, respond in a warm, welcoming, and natural conversational tone as an AI tutor. Do NOT force a conceptual explanation format (like analogies, step-by-step breakdowns, or a "Key Takeaway") for simple chat.
- For concept explanations, technical topics, or question solving, provide a thorough and detailed masterclass-level breakdown:
  - Explain the core motivation and "why" behind the concept.
  - Provide simple, relatable analogies to build intuition before moving into complex theory.
  - Provide a rigorous, step-by-step explanation of the theory, including any mathematical formulations, proofs, algorithms, or logical flows.
  - Include concrete code examples, pseudocode, or math equations formatted in LaTeX where appropriate.
  - Dive deep into sub-concepts, corner cases, and practical applications.
  - Use extensive markdown formatting (headers, bullet points, numbered lists, blockquotes, bold text) to keep the highly detailed output readable and structured.
  - Always end concept explanations with a prominent 2-3 sentence "**Key Takeaways**" section summarizing the core principles.

If context documents are provided, ground your explanation deeply in them, incorporating their specific facts, algorithms, definitions, and context. Cite page/section references using the format [Source N] frequently to anchor your detailed statements in the uploaded text.
If no context is available, draw from your vast general knowledge to answer the student's question with the same level of rigorous, comprehensive detail."""

def run_explainer(
    question: str,
    api_key: str,
    user_id: Optional[int] = None,
    subject_filter: Optional[str] = None,
) -> dict:
    """
    Run the concept explainer agent.
    
    Args:
        question: The student's question or concept to explain
        api_key: Google Gemini API key
        user_id: Optional user ID to filter ChromaDB search to user's docs
        subject_filter: Optional subject to filter search results
    
    Returns:
        dict with 'answer', 'sources', and 'model' keys
    """
    # Step 1: Retrieve relevant chunks from ChromaDB
    where_filter = {}
    if user_id is not None:
        where_filter["user_id"] = str(user_id)
    if subject_filter:
        where_filter["subject"] = subject_filter

    # If the question is a boilerplate "explain my notes" prompt, use a broader
    # search query so we actually retrieve content from the uploaded PDF.
    boilerplate_phrases = [
        "explain and summarize my uploaded",
        "summarize my uploaded",
        "explain my uploaded",
        "summarize my notes",
    ]
    search_query = question
    q_lower = question.lower()
    for phrase in boilerplate_phrases:
        if phrase in q_lower:
            # Use subject as the search query for broader retrieval
            search_query = subject_filter or "key concepts"
            break

    retrieved_chunks = []
    context_text = ""
    
    try:
        results = semantic_search(
            query=search_query,
            n_results=6,
            where=where_filter if where_filter else None,
        )
        retrieved_chunks = results.get("chunks", [])
        logger.info(f"ChromaDB search for '{search_query}' with filter {where_filter} returned {len(retrieved_chunks)} chunks.")
        
        if retrieved_chunks:
            context_parts = []
            for i, chunk in enumerate(retrieved_chunks, 1):
                meta = chunk.get("metadata", {})
                source_label = f"[Source {i}: {meta.get('filename', 'Document')}, Page {meta.get('page_number', '?')}]"
                context_parts.append(f"{source_label}\n{chunk.get('text', '')}")
            context_text = "\n\n---\n\n".join(context_parts)
    except Exception as e:
        logger.error(f"ChromaDB search failed: {e}. Proceeding without context.")

    # Step 2: Build prompt with retrieved context
    if context_text:
        user_content = f"""Please answer the following user query: "{question}"

Use these relevant notes from their uploaded document knowledge base to ground your response, citing them if applicable:

## Retrieved Context:
{context_text}"""
    else:
        user_content = f"""Please answer the following user query: "{question}"

No specific documents from the knowledge base are available. Please answer directly using your general knowledge."""

    # Step 3: Call Groq (free tier: 14,400 req/day)
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=api_key,
        temperature=0.3,
        max_tokens=4096,
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    response = llm.invoke(messages)
    answer = response.content

    # Step 4: Build source list for frontend citations
    sources = []
    for chunk in retrieved_chunks:
        meta = chunk.get("metadata", {})
        sources.append({
            "filename": meta.get("filename", "Unknown"),
            "page": str(meta.get("page_number", "?")),
            "subject": meta.get("subject", ""),
            "preview": chunk.get("text", "")[:120] + "...",
            "text": chunk.get("text", ""),
        })

    return {
        "answer": answer,
        "sources": sources,
        "model": "llama-3.3-70b-versatile (Groq)",
        "used_knowledge_base": bool(retrieved_chunks),
    }
