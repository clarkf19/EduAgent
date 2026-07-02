"""
coach_agent.py
--------------
AI Coach Report Agent.
Analyzes student quiz results (wrong answers, explanations) to generate
concept breakdowns and a personalized action plan.
"""

import os
import json
import re
import logging
from typing import Optional, List, Dict
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

COACH_SYSTEM_PROMPT = """You are EduAgent's AI Learning Coach — a supportive, analytically brilliant, and motivational academic advisor/tutor.
Your goal is to analyze the student's performance on their recent multiple-choice quiz and write a personalized, highly structured learning report in JSON format.

The user will provide:
- The subject (e.g. Biology)
- The specific topic/concept domain (e.g. Photosynthesis)
- Their overall score (percentage)
- Total time taken (in seconds, if available)
- A detailed breakdown of all questions, including the question text, difficulty, options, correct answer, and explanation.
- The user's answers mapped by question index.

You MUST analyze the questions missed, the overall score, the time taken, and the answer patterns. Avoid generic statements like "You scored 7/10."
Your output MUST be a single, valid JSON object with EXACTLY the following structure (do not output any markdown code blocks, backticks, or wrapping explanation texts - return ONLY the raw JSON):

{
  "opening": "Personalized opening. Avoid score statistics. Make it sound like a real tutor referencing specific concepts they mastered or struggled with based on the questions.",
  "persona": "One of these classifications: Concept Master, Needs Speed | Strong Fundamentals, Weak Application | Memorizer, Needs Conceptual Understanding | Careless but Knowledgeable | Consistent Performer | Guessing Frequently | Struggling with Core Concepts",
  "persona_explanation": "Explain why they fit this category, referencing their score, speed/time taken, or pattern of correct/incorrect choices.",
  "strengths": "Root-cause strength analysis. Reference specific topics and reasoning skills demonstrated.",
  "weaknesses": "Root-cause weakness diagnosis. Do not just list topics; do a root-cause explanation of what logical step or concept is missing.",
  "error_patterns": "Analysis of error patterns. Explain if they are overthinking, rushing, making careless mistakes, or having conceptual misunderstandings.",
  "improvement_plan_3_days": [
    "Concrete actionable step 1 for the next 3 days",
    "Concrete actionable step 2 for the next 3 days"
  ],
  "improvement_plan_week": [
    "Concrete actionable step 1 for the next week",
    "Concrete actionable step 2 for the next week"
  ],
  "tutor_advice": "A conversational paragraph starting exactly with 'If I were your personal tutor, ...'. Give customized 1-on-1 tutoring recommendations based on their pattern.",
  "confidence_scores": {
    "conceptual_understanding": 80,
    "application_skills": 70,
    "speed": 60,
    "retention": 75,
    "exam_readiness": 65
  },
  "motivational_closing": "Vary sentence structures, sound encouraging and insightful. Do not say generic 'Keep practicing'."
}

For confidence_scores, return integers between 0 and 100 representing:
- conceptual_understanding: high if they answered foundational/theoretical questions correctly.
- application_skills: high if they answered numerical, scenario, or calculation questions correctly.
- speed: high if they answered quickly (or if time_taken is reasonable/low).
- retention: high if score is high overall.
- exam_readiness: synthesized combination of score and performance traits.
"""

def persona_explanation_for_fallback(persona: str, score: float, time_taken: Optional[int]) -> str:
    if persona == "Consistent Performer":
        return "Your accuracy remains high and stable across different questions, indicating solid retention of the core syllabus."
    elif persona == "Concept Master, Needs Speed":
        return "You understand the details perfectly but took longer to resolve intermediate questions, suggesting a need for speed drills."
    elif persona == "Careless but Knowledgeable":
        return "Your fast completion time combined with errors on easy questions indicates minor slips rather than a lack of understanding."
    elif persona == "Strong Fundamentals, Weak Application":
        return "You perform well on direct definitions but slip when scenarios require multi-step mathematical or code reasoning."
    elif persona == "Guessing Frequently":
        return "Your extremely fast response time suggests clicking answers based on intuition rather than careful computation or deduction."
    else:
        return "Several conceptual questions were missed, suggesting we need to revisit the core lecture materials to build a solid foundation."

def generate_mock_coach_report(
    subject: str,
    topic: str,
    score: float,
    time_taken: Optional[int]
) -> dict:
    if score == 100:
        persona = "Consistent Performer"
        opening = f"Sensational performance on {topic}! You did not miss a single point, illustrating absolute control over all assessed parameters."
        strengths = f"Flawless conceptual alignment on all {topic} core topics. Your deduction pathways were perfectly mapped."
        weaknesses = "None. You've established complete mastery over the current syllabus."
        error_patterns = "No observable gaps or systematic slip-ups."
        tutor_advice = f"If I were your personal tutor, I would immediately transition you to university-level reference material or more complex, open-ended scenarios on {subject}."
        plan_3 = ["Review advanced edge cases and boundary calculations.", "Draft a mini-guide explaining these concepts to another peer."]
        plan_week = ["Take a comprehensive diagnostic test at a much higher difficulty setting.", "Build a sandbox script to trace concept dependencies."]
        scores = {
            "conceptual_understanding": 100,
            "application_skills": 98,
            "speed": min(100, max(50, 120 - int(time_taken or 60) // 5)),
            "retention": 100,
            "exam_readiness": 98
        }
        closing = "Sensational effort! Push your boundaries further by attempting advanced application quizzes."
    elif score >= 75:
        persona = "Concept Master, Needs Speed" if (time_taken and time_taken > 180) else "Consistent Performer"
        opening = f"You demonstrated solid retention of {topic}. You consistently select appropriate logic, though boundary cases or complex application formulas show slight hesitation."
        strengths = f"Clear understanding of core {topic} theories and basic definition questions. You are quick to rule out obvious distractors."
        weaknesses = "Minor conceptual slips under nested logic conditions, or slight over-complication of basic rules."
        error_patterns = "Slight overthinking in the second half of the quiz, potentially from second-guessing your first instinct."
        tutor_advice = f"If I were your personal tutor, I would work with you to speed up your verification checks. You have the knowledge, you just need to trust your intuition."
        plan_3 = ["Practice timed exercises of 5 questions each.", "Re-read the explanations for any question where you hovered on a distraction choice."]
        plan_week = ["Attempt a mixed-topic speed quiz.", "Review cellular/micro-level formulas to speed up calculation routines."]
        scores = {
            "conceptual_understanding": 85,
            "application_skills": 78,
            "speed": min(100, max(40, 110 - int(time_taken or 60) // 6)),
            "retention": 85,
            "exam_readiness": 80
        }
        closing = "Your fundamentals are very strong. A few targeted speed exercises will yield massive score improvements!"
    elif score >= 50:
        persona = "Careless but Knowledgeable" if (time_taken and time_taken < 90) else "Strong Fundamentals, Weak Application"
        opening = f"You have built a standard foundation in {topic}, but transitioning from definitions to problem-solving application remains a noticeable hurdle."
        strengths = f"Satisfactory grasp of main terminology and conceptual definitions in {topic}."
        weaknesses = f"Difficulty applying rules to multi-step problem solving. Complex phrasing or application questions throw you off."
        error_patterns = "Careless mistakes or rushing on application steps. You understand the rule but slip during implementation." if (time_taken and time_taken < 90) else "Conceptual gaps under pressure, causing you to second-guess basic rules."
        tutor_advice = f"If I were your personal tutor, I would block off the next study session to trace step-by-step calculations with you. Doing pen-and-paper tracing will solve these application errors."
        plan_3 = [f"Isolate the 2 hardest questions you missed in {topic} and rewrite their explanations.", "Study step-by-step computational examples from your notes."]
        plan_week = ["Solve 10 manual tracing diagrams or code walkthroughs.", "Attempt an intermediate quiz but check your answers before submitting."]
        scores = {
            "conceptual_understanding": 68,
            "application_skills": 52,
            "speed": min(100, max(30, 95 - int(time_taken or 120) // 8)),
            "retention": 65,
            "exam_readiness": 60
        }
        closing = "You are on the verge of a breakthrough. Focus heavily on solving practice problems step-by-step next week."
    else:
        persona = "Guessing Frequently" if (time_taken and time_taken < 60) else "Struggling with Core Concepts"
        opening = f"The assessment shows that several core pillars of {topic} are not fully formed. This makes it very easy to fall for clever distractor options."
        strengths = f"You attempted all questions, demonstrating a willingness to challenge yourself on {topic}."
        weaknesses = f"Struggling with both theoretical foundations and application logic of {topic}. Distractor options successfully pull you away from the correct logic."
        error_patterns = "Rushing or guessing. Short answer durations suggest clicking on intuition rather than mapping the concept." if (time_taken and time_taken < 60) else "Deep conceptual misunderstanding or poor retention of the lecture materials."
        tutor_advice = f"If I were your personal tutor, I would stop doing quizzes entirely for a few days. We need to go back to the notes, highlight key relationships, and build a solid mind map first."
        plan_3 = [f"Review the main overview notes for {topic} starting from the absolute basics.", "Draw a manual mind map connecting the terms you missed."]
        plan_week = ["Attempt a beginner-level quiz with open notes.", "Discuss the core definitions with a study partner or use the chat assistant to explain them."]
        scores = {
            "conceptual_understanding": 40,
            "application_skills": 30,
            "speed": min(100, max(20, 85 - int(time_taken or 180) // 10)),
            "retention": 35,
            "exam_readiness": 30
        }
        closing = "Do not be discouraged by this score. Gaps are just learning milestones waiting to be conquered. Let's restart with the basics."

    persona_expl = persona_explanation_for_fallback(persona, score, time_taken)
    plan_3_md = "\n".join([f"- {s}" for s in plan_3])
    plan_week_md = "\n".join([f"- {s}" for s in plan_week])
    report_markdown = f"""### 📊 Performance Summary
{opening}

**Learning Persona**: {persona}
*{persona_expl}*

#### 💪 Core Strengths
{strengths}

#### 🔍 Weaknesses & Root-Cause
{weaknesses}

#### ⚠️ Error Patterns
{error_patterns}

#### 💡 Tutor Advice
{tutor_advice}

#### 📋 Action Plan
**Next 3 Days**:
{plan_3_md}

**Next Week**:
{plan_week_md}

{closing}
"""
    return {
        "report": report_markdown,
        "model": "mock-coach-agent",
        "opening": opening,
        "persona": persona,
        "persona_explanation": persona_expl,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "error_patterns": error_patterns,
        "tutor_advice": tutor_advice,
        "scores": scores,
        "improvement_plan_3_days": plan_3,
        "improvement_plan_week": plan_week,
        "motivational_closing": closing
    }

def run_coach_report(
    questions: List[dict],
    answers: dict,
    score: float,
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    time_taken: Optional[int] = None,
    api_key: Optional[str] = None,
) -> dict:
    subj_label = subject or "General Knowledge"
    topic_label = topic or "General Concepts"

    if not api_key:
        logger.info("GROQ_API_KEY is not set. Generating a premium simulated coach report.")
        return generate_mock_coach_report(subj_label, topic_label, score, time_taken)

    # Process questions
    questions_input = []
    for idx, q in enumerate(questions):
        user_ans = answers.get(str(idx)) or answers.get(idx)
        correct_ans = q.get("correct_answer")
        questions_input.append({
            "index": idx + 1,
            "question": q.get("question"),
            "options": q.get("options"),
            "correct_answer": correct_ans,
            "user_answer": user_ans,
            "is_correct": user_ans == correct_ans,
            "explanation": q.get("explanation"),
            "difficulty": q.get("difficulty")
        })

    user_content = f"""Please generate a structured Coach Report.
Subject: {subj_label}
Topic: {topic_label}
Student Score: {score:.1f}%
Time Taken: {f"{time_taken} seconds" if time_taken else "Not measured"}

Quiz Questions & Performance Breakdown:
{json.dumps(questions_input, indent=2)}
"""

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=api_key,
        temperature=0.3,
        max_tokens=4000,
        model_kwargs={"response_format": {"type": "json_object"}}
    )

    messages = [
        SystemMessage(content=COACH_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    try:
        response = llm.invoke(messages)
        text = response.content.strip()
        
        # Clean markdown wrappers if present
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        try:
            report_data = json.loads(text)
        except Exception as parse_err:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                report_data = json.loads(match.group(0))
            else:
                raise parse_err

        # Build fallback markdown report text for copy-paste utility
        plan_3 = report_data.get("improvement_plan_3_days", [])
        plan_week = report_data.get("improvement_plan_week", [])
        plan_3_md = "\n".join([f"- {s}" for s in plan_3])
        plan_week_md = "\n".join([f"- {s}" for s in plan_week])

        report_markdown = f"""### 📊 Performance Summary
{report_data.get('opening')}

**Learning Persona**: {report_data.get('persona')}
*{report_data.get('persona_explanation')}*

#### 💪 Core Strengths
{report_data.get('strengths')}

#### 🔍 Weaknesses & Root-Cause
{report_data.get('weaknesses')}

#### ⚠️ Error Patterns
{report_data.get('error_patterns')}

#### 💡 Tutor Advice
{report_data.get('tutor_advice')}

#### 📋 Action Plan
**Next 3 Days**:
{plan_3_md}

**Next Week**:
{plan_week_md}

{report_data.get('motivational_closing')}
"""

        return {
            "report": report_markdown,
            "model": "llama-3.3-70b-versatile (Groq)",
            "opening": report_data.get("opening"),
            "persona": report_data.get("persona"),
            "persona_explanation": report_data.get("persona_explanation"),
            "strengths": report_data.get("strengths"),
            "weaknesses": report_data.get("weaknesses"),
            "error_patterns": report_data.get("error_patterns"),
            "tutor_advice": report_data.get("tutor_advice"),
            "scores": report_data.get("confidence_scores"),
            "improvement_plan_3_days": plan_3,
            "improvement_plan_week": plan_week,
            "motivational_closing": report_data.get("motivational_closing")
        }

    except Exception as e:
        logger.exception("Groq Llama coach report invocation failed. Using custom fallback generator.")
        # Return fallback generator so service is never disrupted
        return generate_mock_coach_report(subj_label, topic_label, score, time_taken)
