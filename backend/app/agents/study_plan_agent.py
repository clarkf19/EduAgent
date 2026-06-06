"""
study_plan_agent.py
-------------------
Personalized study plan builder agent.

Analyzes the student's uploaded subjects, quiz history (performance data),
and target exam date to generate a structured, week-by-week study plan
with daily goals, resource recommendations, and revision strategy.
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import date

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

STUDY_PLAN_SYSTEM_PROMPT = """You are EduAgent's Personal Study Strategist — an expert educational coach.

Create personalized, actionable study plans based on the student's uploaded subjects, past performance, and exam goals.

Your study plan MUST:
1. Be structured with clear weekly/daily goals
2. Prioritize weaker subjects (lower quiz scores) more heavily
3. Include specific learning objectives for each session
4. Suggest revision cycles (e.g., spaced repetition)
5. Use markdown formatting with headers, tables, and bullet points
6. End with a "Quick Tips" section with 3-5 motivation and study strategy tips
7. Be realistic and achievable — don't overwhelm the student

Format the plan as beautiful, readable markdown that a student would want to pin on their wall."""


def run_study_plan(
    api_key: str,
    subjects: List[str],
    exam_date: Optional[str] = None,
    quiz_scores: Optional[List[Dict[str, Any]]] = None,
    study_hours_per_day: float = 3.0,
    user_name: Optional[str] = None,
) -> dict:
    """
    Generate a personalized study plan.
    
    Args:
        api_key: Google Gemini API key
        subjects: List of subjects the student is studying
        exam_date: Target exam date (ISO format YYYY-MM-DD), optional
        quiz_scores: List of dicts with 'subject', 'score', 'difficulty'
        study_hours_per_day: Available study hours per day
        user_name: Optional student name for personalization
    
    Returns:
        dict with 'plan' (markdown text) and metadata
    """
    # Calculate days until exam
    days_until_exam = None
    if exam_date:
        try:
            exam_dt = date.fromisoformat(exam_date)
            days_until_exam = (exam_dt - date.today()).days
        except ValueError:
            pass

    # Build performance summary
    performance_summary = ""
    if quiz_scores:
        lines = []
        for entry in quiz_scores:
            subj = entry.get("subject", "Unknown")
            score = entry.get("score", 0)
            difficulty = entry.get("difficulty", "Intermediate")
            lines.append(f"- {subj}: {score:.0f}% (last quiz difficulty: {difficulty})")
        performance_summary = "\n".join(lines)

    # Build user profile section
    greeting = f"Student: {user_name}\n" if user_name else ""
    subjects_str = ", ".join(subjects) if subjects else "General Computer Science"
    
    time_constraint = ""
    if days_until_exam and days_until_exam > 0:
        time_constraint = f"Days until exam: {days_until_exam} days (exam on {exam_date})\n"
    elif days_until_exam and days_until_exam <= 0:
        time_constraint = "Exam is today or already past — focus on quick revision!\n"

    user_content = f"""Create a personalized study plan for this student:

## Student Profile:
{greeting}Subjects to cover: {subjects_str}
{time_constraint}Daily study time available: {study_hours_per_day} hours/day

## Recent Quiz Performance:
{performance_summary if performance_summary else "No quiz history available yet — assume balanced coverage needed for all subjects."}

## Instructions:
- Prioritize subjects with lower scores (they need more time)
- Create a realistic weekly schedule
- Include specific study objectives for each subject per week
- Add dedicated revision/practice days
- Include active recall and spaced repetition techniques
- Suggest what to focus on in the final 48 hours before the exam

Please generate a comprehensive, formatted study plan now."""

    # Call Gemini
    llm = ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key,
        temperature=0.5,
        max_tokens=3000,
    )

    messages = [
        SystemMessage(content=STUDY_PLAN_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    response = llm.invoke(messages)
    plan_markdown = response.content

    return {
        "plan": plan_markdown,
        "subjects": subjects,
        "exam_date": exam_date,
        "days_until_exam": days_until_exam,
        "study_hours_per_day": study_hours_per_day,
        "model": "gemini-1.5-flash",
    }
