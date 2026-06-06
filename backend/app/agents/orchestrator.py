"""
orchestrator.py
---------------
LangGraph multi-agent orchestrator.

Routes user queries to the appropriate agent (Explainer, Quiz Generator, or Study Planner)
based on intent classification performed by Gemini.
"""

import logging
from typing import TypedDict, Dict, Any, Optional, List
from langgraph.graph import StateGraph, END

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from .explainer_agent import run_explainer
from .quiz_agent import run_quiz_generator
from .study_plan_agent import run_study_plan

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    query: str
    route: str                 # "explain" | "quiz" | "plan"
    response: Dict[str, Any]
    user_id: Optional[int]
    subject: Optional[str]
    api_key: str


def router_node(state: AgentState) -> Dict[str, Any]:
    """Classify the user's intent to route to the correct agent."""
    query = state["query"]
    api_key = state["api_key"]

    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key,
        temperature=0.1,
    )

    prompt = f"""Analyze this user query and classify it into one of these three categories:
1. "quiz" - if the user wants to generate a quiz, practice questions, test their knowledge, or get assessed.
2. "plan" - if the user wants a study schedule, plan, study guide roadmap, calendar, or timeline.
3. "explain" - if the user is asking a general question, wants a concept explained, needs doubt solving, or anything else.

Query: "{query}"

Respond with ONLY one word, either: quiz, plan, or explain. No markdown, no punctuation."""

    try:
        res = llm.invoke([HumanMessage(content=prompt)])
        decision = res.content.strip().lower()
        if decision not in ["quiz", "plan", "explain"]:
            decision = "explain"
    except Exception as e:
        logger.warning(f"Routing classification failed: {e}. Defaulting to 'explain'.")
        decision = "explain"

    return {"route": decision}


def explainer_node(state: AgentState) -> Dict[str, Any]:
    """Execute the explainer RAG agent."""
    res = run_explainer(
        question=state["query"],
        api_key=state["api_key"],
        user_id=state["user_id"],
        subject_filter=state["subject"],
    )
    return {"response": res}


def quiz_node(state: AgentState) -> Dict[str, Any]:
    """Execute the quiz generator agent."""
    res = run_quiz_generator(
        topic=state["query"],
        api_key=state["api_key"],
        difficulty="Intermediate",
        num_questions=5,
        user_id=state["user_id"],
    )
    # Reformat quiz output slightly to present a clean conversational message
    questions_summary = "\n\n".join([
        f"**Q{q['id']}: {q['question']}**\n" + "\n".join(q['options'])
        for q in res["questions"]
    ])
    msg = f"### Generated Quiz\nHere is a practice quiz on **{res['topic']}**:\n\n{questions_summary}\n\n*Head to the **Quiz** panel on the sidebar to interactively attempt and log this quiz!*"
    
    return {
        "response": {
            "answer": msg,
            "sources": [],
            "model": res["model"],
            "used_knowledge_base": res["used_knowledge_base"]
        }
    }


def planner_node(state: AgentState) -> Dict[str, Any]:
    """Execute the study planner agent."""
    subjects_list = [state["subject"]] if state["subject"] else ["Computer Science"]
    res = run_study_plan(
        api_key=state["api_key"],
        subjects=subjects_list,
        user_name=f"User {state['user_id']}" if state["user_id"] else "Student",
    )
    msg = res["plan"] + "\n\n*Configure details and customize your study plan directly in the **Study Planner** sidebar panel!*"
    return {
        "response": {
            "answer": msg,
            "sources": [],
            "model": res["model"],
            "used_knowledge_base": False
        }
    }


# Build routing decision logic
def route_decision(state: AgentState) -> str:
    return state["route"]


# Define the Graph
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("router", router_node)
workflow.add_node("explain", explainer_node)
workflow.add_node("quiz", quiz_node)
workflow.add_node("plan", planner_node)

# Set entry point
workflow.set_entry_point("router")

# Add conditional routing edges
workflow.add_conditional_edges(
    "router",
    route_decision,
    {
        "explain": "explain",
        "quiz": "quiz",
        "plan": "plan"
    }
)

# Connect end states
workflow.add_edge("explain", END)
workflow.add_edge("quiz", END)
workflow.add_edge("plan", END)

# Compile graph
orchestrator_graph = workflow.compile()


def run_orchestrator(
    query: str,
    api_key: str,
    user_id: Optional[int] = None,
    subject: Optional[str] = None,
) -> dict:
    """Run the multi-agent orchestrator graph."""
    inputs = {
        "query": query,
        "api_key": api_key,
        "user_id": user_id,
        "subject": subject,
        "route": "",
        "response": {}
    }
    
    # Run the compiled graph state machine
    outputs = orchestrator_graph.invoke(inputs)
    return outputs["response"]
