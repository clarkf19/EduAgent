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

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..chroma_client import semantic_search

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are EduAgent's Expert Tutor — a brilliant, encouraging AI teacher specializing in computer science and STEM subjects.

Your role is to explain concepts clearly using:
- Simple analogies before complex theory
- Step-by-step breakdowns
- Concrete examples and pseudocode where relevant
- Markdown formatting (headers, bullet points, code blocks)

If context documents are provided, ground your explanation in them and cite page/section references. 
If no context is available, draw from your general knowledge.

Always end with a 1-2 sentence "Key Takeaway" in bold."""

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

    retrieved_chunks = []
    context_text = ""
    
    try:
        results = semantic_search(
            query=question,
            n_results=5,
            where=where_filter if where_filter else None,
        )
        retrieved_chunks = results.get("chunks", [])
        
        if retrieved_chunks:
            context_parts = []
            for i, chunk in enumerate(retrieved_chunks, 1):
                meta = chunk.get("metadata", {})
                source_label = f"[Source {i}: {meta.get('filename', 'Document')}, Page {meta.get('page_number', '?')}]"
                context_parts.append(f"{source_label}\n{chunk.get('text', '')}")
            context_text = "\n\n---\n\n".join(context_parts)
    except Exception as e:
        logger.warning(f"ChromaDB search failed: {e}. Proceeding without context.")

    # Step 2: Build prompt with retrieved context
    if context_text:
        user_content = f"""Please explain the following concept based on these retrieved study materials:

## Retrieved Context from Your Knowledge Base:
{context_text}

---

## Question:
{question}

Please provide a thorough explanation grounded in the above context. Reference the source documents where applicable."""
    else:
        user_content = f"""Please explain the following concept:

## Question:
{question}

Note: No documents found in the knowledge base for this topic. Providing explanation from general knowledge."""

    # Step 3: Call Gemini
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key,
        temperature=0.3,
        max_tokens=2048,
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
        "model": "gemini-1.5-flash",
        "used_knowledge_base": bool(retrieved_chunks),
    }
