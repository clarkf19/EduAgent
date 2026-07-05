"""
coach_agent.py
--------------
AI Coach Report Agent.
Deeply analyzes per-question quiz data to produce a diagnostic report
that sounds like a human mentor who watched every answer being made.
"""

import json
import re
import logging
from typing import Optional, List
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT — Strict, data-driven, anti-generic
# ─────────────────────────────────────────────────────────────────────────────
COACH_SYSTEM_PROMPT = """\
You are a sharp, direct academic mentor reviewing a student's quiz attempt in real time.
You have access to every question, the student's exact answer, whether it was right or wrong,
the difficulty level, and timing information.

Your job: write a diagnostic report that sounds like you watched every single answer being made.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BANNED PHRASES — never use these:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- "exceptional grasp"
- "continue practicing"
- "explore more advanced topics"
- "great effort"
- "well done"
- "keep it up"
- "demonstrated a solid understanding"
- "you scored X out of Y"
- "overall performance"
- "shows dedication"
- any phrase that could apply to ANY student who took ANY quiz

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Reference SPECIFIC question numbers, topics, and the student's actual answer choices in summary, strengths, and weaknesses.
2. "strengths" must be an ARRAY of specific observations, each tied to a real question or pattern.
   BAD:  "Strong grasp of algorithms"
   GOOD: "Answered Q3 correctly (Bubble Sort worst-case), which is a commonly missed calculation — shows you traced the loop."
3. "weaknesses" must be an ARRAY of root-cause observations tied to real questions.
   BAD:  "Needs improvement in graphs"
   GOOD: "On Q6 (BFS vs DFS space complexity), you selected the BFS answer for a DFS question — classic mislabelling under pressure."
4. If score == 100%, do NOT fabricate weaknesses. Instead set weaknesses to:
   ["No conceptual weaknesses detected. Progression is the next opportunity, not revision."]
   And note in summary which question(s) seemed to require more reasoning vs. instant recall.
5. "patterns" must be an ARRAY of behavioral signals derived from answer patterns and time.
   Examples: rushed early answers, late mistakes suggesting fatigue, selected distractors matching a known misconception.
6. "tutorAdvice" must start exactly with: "If I were your tutor, "
   Then give 2-3 highly specific recommendations referencing the actual topics and question patterns you observed.
7. "nextSteps" must be an ARRAY of 3-4 concrete, sequential tasks specific to what was missed.
   Not "review the chapter." Instead: "Re-trace Q2 (Merge Sort recurrence) by hand. Write out T(n) = 2T(n/2) + n step by step."
8. "challengeProblems" must be an ARRAY of 2-3 specific problems or question ideas that push beyond what was tested,
   calibrated to this student's level. If they got 100%, make them harder.
9. "confidence" is a single integer 0-100 representing exam readiness based on the full picture.
   Do NOT just copy the score. Factor in difficulty of questions, error type, and speed.
10. "persona" must be one of:
    Concept Master | Concept Master, Needs Speed | Strong Fundamentals, Weak Application |
    Memorizer, Needs Depth | Careless but Knowledgeable | Fast Guesser | Struggling with Core Concepts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — return ONLY this JSON, no markdown, no backticks, no prose:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "persona": "<one of the 7 classifications above>",
  "summary": "<2-3 sentence narrative that references specific questions and observations>",
  "strengths": ["<specific observation tied to a question or pattern>", "..."],
  "weaknesses": ["<root-cause observation tied to a specific question>", "..."],
  "patterns": ["<behavioral signal>", "..."],
  "tutorAdvice": "If I were your tutor, ...",
  "nextSteps": ["<concrete specific task>", "..."],
  "challengeProblems": ["<specific harder problem idea calibrated to this student>", "..."],
  "confidence": <integer 0-100>
}
"""

# ─────────────────────────────────────────────────────────────────────────────
# Fallback mock generator — score-adaptive and data-aware
# ─────────────────────────────────────────────────────────────────────────────
def _build_question_summary(questions: List[dict], answers: dict) -> str:
    """Build a readable per-question breakdown for the user_content prompt."""
    lines = []
    for idx, q in enumerate(questions):
        user_ans = answers.get(str(idx)) or answers.get(idx)
        correct = q.get("correct_answer")
        is_correct = user_ans == correct
        mark = "✓" if is_correct else "✗"
        lines.append(
            f"  Q{idx+1} [{q.get('difficulty','?')}] {mark} | "
            f"Asked: {q.get('question','')[:100]} | "
            f"Student chose: {user_ans or 'No answer'} | Correct: {correct}"
        )
    return "\n".join(lines)


def _generate_fallback(
    subject: str,
    topic: str,
    score: float,
    questions: List[dict],
    answers: dict,
    time_taken: Optional[int],
) -> dict:
    """Score-adaptive fallback that avoids generic phrasing and uses actual quiz data."""
    wrong = []
    correct_hard = []
    for idx, q in enumerate(questions):
        user_ans = answers.get(str(idx)) or answers.get(idx)
        is_correct = user_ans == q.get("correct_answer")
        if not is_correct:
            wrong.append((idx + 1, q))
        elif q.get("difficulty") in ("Advanced", "Intermediate") and is_correct:
            correct_hard.append((idx + 1, q))

    avg_secs = round(time_taken / len(questions)) if time_taken and questions else None
    speed_note = (
        f"averaging ~{avg_secs}s per question" if avg_secs else "speed data unavailable"
    )

    # ── Perfect score ──────────────────────────────────────────────────────────
    if score == 100.0:
        persona = "Concept Master" if not avg_secs or avg_secs > 20 else "Concept Master, Needs Speed"
        hard_refs = ", ".join([f"Q{i}" for i, _ in correct_hard[:3]]) or "all questions"
        summary = (
            f"Every answer was correct on {topic}, including the harder questions ({hard_refs}). "
            f"You were {speed_note}. "
            + ("The pace was methodical, suggesting careful reasoning rather than memorisation."
               if avg_secs and avg_secs > 25 else
               "The pace was fast, which is a positive sign of solid recall.")
        )
        strengths = [
            f"Handled every {topic} question without error, including application-level items.",
            f"No distractor options captured your attention, which indicates strong discrimination ability.",
        ] + ([f"Correctly resolved {hard_refs} — questions that involve multi-step reasoning."] if correct_hard else [])
        weaknesses = ["No conceptual weaknesses detected. Progression is the next opportunity, not revision."]
        patterns = [
            f"Consistent accuracy across all difficulty levels.",
            f"Completion pace ({speed_note}) suggests deliberate reasoning.",
        ]
        tutor_advice = (
            f"If I were your tutor, I would stop assigning {topic} revision entirely and redirect you "
            f"to adjacent advanced problems. The next challenge should stress-test your knowledge under "
            f"unfamiliar scenarios, not repeat what you already know."
        )
        next_steps = [
            f"Attempt a mixed-topic quiz that pairs {topic} with a related subject to test cross-domain transfer.",
            f"Try deriving the core formulas or algorithms from scratch without reference materials.",
            f"Teach the hardest concept from this quiz to someone else — explaining forces deeper encoding.",
        ]
        challenge = [
            f"Design a worst-case scenario for the main algorithm in {topic} and calculate its complexity.",
            f"Find a real-world system that uses {topic} and explain how it handles edge cases.",
        ]
        confidence = 96 if avg_secs and avg_secs > 15 else 90

    # ── Strong score (≥75%) ────────────────────────────────────────────────────
    elif score >= 75:
        persona = "Careless but Knowledgeable" if (avg_secs and avg_secs < 15) else "Strong Fundamentals, Weak Application"
        wrong_refs = ", ".join([f"Q{i}" for i, _ in wrong[:3]]) or "a few questions"
        hard_refs = ", ".join([f"Q{i}" for i, _ in correct_hard[:2]]) or "some harder questions"
        summary = (
            f"You got the foundational {topic} questions right and even handled {hard_refs} correctly. "
            f"The slip-ups on {wrong_refs} weren't random — they follow a pattern worth addressing. "
            + (f"At {speed_note}, you moved faster on questions you missed, hinting at reduced verification on harder items."
               if avg_secs else "")
        )
        first_wrong_q = wrong[0][1].get("question", "")[:80] if wrong else ""
        strengths = [
            f"Correctly answered the core definitional questions on {topic} without hesitation.",
            f"Handled {hard_refs} correctly, which requires more than surface-level recall.",
        ]
        weaknesses = [
            f"On {wrong_refs}: the mistakes appear on application-type questions rather than definitions, "
            f"suggesting the concept is memorised but not internalised into a reasoning process.",
        ] + ([f'Q{wrong[0][0]} ("{first_wrong_q}...") was the first incorrect answer — review this specific concept first.'] if wrong else [])
        patterns = [
            "Correct answers concentrated on definitional and lower-difficulty questions.",
            ("Faster response times on incorrect answers suggests less deliberation before selecting." if avg_secs and avg_secs < 20 else
             "Time distribution appears even — errors likely from conceptual gaps rather than rushing."),
        ]
        tutor_advice = (
            f"If I were your tutor, I would spend the next session working through {wrong_refs} by asking "
            f"you to explain your reasoning before selecting an answer. The goal is to slow down the decision "
            f"process on application questions, not to re-teach the theory."
        )
        next_steps = [
            f"Write out your reasoning for {wrong_refs} by hand before re-checking the explanation.",
            f"Solve 5 application-based {topic} problems where you trace the logic step-by-step.",
            f"Re-take this quiz without the clock — focus on reasoning, not completion time.",
        ]
        challenge = [
            f"Construct a problem using {topic} that trips up the specific misconception behind {wrong_refs}.",
            f"Find the edge case that breaks the standard rule tested in {wrong_refs if wrong else 'this quiz'}.",
        ]
        confidence = 72

    # ── Average score (≥50%) ───────────────────────────────────────────────────
    elif score >= 50:
        persona = "Fast Guesser" if (avg_secs and avg_secs < 10) else "Strong Fundamentals, Weak Application"
        wrong_refs = ", ".join([f"Q{i}" for i, _ in wrong[:4]]) or "multiple questions"
        summary = (
            f"You answered correctly on roughly half the {topic} questions. "
            f"The errors on {wrong_refs} aren't spread randomly — they concentrate on questions that require "
            f"applying the concept rather than recognising it. "
            + (f"At {speed_note}, the pace suggests some answers were selected without full computation."
               if avg_secs and avg_secs < 15 else "")
        )
        first_two_wrong = [f"Q{i}" for i, _ in wrong[:2]]
        strengths = [
            f"Successfully answered the lower-difficulty {topic} items, confirming basic familiarity with the domain.",
        ] + ([f"Got {', '.join(f'Q{i}' for i, _ in correct_hard[:1])} correct — shows partial application ability."] if correct_hard else [])
        weaknesses = [
            f"On {wrong_refs}: selected plausible-sounding distractors rather than computing the answer. "
            f"This is a sign the formula or rule is not yet fully internalised.",
            f"The higher the difficulty label on a question, the lower your accuracy — a clear difficulty cliff.",
        ]
        patterns = [
            f"Accuracy drops significantly on questions labelled Intermediate or Advanced.",
            f"{'Rapid selections on missed questions — answers chosen before full processing.' if avg_secs and avg_secs < 12 else 'Time allocation appears uniform across difficulty levels, suggesting difficulty is not being detected early enough.'}",
        ]
        tutor_advice = (
            f"If I were your tutor, I would block out one hour to sit with you and trace through {', '.join(first_two_wrong) if first_two_wrong else wrong_refs} "
            f"by hand. Not to re-teach — to find exactly which logical step you take that leads to the wrong branch. "
            f"That's more valuable than any amount of passive re-reading."
        )
        next_steps = [
            f"Take {wrong_refs} and write out what you were thinking when you picked your answer.",
            f"For each missed question, locate the exact line in your notes where the rule is defined.",
            f"Attempt a Beginner-level quiz on {topic} first — build confidence before returning to this difficulty.",
            f"Set a self-rule: never select an answer without being able to say one sentence justifying it.",
        ]
        challenge = [
            f"Take Q{wrong[0][0] if wrong else 1} and reverse it: construct a scenario where the answer you chose would actually be correct.",
            f"Solve a problem on {topic} that gives you only the constraints and asks you to derive the rule from scratch.",
        ]
        confidence = 48

    # ── Low score (<50%) ───────────────────────────────────────────────────────
    else:
        persona = "Fast Guesser" if (avg_secs and avg_secs < 8) else "Struggling with Core Concepts"
        wrong_refs = ", ".join([f"Q{i}" for i, _ in wrong[:5]]) or "the majority of questions"
        summary = (
            f"The majority of answers on this {topic} quiz were incorrect, with errors appearing on both "
            f"basic and applied questions. "
            + (f"At {speed_note}, many selections happened before the question could have been fully processed."
               if avg_secs and avg_secs < 10 else
               f"The errors suggest the core model of {topic} isn't yet formed, rather than careless mistakes.")
        )
        correct_refs = [f"Q{i+1}" for i, q in enumerate(questions)
                        if (answers.get(str(i)) or answers.get(i)) == q.get("correct_answer")]
        strengths = [
            f"Answered {', '.join(correct_refs[:2]) if correct_refs else 'some questions'} correctly, "
            f"showing partial exposure to the {topic} domain.",
        ]
        weaknesses = [
            f"On {wrong_refs}: the selected answers suggest the conceptual framework for {topic} is not yet in place.",
            f"Distractor options were selected consistently — these are designed to catch students who have partial knowledge. "
            f"This pattern means the rules are being applied in the wrong context.",
        ]
        patterns = [
            f"{'Extremely fast answer times suggest guessing rather than reasoning.' if avg_secs and avg_secs < 8 else 'Errors occur at all difficulty levels, including Beginner — pointing to foundational gaps rather than application difficulty.'}",
            f"No clear correct-answer cluster — mistakes are spread across all question types.",
        ]
        tutor_advice = (
            f"If I were your tutor, I would not give you more practice questions right now. "
            f"Instead I would ask you to close the quiz and write down, in plain language, what you think {topic} is. "
            f"Once we align on the core definition, the answers to {wrong_refs} become obvious."
        )
        next_steps = [
            f"Before attempting another quiz, read one focused source (textbook section or lecture note) specifically on {topic}.",
            f"Draw a mind map of {topic} from memory — include every term you know and how they connect.",
            f"Ask the chat assistant to explain {topic} using a real-world analogy, then rephrase it in your own words.",
            f"Attempt only the Beginner-difficulty questions from this topic until accuracy exceeds 80%.",
        ]
        challenge = [
            f"Explain what {topic} is to a 12-year-old — if you can't, that's the exact gap to close.",
            f"Find one worked example of {topic} online and trace through it line by line.",
        ]
        confidence = max(15, int(score * 0.6))

    # ── Build markdown fallback string for copy-paste ──────────────────────────
    report_md = f"""### {persona}

{summary}

**Strengths**
{chr(10).join(f'- {s}' for s in strengths)}

**Weaknesses**
{chr(10).join(f'- {w}' for w in weaknesses)}

**Patterns**
{chr(10).join(f'- {p}' for p in patterns)}

**Tutor Advice**
{tutor_advice}

**Next Steps**
{chr(10).join(f'- {n}' for n in next_steps)}

**Challenge Problems**
{chr(10).join(f'- {c}' for c in challenge)}

*Confidence Score: {confidence}/100*
"""

    return {
        "report": report_md,
        "model": "mock-coach-agent",
        "persona": persona,
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "patterns": patterns,
        "tutor_advice": tutor_advice,
        "next_steps": next_steps,
        "challenge_problems": challenge,
        "confidence": confidence,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────
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
    total_q = len(questions)
    avg_secs = round(time_taken / total_q) if time_taken and total_q else None

    # ── No API key → premium fallback ─────────────────────────────────────────
    if not api_key:
        logger.info("GROQ_API_KEY not set. Using data-driven mock coach report.")
        return _generate_fallback(subj_label, topic_label, score, questions, answers, time_taken)

    # ── Build per-question evidence block ─────────────────────────────────────
    question_block = _build_question_summary(questions, answers)

    wrong_count = sum(
        1 for idx, q in enumerate(questions)
        if (answers.get(str(idx)) or answers.get(idx)) != q.get("correct_answer")
    )

    user_content = f"""\
Subject: {subj_label}
Topic: {topic_label}
Score: {score:.1f}% ({total_q - wrong_count}/{total_q} correct)
Total time: {f"{time_taken}s total, ~{avg_secs}s per question" if avg_secs else "not measured"}

Per-question breakdown:
{question_block}

Now write the coach report JSON. Reference specific question numbers above.
Do not say "you scored X/Y". Do not use any banned phrases.
Return ONLY the raw JSON object.
"""

    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=api_key,
        temperature=0.2,   # Lower = less hallucination, more precise
        max_tokens=3000,
        model_kwargs={"response_format": {"type": "json_object"}},
    )

    messages = [
        SystemMessage(content=COACH_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    try:
        response = llm.invoke(messages)
        text = response.content.strip()

        # Strip accidental markdown fences
        if text.startswith("```"):
            text = re.sub(r"^```[a-z]*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        text = text.strip()

        try:
            data = json.loads(text)
        except Exception:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            data = json.loads(match.group(0)) if match else {}

        # Normalise key names (LLM sometimes returns camelCase or snake_case)
        def pick(d, *keys):
            for k in keys:
                if k in d:
                    return d[k]
            return None

        persona      = pick(data, "persona") or "Concept Master"
        summary      = pick(data, "summary") or ""
        strengths    = pick(data, "strengths") or []
        weaknesses   = pick(data, "weaknesses") or []
        patterns     = pick(data, "patterns") or []
        tutor_advice = pick(data, "tutorAdvice", "tutor_advice") or ""
        next_steps   = pick(data, "nextSteps", "next_steps") or []
        challenge    = pick(data, "challengeProblems", "challenge_problems") or []
        confidence   = int(pick(data, "confidence") or score)

        # Build markdown for copy-paste
        report_md = f"""### {persona}

{summary}

**Strengths**
{chr(10).join(f'- {s}' for s in (strengths if isinstance(strengths, list) else [strengths]))}

**Weaknesses**
{chr(10).join(f'- {w}' for w in (weaknesses if isinstance(weaknesses, list) else [weaknesses]))}

**Patterns**
{chr(10).join(f'- {p}' for p in (patterns if isinstance(patterns, list) else [patterns]))}

**Tutor Advice**
{tutor_advice}

**Next Steps**
{chr(10).join(f'- {n}' for n in (next_steps if isinstance(next_steps, list) else [next_steps]))}

*Confidence: {confidence}/100*
"""

        return {
            "report":            report_md,
            "model":             "llama-3.3-70b-versatile (Groq)",
            "persona":           persona,
            "summary":           summary,
            "strengths":         strengths if isinstance(strengths, list) else [strengths],
            "weaknesses":        weaknesses if isinstance(weaknesses, list) else [weaknesses],
            "patterns":          patterns if isinstance(patterns, list) else [patterns],
            "tutor_advice":      tutor_advice,
            "next_steps":        next_steps if isinstance(next_steps, list) else [next_steps],
            "challenge_problems": challenge if isinstance(challenge, list) else [challenge],
            "confidence":        confidence,
        }

    except Exception as e:
        logger.exception("Groq coach report failed — using data-driven fallback")
        return _generate_fallback(subj_label, topic_label, score, questions, answers, time_taken)
