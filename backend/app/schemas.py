from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
import datetime

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None


# --- User Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters long")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- Topic Schemas ---
class TopicBase(BaseModel):
    title: str
    subject: str

class TopicCreate(TopicBase):
    pass

class TopicResponse(TopicBase):
    id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- Study Session Schemas ---
class StudySessionBase(BaseModel):
    topic_id: Optional[int] = None
    start_time: Optional[datetime.datetime] = None
    end_time: Optional[datetime.datetime] = None
    duration: Optional[float] = 0.0

class StudySessionCreate(BaseModel):
    topic_id: Optional[int] = None

class StudySessionResponse(StudySessionBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True


# --- Quiz Attempt Schemas ---
class QuizAttemptBase(BaseModel):
    topic_id: Optional[int] = None
    score: float
    total_questions: int
    difficulty: str

class QuizAttemptCreate(QuizAttemptBase):
    topic: Optional[str] = None
    subject: Optional[str] = None


class QuizAttemptResponse(QuizAttemptBase):
    id: int
    user_id: int
    timestamp: datetime.datetime

    class Config:
        from_attributes = True


# --- Document Schemas ---
class DocumentResponse(BaseModel):
    id: int
    filename: str
    subject: str
    file_size: int
    num_chunks: int
    uploaded_at: datetime.datetime
    user_id: int

    class Config:
        from_attributes = True


class DocumentStats(BaseModel):
    total_documents: int
    total_chunks: int
    subjects: List[str]
    chroma_collection_size: int


# --- AI Chat / Explainer Schemas ---
class ChatRequest(BaseModel):
    question: str
    subject: Optional[str] = None

class ChatSource(BaseModel):
    filename: str
    page: str
    subject: str
    preview: str
    text: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[ChatSource]
    model: str
    used_knowledge_base: bool


# --- Quiz Generator Schemas ---
class QuizGenerateRequest(BaseModel):
    topic: str
    difficulty: str = "Intermediate"
    num_questions: int = 5

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    difficulty: str

class QuizGenerateResponse(BaseModel):
    questions: List[QuizQuestion]
    topic: str
    difficulty: str
    num_questions: int
    used_knowledge_base: bool
    model: str


# --- Study Plan Schemas ---
class StudyPlanRequest(BaseModel):
    subjects: List[str]
    exam_date: Optional[str] = None
    study_hours_per_day: float = 3.0

class StudyPlanResponse(BaseModel):
    plan: str
    subjects: List[str]
    exam_date: Optional[str] = None
    days_until_exam: Optional[int] = None
    study_hours_per_day: float
    model: str


# --- Study Goal Schemas ---
class StudyGoalCreate(BaseModel):
    subject: str
    target_hours: float
    target_score: float
    deadline: Optional[datetime.datetime] = None

class StudyGoalResponse(BaseModel):
    id: int
    user_id: int
    subject: str
    target_hours: float
    target_score: float
    deadline: Optional[datetime.datetime] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

