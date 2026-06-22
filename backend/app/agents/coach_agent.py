"""
coach_agent.py
--------------
AI Coach Report Agent.
Analyzes student quiz results (wrong answers, explanations) to generate
concept breakdowns and a personalized action plan.
"""

import os
import logging
from typing import Optional, List, Dict
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

COACH_SYSTEM_PROMPT = """You are EduAgent's AI Learning Coach — a supportive, analytically brilliant, and motivational academic advisor.
Your goal is to analyze the student's performance on their recent multiple-choice quiz and write a personalized, highly structured learning report in Markdown.

The user will provide:
- The subject (e.g. Algorithms)
- The specific topic/concept domain (e.g. Binary Search Trees)
- Their overall score (percentage)
- A detailed breakdown of all questions, including the question text, multiple choice options, correct answer, and explanation.
- The user's answers mapped by question index (0-indexed).

Your report MUST be formatted in Markdown and contain exactly these three sections, using custom formatting conventions:

1. **📊 Performance Summary**
- Synthesize how the student did overall on the quiz.
- Provide a brief, warm, yet analytical overview. Highlight the score and specify what they did well (if anything) and where their foundational gaps lie.
- Use a supportive tone (e.g., "Great effort on attempting this Algorithms quiz...", "You demonstrated solid retention of X, but struggled with Y").

2. **🔍 Concept Breakdown**
- Focus ONLY on the questions the user got WRONG. Do not list questions they got right unless they scored 100%.
- If they scored 100%, write a "Celebration & Advanced Topics" section instead, highlighting why their reasoning on the questions was sound, and listing 2-3 advanced conceptual questions/topics in this subject area to study next to keep testing their limits.
- For each WRONG question, format it clearly:
  - **Question N**: *Write the question text*
  - **Your answer**: *Option selected by the user* vs. **Correct answer**: *Correct option*
  - **Concept Tested**: *Specifically identify the micro-concept (e.g. Heap memory allocation, TCP sequence synchronization, Big-O worst case complexity).*
  - **AI Coach Analysis**: Explain in clear, direct tutorial terms why the user's selected option is a common misconception, why it is incorrect, and the core logical derivation needed to arrive at the correct answer. Do not just copy the explanation; write a personalized coach response. Keep it concise but conceptually rich.

3. **📋 Personalised Action Plan**
- Generate a practical, sequential 3-step action plan tailored to the concepts they missed.
- Step 1: Specific concepts to review or study notes/reference materials to check.
- Step 2: Practical exercises or coding/math challenges to try.
- Step 3: Self-testing strategy (e.g., how to re-attempt, adjust difficulty, or expand scope next time).
- Ensure the steps are concrete, realistic, and actionable.

STYLE INSTRUCTIONS:
- Use bullet points and clean headers.
- Keep the tone encouraging, structured, and premium.
- Do NOT output any conversational wrapper text before or after the markdown report (no "Here is the report...", no "Good luck!"). Return ONLY the raw markdown content.
"""

def run_coach_report(
    questions: List[dict],
    answers: dict,
    score: float,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    api_key: Optional[str] = None,
) -> dict:
    wrong_questions = []
    for idx, q in enumerate(questions):
        user_ans = answers.get(str(idx)) or answers.get(idx)
        correct_ans = q.get("correct_answer")
        if user_ans != correct_ans:
            wrong_questions.append({
                "index": idx + 1,
                "question": q.get("question"),
                "options": q.get("options"),
                "correct_answer": correct_ans,
                "user_answer": user_ans,
                "explanation": q.get("explanation"),
                "difficulty": q.get("difficulty")
            })

    subj_label = subject or "General Knowledge"
    topic_label = topic or "General Concepts"

    if not api_key:
        logger.info("GROQ_API_KEY is not set. Generating a premium simulated coach report.")
        if score == 100.0:
            mock_report = f"""### 📊 Performance Summary
Outstanding job! You achieved a perfect score of **100%** on the **{topic_label}** quiz in **{subj_label}**. This shows complete mastery of the tested material and a solid conceptual foundation.

### 🔍 Celebration & Advanced Topics
You successfully answered all questions correctly! Here is a summary of the core principles you've mastered:
- Core logical reasoning and application of **{topic_label}** concepts.
- Understanding edge cases and avoiding common distractor options.

To continue challenging yourself, consider exploring these advanced topics in **{subj_label}**:
1. **Advanced Edge Cases**: Analyze how scale or boundary inputs impact the performance and constraints of {topic_label}.
2. **System Constraints & Optimization**: Think about how memory constraints, concurrency, or data distribution affect the concepts you just practiced.
3. **Comparative Architecture**: Map how alternative frameworks or paradigms compare to the design patterns tested in this set.

### 📋 Personalised Action Plan
1. **Explore Advanced Materials**: Read advanced literature, research papers, or documentation covering optimization techniques for {topic_label}.
2. **Build a Practical Sandbox**: Implement a small project or code snippet that puts these concepts under stress (e.g. boundary conditions or large inputs).
3. **Teach a Concept**: Write a summary explaining a complex aspect of {topic_label} to a peer — teaching is the ultimate form of mastery!
"""
        else:
            wrong_details = ""
            for w in wrong_questions:
                wrong_details += f"""
#### Question {w['index']}: {w['question']}
- **Your Answer**: {w['user_answer'] or 'None'} | **Correct Answer**: {w['correct_answer']}
- **Concept Tested**: Core implementation details of {topic_label}
- **AI Coach Analysis**: You selected an option that represents a common misunderstanding of how this concept operates under constraint. In {topic_label}, ensure you map the inputs carefully to the operations and remember that boundary cases dictate the performance limits.
"""
            
            mock_report = f"""### 📊 Performance Summary
Good effort on attempting this **{topic_label}** quiz! You scored **{score:.0f}%**. You've demonstrated a basic grasp of the topic, but some key conceptual gaps are preventing you from achieving full mastery. Let's break down where the misunderstandings occurred so we can target your revision.

### 🔍 Concept Breakdown
{wrong_details if wrong_details else "- No wrong answers recorded."}

### 📋 Personalised Action Plan
1. **Review Selected Notes**: Re-read the chapters or sections in your **{subj_label}** study notes specifically addressing the wrong questions listed above.
2. **Execute Tracing Exercises**: Pen-and-paper trace the execution flow, variable changes, or logical transitions step-by-step for the questions you missed.
3. **Re-attempt the Quiz**: Generate a new, smaller quiz (e.g., 5 questions) on **{topic_label}** at a *Beginner* or *Intermediate* level to build your confidence before moving back to harder questions.
"""
        return {
            "report": mock_report,
            "model": "mock-coach-agent"
        }

    questions_input = []
    for idx, q in enumerate(questions):
        questions_input.append({
            "index": idx + 1,
            "question": q.get("question"),
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer"),
            "explanation": q.get("explanation"),
            "difficulty": q.get("difficulty")
        })

    user_content = f"""Please generate a personalised Coach Report.
Subject: {subj_label}
Topic/Topic Domain: {topic_label}
Student Score: {score:.1f}%

User Answers (index maps to question index):
{answers}

Full Quiz Questions:
{questions_input}
"""

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=api_key,
        temperature=0.3,
        max_tokens=4000,
    )

    messages = [
        SystemMessage(content=COACH_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    try:
        response = llm.invoke(messages)
        report_text = response.content.strip()
        return {
            "report": report_text,
            "model": "llama-3.3-70b-versatile (Groq)"
        }
    except Exception as e:
        logger.exception("Groq Llama coach report invocation failed")
        raise e
