"""
main.py  –  EduAgent FastAPI Application
"""

import os
import datetime
import logging
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional

from .database import engine, Base, get_db
from .models import User, Topic, StudySession, QuizAttempt, Document, StudyGoal, Flashcard
from .schemas import (
    UserCreate, UserResponse, Token, ForgotPasswordRequest, ResetPasswordRequest,
    StudySessionResponse, StudySessionCreate,
    DocumentResponse, DocumentStats,
    ChatRequest, ChatResponse,
    QuizGenerateRequest, QuizGenerateResponse, QuizAttemptCreate, QuizAttemptResponse,
    StudyPlanRequest, StudyPlanResponse,
    StudyGoalCreate, StudyGoalResponse,
    CoachReportRequest, CoachReportResponse,
    FlashcardGenerateRequest, FlashcardReviewSubmit, FlashcardResponse, MasteryResponse,
)
from .auth import get_password_hash, verify_password, create_access_token, get_current_user
from .chroma_client import (
    get_or_create_collection, get_collection_size,
    index_document_chunks, delete_document_vectors,
)
from .document_processor import parse_pdf_to_chunks
from .agents.explainer_agent import run_explainer
from .agents.quiz_agent import run_quiz_generator
from .agents.study_plan_agent import run_study_plan
from .agents.coach_agent import run_coach_report
from .agents.flashcard_agent import run_flashcard_generator
from .predictor import PerformancePredictor

logger = logging.getLogger(__name__)

# Initialize ML Predictor
predictor = PerformancePredictor()

# Suppress HuggingFace symlink warning on Windows
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# Uploads directory
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Allowed subjects (for the subject dropdown)
ALLOWED_SUBJECTS = [
    "Computer Networks",
    "Algorithms",
    "Database Systems",
    "System Design",
    "Operating Systems",
    "Machine Learning",
    "Data Structures",
    "Mathematics",
    "Other",
]

# Create FastAPI instance
app = FastAPI(title="EduAgent API", version="0.2.0")

# Setup CORS
_cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")
_cors_origins = (
    [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
    if _cors_origins_env
    else [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize database tables & ChromaDB collection at startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    # Run SQLite migration to add new columns to users table if they don't exist
    from sqlalchemy import text
    with engine.connect() as conn:
        for col_name, col_type in [
            ("name", "VARCHAR"),
            ("age", "INTEGER"),
            ("role", "VARCHAR"),
            ("reset_token", "VARCHAR"),
            ("reset_token_expires", "TIMESTAMP")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                conn.commit()
                logger.info(f"Added column {col_name} to users table.")
            except Exception:
                pass
    get_or_create_collection()
    predictor.train()
    logger.info("Database tables ensured. ChromaDB collection and ML predictor ready.")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _generate_topic_mock_questions(topic: str, difficulty: str, num_questions: int) -> list:
    """
    Generate topic-aware demo questions when Gemini API key is not configured.
    Uses a curated bank of CS/Science questions mapped by keyword,
    with a generic fallback for any other topic.
    """
    import hashlib
    topic_lower = topic.lower()

    # ── Topic-specific question banks ──────────────────────────────────────
    BANK: dict = {
        "merge sort": [
            ("What is the time complexity of Merge Sort in the worst case?",
             ["A) O(n)", "B) O(n log n)", "C) O(n²)", "D) O(log n)"], "B",
             "Merge Sort always divides the array into halves and merges them — giving O(n log n) in all cases."),
            ("What algorithmic paradigm does Merge Sort use?",
             ["A) Greedy", "B) Dynamic Programming", "C) Divide and Conquer", "D) Backtracking"], "C",
             "Merge Sort splits the problem into smaller subproblems (divide) and combines results (conquer)."),
            ("What is the space complexity of the standard top-down Merge Sort?",
             ["A) O(1)", "B) O(log n)", "C) O(n)", "D) O(n²)"], "C",
             "It needs O(n) auxiliary space for the temporary arrays used during merging."),
            ("Which property does Merge Sort have that Quick Sort does NOT guarantee?",
             ["A) In-place sorting", "B) Stability", "C) O(n log n) best case", "D) Recursive structure"], "B",
             "Merge Sort is stable — equal elements maintain their original relative order."),
            ("In the merge step of Merge Sort, what is the key operation performed?",
             ["A) Partitioning around a pivot", "B) Swapping adjacent elements",
              "C) Comparing and interleaving two sorted halves", "D) Hashing elements into buckets"], "C",
             "The merge step compares elements from two sorted subarrays and places the smaller one first."),
        ],
        "quick sort": [
            ("What is the average-case time complexity of Quick Sort?",
             ["A) O(n)", "B) O(n log n)", "C) O(n²)", "D) O(log n)"], "B",
             "On average, Quick Sort partitions arrays efficiently giving O(n log n)."),
            ("What is the worst-case time complexity of Quick Sort?",
             ["A) O(n log n)", "B) O(n)", "C) O(n²)", "D) O(2ⁿ)"], "C",
             "Worst case occurs when the pivot is always the smallest or largest element (e.g. already sorted array)."),
            ("Quick Sort is based on which algorithmic paradigm?",
             ["A) Greedy", "B) Dynamic Programming", "C) Divide and Conquer", "D) Branch and Bound"], "C",
             "Quick Sort divides the array around a pivot and sorts subarrays recursively."),
            ("Which variant of Quick Sort improves performance on nearly-sorted arrays?",
             ["A) 3-way Quick Sort", "B) Randomized pivot selection", "C) Median-of-three pivot", "D) Both B and C"], "D",
             "Randomized pivot and median-of-three both reduce the chance of worst-case O(n²) behaviour."),
            ("What is the space complexity of Quick Sort due to recursion?",
             ["A) O(1)", "B) O(log n) average, O(n) worst", "C) O(n)", "D) O(n log n)"], "B",
             "The call stack depth is O(log n) on average, but O(n) in the degenerate worst case."),
        ],
        "binary search": [
            ("What is the time complexity of Binary Search?",
             ["A) O(n)", "B) O(n log n)", "C) O(log n)", "D) O(1)"], "C",
             "Binary Search halves the search space each step — giving O(log n)."),
            ("What precondition must the array satisfy for Binary Search to work?",
             ["A) Unsorted", "B) Sorted", "C) Unique elements only", "D) Size must be a power of 2"], "B",
             "Binary Search requires the array to be sorted so it can eliminate half the elements each step."),
            ("In Binary Search, if mid = (lo + hi) / 2 and arr[mid] < target, what do you do?",
             ["A) Set hi = mid - 1", "B) Set lo = mid + 1", "C) Return mid", "D) Reset the search"], "B",
             "If the middle element is smaller than target, the target must be in the right half — move lo up."),
            ("Which data structure is conceptually equivalent to recursive Binary Search?",
             ["A) Stack", "B) Queue", "C) Binary Search Tree", "D) Hash Table"], "C",
             "The sorted array in binary search behaves like an in-order traversal of a BST."),
            ("What is the worst case for Binary Search?",
             ["A) Element at position 0", "B) Element not in array", "C) Array of size 1", "D) Duplicate elements"], "B",
             "When the element is not present, Binary Search exhausts all log n steps before concluding."),
        ],
        "machine learning": [
            ("Which type of machine learning uses labeled training data?",
             ["A) Unsupervised Learning", "B) Reinforcement Learning", "C) Supervised Learning", "D) Semi-supervised Learning"], "C",
             "Supervised learning trains models on input-output pairs where outputs (labels) are provided."),
            ("What does 'overfitting' mean in machine learning?",
             ["A) Model performs poorly on training data", "B) Model memorizes training data and fails on new data",
              "C) Model is too simple to capture patterns", "D) Model has too few parameters"], "B",
             "Overfitting happens when a model is so tuned to training data that it cannot generalize."),
            ("Which algorithm is used for classification and regression using decision boundaries?",
             ["A) K-Means", "B) Support Vector Machine", "C) PCA", "D) DBSCAN"], "B",
             "SVMs find the optimal hyperplane that maximizes the margin between classes."),
            ("What is gradient descent used for in ML?",
             ["A) Generating training data", "B) Evaluating model accuracy",
              "C) Minimizing the loss function by updating weights", "D) Splitting data into train/test sets"], "C",
             "Gradient descent iteratively adjusts weights in the direction that reduces the loss."),
            ("What does 'cross-validation' help assess?",
             ["A) The model's training speed", "B) The generalization performance of a model",
              "C) The size of the dataset needed", "D) The number of features to use"], "B",
             "Cross-validation evaluates how well the model generalizes to unseen data by rotating train/test splits."),
        ],
        "neural network": [
            ("What is the role of an activation function in a neural network?",
             ["A) Initialize weights", "B) Introduce non-linearity", "C) Normalize inputs", "D) Compute loss"], "B",
             "Activation functions add non-linearity, allowing networks to learn complex patterns."),
            ("Which activation function is most commonly used in hidden layers of deep networks?",
             ["A) Sigmoid", "B) Tanh", "C) ReLU", "D) Softmax"], "C",
             "ReLU (Rectified Linear Unit) avoids vanishing gradients and trains faster than Sigmoid/Tanh."),
            ("What does backpropagation compute?",
             ["A) Forward pass predictions", "B) Gradients of the loss with respect to weights",
              "C) Activation function outputs", "D) Batch normalization values"], "B",
             "Backpropagation uses the chain rule to compute gradients flowing backwards from the loss."),
            ("What is the purpose of dropout in neural networks?",
             ["A) Speed up training", "B) Reduce overfitting by randomly disabling neurons",
              "C) Increase model capacity", "D) Normalize layer outputs"], "B",
             "Dropout randomly zeroes out neurons during training, forcing the network to learn redundant representations."),
            ("What does a softmax output layer produce?",
             ["A) A single scalar", "B) A probability distribution over classes",
              "C) Binary 0/1 predictions", "D) Unnormalized logits"], "B",
             "Softmax converts raw scores (logits) into probabilities that sum to 1 — ideal for multi-class classification."),
        ],
        "database": [
            ("What does ACID stand for in database transactions?",
             ["A) Array, Consistency, Isolation, Durability",
              "B) Atomicity, Consistency, Isolation, Durability",
              "C) Atomicity, Concurrency, Index, Data",
              "D) Aggregation, Consistency, Integrity, Distribution"], "B",
             "ACID properties guarantee reliable database transactions even in failure scenarios."),
            ("Which SQL clause filters rows AFTER grouping?",
             ["A) WHERE", "B) ORDER BY", "C) HAVING", "D) GROUP BY"], "C",
             "HAVING filters groups formed by GROUP BY, while WHERE filters individual rows before grouping."),
            ("What is a foreign key?",
             ["A) A key that is unique across all tables", "B) A column that references the primary key of another table",
              "C) An encrypted primary key", "D) An index on a non-primary column"], "B",
             "Foreign keys enforce referential integrity between tables in a relational database."),
            ("What is database normalization?",
             ["A) Encrypting data at rest", "B) Removing redundancy and dependency by organizing tables",
              "C) Indexing all columns for fast lookup", "D) Replicating data across servers"], "B",
             "Normalization reduces redundancy and improves data integrity by decomposing tables into normal forms."),
            ("Which join returns all rows from both tables, with NULLs for non-matching rows?",
             ["A) INNER JOIN", "B) LEFT JOIN", "C) RIGHT JOIN", "D) FULL OUTER JOIN"], "D",
             "FULL OUTER JOIN returns all rows from both tables; non-matching sides fill with NULL."),
        ],
        "operating system": [
            ("What is a deadlock?",
             ["A) A process that never terminates", "B) A situation where processes wait indefinitely for each other's resources",
              "C) A type of memory leak", "D) A CPU scheduling algorithm"], "B",
             "Deadlock occurs when a set of processes are each waiting for a resource held by another process in the set."),
            ("Which scheduling algorithm gives the shortest average waiting time?",
             ["A) FCFS", "B) Round Robin", "C) Shortest Job First (SJF)", "D) Priority Scheduling"], "C",
             "SJF minimizes average waiting time by always running the process with the shortest burst time next."),
            ("What is virtual memory?",
             ["A) Memory on the GPU", "B) Extra RAM added via USB",
              "C) An abstraction that allows processes to use more memory than physically available",
              "D) Cache memory near the CPU"], "C",
             "Virtual memory uses disk space to extend RAM, giving each process its own address space."),
            ("What is thrashing in operating systems?",
             ["A) CPU overheating", "B) Excessive paging causing more time spent swapping than executing",
              "C) A disk read/write error", "D) A network timeout issue"], "B",
             "Thrashing happens when the OS spends more time handling page faults than executing actual processes."),
            ("What does the fork() system call do?",
             ["A) Opens a file", "B) Creates a new thread", "C) Creates a child process as a copy of the parent",
              "D) Terminates a process"], "C",
             "fork() creates a new process (child) that is a nearly identical copy of the calling (parent) process."),
        ],
        "data structure": [
            ("What is the time complexity of accessing an element in an array by index?",
             ["A) O(n)", "B) O(log n)", "C) O(1)", "D) O(n²)"], "C",
             "Arrays store elements in contiguous memory, so index-based access is O(1)."),
            ("Which data structure uses LIFO ordering?",
             ["A) Queue", "B) Stack", "C) Heap", "D) Graph"], "B",
             "A Stack follows Last In First Out — the last element pushed is the first one popped."),
            ("What is the height of a balanced binary search tree with n nodes?",
             ["A) O(n)", "B) O(n²)", "C) O(log n)", "D) O(1)"], "C",
             "A balanced BST keeps height proportional to log n, giving efficient O(log n) search."),
            ("Which data structure is best for implementing a priority queue efficiently?",
             ["A) Linked List", "B) Array", "C) Binary Heap", "D) Hash Table"], "C",
             "A binary heap supports O(log n) insert and O(log n) extract-min/max — ideal for priority queues."),
            ("What makes a hash table's average-case lookup O(1)?",
             ["A) Sorted storage", "B) Binary search over keys", "C) Direct index via hash function", "D) Linked list traversal"], "C",
             "The hash function maps keys to array indices, enabling direct O(1) average-case access."),
        ],
        "computer network": [
            ("What does TCP guarantee that UDP does not?",
             ["A) Low latency", "B) Reliable, ordered delivery", "C) Multicast support", "D) Smaller packet headers"], "B",
             "TCP provides reliability through acknowledgments and retransmission; UDP is a best-effort protocol."),
            ("Which layer of the OSI model handles routing between networks?",
             ["A) Data Link", "B) Transport", "C) Network", "D) Session"], "C",
             "The Network layer (Layer 3) is responsible for logical addressing and routing via IP."),
            ("What is the purpose of DHCP?",
             ["A) Encrypting network packets", "B) Dynamically assigning IP addresses to devices",
              "C) Resolving domain names to IPs", "D) Filtering malicious traffic"], "B",
             "DHCP (Dynamic Host Configuration Protocol) automatically assigns IP addresses to hosts on a network."),
            ("What does DNS resolve?",
             ["A) MAC addresses to IP addresses", "B) IP addresses to port numbers",
              "C) Domain names to IP addresses", "D) HTTP requests to HTTPS"], "C",
             "DNS translates human-readable domain names (e.g. google.com) into IP addresses."),
            ("What is the three-way handshake in TCP?",
             ["A) SYN → SYN-ACK → ACK", "B) ACK → SYN → FIN",
              "C) HELLO → RESPONSE → CONFIRM", "D) GET → POST → DELETE"], "A",
             "TCP connection establishment uses SYN, SYN-ACK, ACK to synchronize sequence numbers."),
        ],
        "physics": [
            ("What is Newton's Second Law of Motion?",
             ["A) F = mc²", "B) F = ma", "C) E = hf", "D) p = mv"], "B",
             "Newton's Second Law states Force equals mass times acceleration (F = ma)."),
            ("What is the SI unit of electric charge?",
             ["A) Volt", "B) Ampere", "C) Coulomb", "D) Ohm"], "C",
             "The Coulomb (C) is the SI unit of electric charge; 1 coulomb = charge of ~6.24×10¹⁸ electrons."),
            ("Which phenomenon explains why the sky is blue?",
             ["A) Refraction", "B) Rayleigh scattering", "C) Diffraction", "D) Polarization"], "B",
             "Rayleigh scattering causes shorter (blue) wavelengths to scatter more than longer (red) ones."),
            ("What is the speed of light in a vacuum?",
             ["A) 3×10⁶ m/s", "B) 3×10⁸ m/s", "C) 3×10¹⁰ m/s", "D) 3×10¹² m/s"], "B",
             "The speed of light c ≈ 3×10⁸ m/s in a vacuum — a fundamental constant of nature."),
            ("What does the law of conservation of energy state?",
             ["A) Energy is always lost as heat", "B) Energy cannot be created or destroyed, only transformed",
              "C) Mass and energy are unrelated", "D) Potential energy always converts to kinetic energy"], "B",
             "The total energy of an isolated system remains constant — it can change form but not appear or vanish."),
        ],
        "chemistry": [
            ("What is the atomic number of Carbon?",
             ["A) 6", "B) 12", "C) 14", "D) 8"], "A",
             "Carbon has 6 protons, giving it atomic number 6."),
            ("What type of bond involves sharing electrons between atoms?",
             ["A) Ionic bond", "B) Covalent bond", "C) Hydrogen bond", "D) Metallic bond"], "B",
             "Covalent bonds form when atoms share electron pairs, as in H₂O or CO₂."),
            ("What is the pH of a neutral solution at 25°C?",
             ["A) 0", "B) 7", "C) 14", "D) 1"], "B",
             "At 25°C, water's [H⁺] = [OH⁻] = 10⁻⁷ mol/L, giving pH 7 (neutral)."),
            ("Which element is the most abundant in Earth's crust?",
             ["A) Silicon", "B) Iron", "C) Oxygen", "D) Aluminium"], "C",
             "Oxygen makes up about 46% of Earth's crust by mass — mostly in silicate minerals."),
            ("What is Avogadro's number?",
             ["A) 6.022×10²¹", "B) 6.022×10²³", "C) 6.022×10²⁵", "D) 3.14×10²³"], "B",
             "Avogadro's number (~6.022×10²³) is the number of entities in one mole of a substance."),
        ],
        "mathematics": [
            ("What is the derivative of sin(x)?",
             ["A) cos(x)", "B) -cos(x)", "C) tan(x)", "D) -sin(x)"], "A",
             "The derivative of sin(x) with respect to x is cos(x)."),
            ("What is the sum of angles in a triangle?",
             ["A) 90°", "B) 180°", "C) 270°", "D) 360°"], "B",
             "The interior angles of any triangle always sum to 180°."),
            ("What does the Fundamental Theorem of Calculus connect?",
             ["A) Algebra and Geometry", "B) Differentiation and Integration",
              "C) Limits and Sequences", "D) Vectors and Matrices"], "B",
             "The FTC states that differentiation and integration are inverse operations."),
            ("What is the value of e (Euler's number) approximately?",
             ["A) 2.718", "B) 3.141", "C) 1.618", "D) 1.414"], "A",
             "Euler's number e ≈ 2.71828 is the base of the natural logarithm."),
            ("What is the Big-O notation used for?",
             ["A) Measuring memory in bytes", "B) Describing algorithm time/space complexity growth",
              "C) Counting the number of operations exactly", "D) Specifying the programming language used"], "B",
             "Big-O notation describes how an algorithm's resource usage grows as input size increases."),
        ],
        "history": [
            ("In which year did World War II end?",
             ["A) 1943", "B) 1944", "C) 1945", "D) 1946"], "C",
             "World War II ended in 1945 with Germany's surrender in May and Japan's in September."),
            ("Who was the first President of the United States?",
             ["A) Thomas Jefferson", "B) John Adams", "C) Abraham Lincoln", "D) George Washington"], "D",
             "George Washington served as the first U.S. President from 1789 to 1797."),
            ("The French Revolution began in which year?",
             ["A) 1776", "B) 1789", "C) 1799", "D) 1815"], "B",
             "The French Revolution is generally dated from 1789, starting with the storming of the Bastille."),
            ("Which ancient wonder was located in Alexandria, Egypt?",
             ["A) The Colosseum", "B) The Hanging Gardens", "C) The Great Lighthouse", "D) The Temple of Artemis"], "C",
             "The Lighthouse of Alexandria was one of the Seven Wonders of the Ancient World."),
            ("The Industrial Revolution began in which country?",
             ["A) France", "B) Germany", "C) United States", "D) Great Britain"], "D",
             "The Industrial Revolution originated in Great Britain in the late 18th century."),
        ],
    }

    # ── Match topic to bank ─────────────────────────────────────────────────
    matched_questions = None
    for key, qlist in BANK.items():
        if key in topic_lower or any(word in topic_lower for word in key.split()):
            matched_questions = qlist
            break

    # ── Generic fallback for unknown topics ─────────────────────────────────
    if not matched_questions:
        # Build plausible-sounding questions based on the topic name
        matched_questions = [
            (f"Which of the following best describes the core purpose of {topic}?",
             [f"A) A method for optimizing {topic} performance",
              f"B) A foundational framework that enables understanding of {topic} concepts",
              f"C) A hardware component related to {topic}",
              f"D) A deprecated technique replaced by modern {topic} approaches"],
             "B",
             f"The core purpose of {topic} is to provide a structured framework for understanding its domain."),
            (f"What is the primary advantage of studying {topic}?",
             [f"A) It has no real-world applications",
              f"B) It builds problem-solving skills applicable across many domains",
              f"C) It is only useful in academic settings",
              f"D) It replaces the need for practical experience"],
             "B",
             f"Studying {topic} develops analytical and problem-solving skills valuable across many fields."),
            (f"Which approach is most effective when learning {topic}?",
             ["A) Memorising definitions only",
              "B) Combining theory with hands-on practice and examples",
              "C) Skipping foundational concepts and jumping to advanced topics",
              "D) Relying solely on lectures without self-study"],
             "B",
             "Combining theoretical understanding with practical application accelerates mastery of any subject."),
            (f"What does mastery of {topic} typically require?",
             ["A) Memorisation of all formulas",
              "B) Understanding underlying principles and their connections",
              "C) Reading a single textbook cover-to-cover",
              "D) Only watching video tutorials"],
             "B",
             "True mastery involves understanding why concepts work, not just how to apply them."),
            (f"How does {topic} relate to broader knowledge in its field?",
             [f"A) {topic} is entirely isolated from other concepts",
              f"B) {topic} builds on foundational ideas and connects to advanced topics in the field",
              f"C) {topic} is only relevant to beginners",
              f"D) {topic} was invented recently with no historical context"],
             "B",
             f"{topic} fits within a broader ecosystem of knowledge, building on prerequisites and enabling advanced study."),
        ]

    # ── Slice to requested count ────────────────────────────────────────────
    selected = []
    if num_questions <= len(matched_questions):
        selected = matched_questions[:num_questions]
    else:
        # Repeat/cycle list to reach num_questions
        while len(selected) < num_questions:
            for idx, q in enumerate(matched_questions):
                variant_num = (len(selected) // len(matched_questions)) + 1
                q_text = q[0]
                if variant_num > 1:
                    q_text = f"{q_text} (Review Set {variant_num})"
                selected.append((q_text, q[1], q[2], q[3]))
        selected = selected[:num_questions]

    # ── Format as question dicts ────────────────────────────────────────────
    result = []
    for i, (question, options, correct, explanation) in enumerate(selected):
        result.append({
            "id": i + 1,
            "question": question,
            "options": options,
            "correct_answer": correct,
            "explanation": explanation,
            "difficulty": difficulty,
        })
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Root
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"message": "Welcome to EduAgent API!", "version": "0.2.0"}


# ─────────────────────────────────────────────────────────────────────────────
# Authentication Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    email_lower = user_data.email.lower() if user_data.email else ""
    existing_user = db.query(User).filter(User.email == email_lower).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )
    hashed_pwd = get_password_hash(user_data.password)
    db_user = User(
        email=email_lower,
        hashed_password=hashed_pwd,
        name=user_data.name,
        age=user_data.age,
        role=user_data.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email_lower = form_data.username.lower() if form_data.username else ""
    user = db.query(User).filter(User.email == email_lower).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Generate a password reset token and email it to the user."""
    import secrets
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from dotenv import load_dotenv
    # Re-read .env so new SMTP settings take effect without full restart
    load_dotenv(override=True)

    email_lower = payload.email.lower()
    user = db.query(User).filter(User.email == email_lower).first()
    # Always return 200 to avoid email enumeration attacks
    if not user:
        return {"message": "If that email is registered, a reset link has been sent."}

    # Generate secure token and set expiry (1 hour)
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    db.commit()

    # Build the reset URL
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_link = f"{frontend_url}/auth/reset-password?token={token}"

    # Read SMTP config fresh from env
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USERNAME", "")
    smtp_pass = os.getenv("SMTP_PASSWORD", "")

    display_name = user.name or user.email.split('@')[0]

    if smtp_host and smtp_user and smtp_pass:
        try:
            plain_body = (
                f"Hi {display_name},\n\n"
                "Reset your EduAgent password using the link below (expires in 1 hour):\n"
                f"{reset_link}\n\n"
                "If you didn't request this, ignore this email.\n\n"
                "\u2013 EduAgent Team"
            )
            html_body = (
                "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
                "<body style='margin:0;padding:0;background:#0d1117;font-family:Segoe UI,Arial,sans-serif;'>"
                "<table width='100%' cellpadding='0' cellspacing='0' style='background:#0d1117;padding:40px 0;'>"
                "<tr><td align='center'>"
                "<table width='560' cellpadding='0' cellspacing='0' style='background:#161b22;border-radius:16px;border:1px solid #30363d;overflow:hidden;max-width:560px;'>"
                "<tr><td style='background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;'>"
                "<span style='font-size:26px;font-weight:800;color:#fff;'>&#9679; EduAgent</span>"
                "<p style='color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;'>AI-Powered Learning Platform</p>"
                "</td></tr>"
                "<tr><td style='padding:40px;'>"
                "<h2 style='color:#f0f6fc;font-size:22px;margin:0 0 12px;font-weight:700;'>Password Reset Request</h2>"
                f"<p style='color:#8b949e;font-size:15px;line-height:1.6;margin:0 0 24px;'>"
                f"Hi <strong style='color:#c9d1d9;'>{display_name}</strong>,<br><br>"
                f"We received a request to reset the password for your EduAgent account "
                f"(<strong style='color:#c9d1d9;'>{user.email}</strong>). "
                "Click the button below to set a new password.</p>"
                "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
                "<td align='center' style='padding:8px 0 32px;'>"
                f"<a href='{reset_link}' style='display:inline-block;background:linear-gradient(135deg,#6366f1,#5356e3);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;'>Reset My Password</a>"
                "</td></tr></table>"
                "<p style='color:#8b949e;font-size:13px;margin:0 0 8px;'>Button not working? Copy and paste this link into your browser:</p>"
                f"<p style='word-break:break-all;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:10px 14px;font-size:12px;color:#6366f1;margin:0 0 28px;'>{reset_link}</p>"
                "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
                "<td style='background:#1c2128;border:1px solid #30363d;border-radius:8px;padding:16px;'>"
                "<p style='color:#8b949e;font-size:13px;margin:0;line-height:1.5;'>"
                "This link expires in <strong style='color:#c9d1d9;'>1 hour</strong>.<br>"
                "If you didn't request this, you can safely ignore this email."
                "</p></td></tr></table>"
                "</td></tr>"
                "<tr><td style='border-top:1px solid #30363d;padding:20px 40px;text-align:center;'>"
                "<p style='color:#484f58;font-size:12px;margin:0;'>&copy; 2026 EduAgent</p>"
                "</td></tr>"
                "</table></td></tr></table></body></html>"
            )
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "EduAgent \u2013 Reset Your Password"
            msg["From"] = f"EduAgent <{smtp_user}>"
            msg["To"] = user.email
            msg.attach(MIMEText(plain_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [user.email], msg.as_string())
            logger.info(f"Password reset email sent successfully to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send reset email to {user.email}: {e}")
    else:
        logger.warning("SMTP not configured. Reset link logged to console.")
        print(f"\n\U0001f517 PASSWORD RESET LINK for {user.email}:\n{reset_link}\n")

    return {"message": "If that email is registered, a reset link has been sent."}



@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validate reset token and update the user's password."""
    user = db.query(User).filter(User.reset_token == payload.token).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token.",
        )
    if datetime.datetime.utcnow() > user.reset_token_expires:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )
    user.hashed_password = get_password_hash(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"message": "Password updated successfully. You can now sign in with your new password."}


# ─────────────────────────────────────────────────────────────────────────────
# Study Session Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/api/sessions/start", response_model=StudySessionResponse)
def start_session(session_data: StudySessionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    active_session = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.end_time == None,
    ).first()
    if active_session:
        return active_session

    db_session = StudySession(
        user_id=current_user.id,
        topic_id=session_data.topic_id,
        start_time=datetime.datetime.utcnow(),
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


@app.post("/api/sessions/stop", response_model=StudySessionResponse)
def stop_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    active_session = db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.end_time == None,
    ).first()
    if not active_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active study session found",
        )

    active_session.end_time = datetime.datetime.utcnow()
    delta = active_session.end_time - active_session.start_time
    active_session.duration = delta.total_seconds()
    db.commit()
    db.refresh(active_session)
    return active_session


@app.get("/api/sessions/active", response_model=Optional[StudySessionResponse])
def get_active_session(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(StudySession).filter(
        StudySession.user_id == current_user.id,
        StudySession.end_time == None,
    ).first()


# ─────────────────────────────────────────────────────────────────────────────
# Document Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/documents/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    subject: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a PDF file, parse it, chunk it, generate embeddings, and index in ChromaDB.
    """
    # Validate subject
    if subject not in ALLOWED_SUBJECTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid subject. Choose from: {', '.join(ALLOWED_SUBJECTS)}",
        )

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported.",
        )

    # Build safe file path
    safe_name = f"user_{current_user.id}_{int(datetime.datetime.utcnow().timestamp())}_{file.filename}"
    file_path = os.path.join(UPLOADS_DIR, safe_name)

    # Save file to disk
    contents = await file.read()
    file_size = len(contents)
    if file_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    with open(file_path, "wb") as f:
        f.write(contents)

    # Create a preliminary DB record so we have an id for ChromaDB metadata
    db_doc = Document(
        filename=file.filename,
        file_path=file_path,
        subject=subject,
        file_size=file_size,
        num_chunks=0,
        user_id=current_user.id,
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    # Parse PDF into chunks
    try:
        chunks = parse_pdf_to_chunks(
            file_path=file_path,
            document_id=db_doc.id,
            user_id=current_user.id,
            filename=file.filename,
        )
    except Exception as exc:
        # Clean up on parse failure
        db.delete(db_doc)
        db.commit()
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"PDF parsing failed: {str(exc)}",
        )

    if not chunks:
        db.delete(db_doc)
        db.commit()
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No extractable text found in this PDF. It may be a scanned image.",
        )

    # Index chunks in ChromaDB
    try:
        for chunk in chunks:
            if "metadata" not in chunk:
                chunk["metadata"] = {}
            chunk["metadata"]["subject"] = subject
        num_indexed = index_document_chunks(chunks)
    except Exception as exc:
        db.delete(db_doc)
        db.commit()
        os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector indexing failed: {str(exc)}",
        )

    # Update num_chunks in DB
    db_doc.num_chunks = num_indexed
    db.commit()
    db.refresh(db_doc)

    return db_doc


@app.get("/api/documents", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all documents uploaded by the current user."""
    return (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )


@app.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document from PostgreSQL and remove its vectors from ChromaDB."""
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Remove ChromaDB vectors
    delete_document_vectors(document_id)

    # Remove file from disk
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)
    db.commit()


@app.get("/api/documents/stats", response_model=DocumentStats)
def get_document_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return aggregate stats for the current user's knowledge base."""
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    total_chunks = sum(d.num_chunks for d in docs)
    subjects = list({d.subject for d in docs})
    chroma_size = get_collection_size()

    return DocumentStats(
        total_documents=len(docs),
        total_chunks=total_chunks,
        subjects=subjects,
        chroma_collection_size=chroma_size,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Analytics / Dashboard Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/analytics/dashboard")
def get_dashboard_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Fetch sessions & compute total hours
    sessions = db.query(StudySession).filter(StudySession.user_id == current_user.id).all()
    total_seconds = sum(s.duration for s in sessions if s.duration is not None)
    study_hours = total_seconds / 3600.0

    # 2. Fetch quiz attempts & compute average
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    quizzes_count = len(attempts)
    
    if quizzes_count > 0:
        quiz_avg = sum(a.score for a in attempts) / quizzes_count
    else:
        quiz_avg = 0.0

    # 3. Fetch documents
    docs_count = db.query(Document).filter(Document.user_id == current_user.id).count()
    # Completion rate used for ML predictor (doc-based proxy)
    completion_rate = min(docs_count / 8.0, 1.0)  # 8 docs = 100% for predictor input

    # Determine if user has any active learning data
    has_data = bool(quizzes_count > 0 or docs_count > 0 or len(sessions) > 0)

    # 4. Predict expected score using global RF model
    if has_data:
        predicted_score, mastery_prob = predictor.predict_performance(
            quiz_average=quiz_avg,
            study_hours=study_hours,
            attempts_count=quizzes_count,
            completion_rate=completion_rate,
        )
        confidence_percentage = f"{int(mastery_prob * 100)}%"
    else:
        predicted_score = 0
        confidence_percentage = "0%"

    # Format the stats cards dynamically
    stats = [
        {"title": "Study Hours", "value": f"{study_hours:.1f}", "trend": "up" if study_hours > 0 else "neutral", "percentage": "12%" if study_hours > 0 else "0%"},
        {"title": "Quizzes Attempted", "value": str(quizzes_count), "trend": "up" if quizzes_count > 0 else "neutral", "percentage": "8%" if quizzes_count > 0 else "0%"},
        {"title": "Average Score", "value": f"{int(quiz_avg)}%", "trend": "up" if quiz_avg >= 70 else "down" if quiz_avg > 0 else "neutral", "percentage": "3%" if quiz_avg > 0 else "0%"},
        {"title": "Quiz Performance", "value": f"{int(quiz_avg)}%", "trend": "up" if quiz_avg >= 70 else "down" if quiz_avg > 0 else "neutral", "percentage": f"+{int(quiz_avg - 50)}%" if quiz_avg > 50 else "0%"},
    ]

    # Gather unique subjects from documents and quiz attempts
    user_subjects = set()
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    for doc in docs:
        if doc.subject:
            user_subjects.add(doc.subject)
    
    subject_scores = {}
    for a in attempts:
        if a.topic and a.topic.subject:
            subj = a.topic.subject
            user_subjects.add(subj)
            if subj not in subject_scores:
                subject_scores[subj] = []
            subject_scores[subj].append(a.score)

    color_map = {
        "Computer Networks": "#6366F1",
        "Algorithms": "#EC4899",
        "Database Systems": "#10B981",
        "System Design": "#F59E0B",
        "Operating Systems": "#3B82F6",
        "Machine Learning": "#8B5CF6",
        "Mathematics": "#EF4444"
    }
    
    default_colors = ["#14B8A6", "#06B6D4", "#F43F5E", "#8B5CF6", "#10B981", "#F59E0B"]
    
    subjects_progress = []
    sorted_subjects = sorted(list(user_subjects))
    for idx, subj in enumerate(sorted_subjects):
        scores = subject_scores.get(subj, [])
        prog = int(sum(scores) / len(scores)) if len(scores) > 0 else 0
        color = color_map.get(subj, default_colors[idx % len(default_colors)])
        subjects_progress.append({
            "subject": subj,
            "progress": prog,
            "color": color
        })

    # Render study activity heatmap (real dates based on user sessions, fill remainder with 0s)
    today = datetime.date.today()
    heatmap = []
    session_dates = {s.start_time.date(): (s.duration or 0) / 3600.0 for s in sessions if s.start_time}
    
    for i in range(30):
        date = today - datetime.timedelta(days=i)
        hours = session_dates.get(date, 0.0)
        heatmap.append({"date": date.isoformat(), "hours": round(hours, 2)})

    return {
        "subjects_progress": subjects_progress,
        "stats": stats,
        "predicted_score": int(predicted_score),
        "prediction_confidence": confidence_percentage,
        "heatmap": heatmap,
        "has_data": has_data,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Multi-Agent AI Endpoints
# ─────────────────────────────────────────────────────────────────────────────

# Helper to check if Groq key is set to a real value
def get_groq_api_key(x_groq_api_key: Optional[str] = Header(None)) -> Optional[str]:
    if x_groq_api_key and x_groq_api_key.strip() and x_groq_api_key.strip().lower() not in ["null", "undefined", ""]:
        return x_groq_api_key.strip()
    key = os.getenv("GROQ_API_KEY")
    if not key or key in ["your_groq_api_key_here", "your_gemini_api_key_here"]:
        return None
    return key


@app.post("/api/chat", response_model=ChatResponse)
def chat_explain(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    key: Optional[str] = Depends(get_groq_api_key),
):
    if not key:
        logger.info("GROQ_API_KEY is not set. Returning mock explanation.")
        return ChatResponse(
            answer=f"### Understanding {req.subject or 'your concept'} (Demo Mode)\nThis is a demonstration explanation because `GEMINI_API_KEY` is not configured. Once you add your key, I will explain concepts related to **{req.subject or 'your uploaded notes'}** using RAG.",
            sources=[
                {
                    "filename": "Sample_Document.pdf",
                    "page": "1",
                    "subject": req.subject or "General",
                    "preview": "This is a demo preview for your query.",
                    "text": "This is a demo text chunk."
                }
            ],
            model="mock-gemini-1.5-flash",
            used_knowledge_base=True,
        )

    try:
        res = run_explainer(
            question=req.question,
            api_key=key,
            user_id=current_user.id,
            subject_filter=req.subject,
        )
        return ChatResponse(
            answer=res["answer"],
            sources=res["sources"],
            model=res["model"],
            used_knowledge_base=res["used_knowledge_base"],
        )
    except Exception as e:
        logger.exception("Explainer agent failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Explainer agent error: {str(e)}",
        )


@app.post("/api/quiz/generate", response_model=QuizGenerateResponse)
def generate_quiz(
    req: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    key: Optional[str] = Depends(get_groq_api_key),
):
    if not key:
        logger.info("GROQ_API_KEY not set — using topic-aware demo questions.")
        topic_label = req.topic or "General Knowledge"
        diff_label = req.difficulty or "Intermediate"
        mock_questions = _generate_topic_mock_questions(topic_label, diff_label, req.num_questions or 5)
        return QuizGenerateResponse(
            questions=mock_questions,
            topic=req.topic,
            difficulty=req.difficulty,
            num_questions=len(mock_questions),
            used_knowledge_base=False,
            model="demo-mode-add-groq-key",
        )

    try:
        res = run_quiz_generator(
            topic=req.topic,
            api_key=key,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
            user_id=current_user.id,
            subject=req.subject,
        )
        return QuizGenerateResponse(
            questions=res["questions"],
            topic=res["topic"],
            difficulty=res["difficulty"],
            num_questions=res["num_questions"],
            used_knowledge_base=res["used_knowledge_base"],
            model=res["model"],
        )
    except Exception as e:
        logger.exception("Quiz generator agent failed")
        err_str = str(e)
        if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Gemini API quota exhausted. Your API key has used up its free-tier limit. "
                    "Please get a new key at https://aistudio.google.com/apikey"
                ),
            )
        if "API_KEY_INVALID" in err_str or "401" in err_str or "403" in err_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Invalid Gemini API key. Please get a valid key at https://aistudio.google.com/apikey "
                    "(keys start with 'AIza...')"
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quiz generator error: {err_str}",
        )


@app.post("/api/quiz/attempt", response_model=QuizAttemptResponse)
def create_quiz_attempt(
    req: QuizAttemptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    topic_id = req.topic_id
    if not topic_id and req.topic:
        subj = req.subject or "Other"
        db_topic = db.query(Topic).filter(Topic.title == req.topic).first()
        if not db_topic:
            db_topic = Topic(title=req.topic, subject=subj)
            db.add(db_topic)
            db.commit()
            db.refresh(db_topic)
        topic_id = db_topic.id

    attempt = QuizAttempt(
        user_id=current_user.id,
        topic_id=topic_id,
        score=req.score,
        total_questions=req.total_questions,
        difficulty=req.difficulty,
        timestamp=datetime.datetime.utcnow(),
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@app.get("/api/quiz/attempts", response_model=List[QuizAttemptResponse])
def list_quiz_attempts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.timestamp.desc())
        .all()
    )


@app.post("/api/quiz/coach-report", response_model=CoachReportResponse)
def get_quiz_coach_report(
    req: CoachReportRequest,
    current_user: User = Depends(get_current_user),
    key: Optional[str] = Depends(get_groq_api_key),
):
    try:
        # Convert pydantic models to dictionaries
        questions_dicts = []
        for q in req.questions:
            questions_dicts.append({
                "id": q.id,
                "question": q.question,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "difficulty": q.difficulty,
            })
        
        res = run_coach_report(
            questions=questions_dicts,
            answers=req.answers,
            score=req.score,
            subject=req.subject,
            topic=req.topic,
            time_taken=req.time_taken,
            api_key=key,
        )
        return CoachReportResponse(
            report=res["report"],
            model=res["model"],
            persona=res.get("persona"),
            summary=res.get("summary"),
            strengths=res.get("strengths"),
            weaknesses=res.get("weaknesses"),
            patterns=res.get("patterns"),
            tutor_advice=res.get("tutor_advice"),
            next_steps=res.get("next_steps"),
            challenge_problems=res.get("challenge_problems"),
            confidence=res.get("confidence"),
        )
    except Exception as e:
        logger.exception("Coach report agent failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Coach report generator error: {str(e)}",
        )


@app.post("/api/study-plan", response_model=StudyPlanResponse)
def generate_study_plan_endpoint(
    req: StudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key: Optional[str] = Depends(get_groq_api_key),
):
    recent_attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.user_id == current_user.id)
        .all()
    )
    
    quiz_history = []
    for att in recent_attempts:
        subject_name = "General"
        if att.topic_id:
            topic = db.query(Topic).filter(Topic.id == att.topic_id).first()
            if topic:
                subject_name = topic.subject
        quiz_history.append({
            "subject": subject_name,
            "score": att.score,
            "difficulty": att.difficulty
        })

    if not key:
        logger.info("GEMINI_API_KEY is not set. Returning mock study plan.")
        days_diff = None
        if req.exam_date:
            try:
                exam_dt = datetime.date.fromisoformat(req.exam_date)
                days_diff = (exam_dt - datetime.date.today()).days
            except ValueError:
                pass

        subjects_str = ", ".join(req.subjects) if req.subjects else "General Computer Science"
        mock_plan = f"""# Personalized Study Plan (Demo Mode)

Hello! This is a personalized study guide draft for **{subjects_str}**.

Once you set a valid `GEMINI_API_KEY` in `backend/.env` and restart the server, the Study Planner agent will read your actual quiz histories and generate a week-by-week program.

### Recommended Allocation:
- **Study time**: {req.study_hours_per_day} hours per day
- **Timeline**: {f"{days_diff} days remaining" if days_diff else "Continuous learning schedule"}

### Recommended Weekly Roadmap:
1. **First Phase**: Review textbook definitions and core slides uploaded in the workspace.
2. **Second Phase**: Generate and solve Intermediate-level quizzes on weak areas.
3. **Revision Phase**: Focus on mock exams 48 hours prior to your test.
"""
        return StudyPlanResponse(
            plan=mock_plan,
            subjects=req.subjects,
            exam_date=req.exam_date,
            days_until_exam=days_diff,
            study_hours_per_day=req.study_hours_per_day,
            model="mock-gemini-1.5-flash",
        )

    try:
        res = run_study_plan(
            api_key=key,
            subjects=req.subjects,
            exam_date=req.exam_date,
            quiz_scores=quiz_history,
            study_hours_per_day=req.study_hours_per_day,
            user_name=current_user.email.split("@")[0],
        )
        return StudyPlanResponse(
            plan=res["plan"],
            subjects=res["subjects"],
            exam_date=res["exam_date"],
            days_until_exam=res["days_until_exam"],
            study_hours_per_day=res["study_hours_per_day"],
            model=res["model"],
        )
    except Exception as e:
        logger.exception("Study planner agent failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Study planner error: {str(e)}",
        )


@app.post("/api/goals", response_model=StudyGoalResponse)
def create_study_goal(
    req: StudyGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = StudyGoal(
        user_id=current_user.id,
        subject=req.subject,
        target_hours=req.target_hours,
        target_score=req.target_score,
        deadline=req.deadline,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@app.get("/api/goals", response_model=List[StudyGoalResponse])
def list_study_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(StudyGoal)
        .filter(StudyGoal.user_id == current_user.id)
        .order_by(StudyGoal.created_at.desc())
        .all()
    )


@app.delete("/api/goals/{goal_id}")
def delete_study_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = (
        db.query(StudyGoal)
        .filter(StudyGoal.id == goal_id, StudyGoal.user_id == current_user.id)
        .first()
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Study goal not found")
    db.delete(goal)
    db.commit()
    return {"status": "success", "message": "Study goal deleted successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# Spaced Repetition Flashcard Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/flashcards/generate", response_model=List[FlashcardResponse])
def generate_flashcards(
    req: FlashcardGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key: Optional[str] = Depends(get_groq_api_key),
):
    topic_str = req.topic or ""
    query_str = topic_str if topic_str else req.subject
    
    cards_data = []
    if not key:
        logger.info("GROQ_API_KEY is not set. Generating mock flashcards.")
        query_lower = query_str.lower()
        
        matched_bank = None
        for k, v in {
            "merge sort": [
                {"front": "What algorithmic paradigm does Merge Sort use?", "back": "Divide and Conquer. It recursively splits the array in half, sorts the halves, and then merges them."},
                {"front": "What is the worst-case time complexity of Merge Sort?", "back": "O(n log n). Splitting takes O(log n) levels, and merging takes O(n) work per level, regardless of input distribution."},
                {"front": "Is Merge Sort a stable sorting algorithm?", "back": "Yes. It preserves the relative order of duplicate elements because of how elements are compared and placed during the merge step."},
                {"front": "What is the main drawback of Merge Sort?", "back": "Space complexity. It requires O(n) auxiliary space to store temporary subarrays during the merge step, unlike in-place algorithms like Quick Sort."},
                {"front": "Compare the space complexity of Merge Sort vs Quick Sort.", "back": "Merge Sort is O(n) due to temporary merge arrays. Quick Sort is O(log n) on average due to recursive call stack storage."}
            ],
            "quick sort": [
                {"front": "What is the worst-case time complexity of Quick Sort, and when does it occur?", "back": "O(n²). It occurs when the partition pivot is consistently the smallest or largest element, e.g., on already sorted data with a naive pivot choice."},
                {"front": "What is the average-case time complexity of Quick Sort?", "back": "O(n log n). This occurs when the pivot splits the array into reasonably balanced partitions."},
                {"front": "Explain the concept of 'in-place' in relation to Quick Sort.", "back": "Quick Sort is in-place because it rearranges elements within the original array, requiring only O(log n) call stack space for recursion, rather than a full copy of the dataset."},
                {"front": "Why is random pivot selection used in Quick Sort?", "back": "It randomizes the partitions to prevent the worst-case O(n²) runtime from occurring on already sorted or reverse-sorted inputs."},
                {"front": "Is standard Quick Sort stable?", "back": "No, standard Quick Sort is not stable because swapping elements around the pivot can change the relative order of equal items."}
            ],
            "binary search": [
                {"front": "What is the time complexity of Binary Search?", "back": "O(log n). The search space is divided in half with each comparison."},
                {"front": "What precondition must be met before performing Binary Search?", "back": "The array/list must be sorted. Binary search relies on the ordering to eliminate half of the elements at each step."},
                {"front": "Explain the calculation of the middle index to avoid integer overflow.", "back": "Use mid = lo + (hi - lo) // 2 instead of (lo + hi) // 2 to avoid overflow when sum of lo and hi exceeds max integer limit."},
                {"front": "What is the space complexity of iterative Binary Search?", "back": "O(1) auxiliary space, as it only uses a few pointers to track the current search range."},
                {"front": "What is the worst-case number of comparisons for Binary Search on a list of size N?", "back": "floor(log2(N)) + 1 comparisons."}
            ]
        }.items():
            if k in query_lower:
                matched_bank = v
                break
        
        if matched_bank:
            cards_data = matched_bank[:req.num_cards]
        else:
            cards_data = [
                {"front": f"What is the definition of {query_str}?", "back": f"A key concept in {req.subject} representing a core structure or algorithm."},
                {"front": f"Name a primary use case or application of {query_str}.", "back": f"It is widely used in {req.subject} to build scalable, correct, and optimal solutions."},
                {"front": f"What are the key trade-offs when using {query_str}?", "back": "Time complexity vs memory usage, and implementation simplicity vs execution speed."},
                {"front": f"How does {query_str} scale with larger datasets?", "back": "Scales based on its complexity, usually requiring caching, indexing, or load balancing in large systems."},
                {"front": f"What is a common error or pitfall when implementing {query_str}?", "back": "Edge cases like boundary conditions, null/empty inputs, and thread concurrency errors."}
            ][:req.num_cards]
    else:
        try:
            res = run_flashcard_generator(
                subject=req.subject,
                topic=req.topic,
                num_cards=req.num_cards,
                api_key=key,
                user_id=current_user.id
            )
            cards_data = res["cards"]
        except Exception as e:
            logger.exception("Flashcard generator agent failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Flashcard generator error: {str(e)}"
            )

    db_cards = []
    for c in cards_data:
        db_card = Flashcard(
            user_id=current_user.id,
            front=c["front"],
            back=c["back"],
            subject=req.subject,
            leitner_box=1,
            next_review=datetime.datetime.utcnow(),
            created_at=datetime.datetime.utcnow(),
        )
        db.add(db_card)
        db_cards.append(db_card)
    db.commit()
    for card in db_cards:
        db.refresh(card)
        
    return db_cards


@app.get("/api/flashcards", response_model=List[FlashcardResponse])
def get_flashcards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Flashcard).filter(Flashcard.user_id == current_user.id).all()


@app.get("/api/flashcards/review", response_model=List[FlashcardResponse])
def get_due_flashcards(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now = datetime.datetime.utcnow()
    return db.query(Flashcard).filter(
        Flashcard.user_id == current_user.id,
        Flashcard.next_review <= now
    ).all()


@app.post("/api/flashcards/{flashcard_id}/review", response_model=FlashcardResponse)
def review_flashcard(
    flashcard_id: int,
    req: FlashcardReviewSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    card = db.query(Flashcard).filter(
        Flashcard.id == flashcard_id,
        Flashcard.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
        
    rating = req.rating.lower()
    
    if rating == "easy":
        card.leitner_box = min(card.leitner_box + 1, 5)
    elif rating == "medium":
        pass
    elif rating == "hard":
        card.leitner_box = 1
    else:
        raise HTTPException(status_code=400, detail="Invalid review rating. Choose 'easy', 'medium', or 'hard'")
        
    intervals = {
        1: datetime.timedelta(hours=1),
        2: datetime.timedelta(days=1),
        3: datetime.timedelta(days=3),
        4: datetime.timedelta(days=7),
        5: datetime.timedelta(days=14),
    }
    
    interval = intervals.get(card.leitner_box, datetime.timedelta(hours=1))
    card.next_review = datetime.datetime.utcnow() + interval
    
    db.commit()
    db.refresh(card)
    return card


@app.delete("/api/flashcards/{flashcard_id}")
def delete_flashcard(
    flashcard_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    card = db.query(Flashcard).filter(
        Flashcard.id == flashcard_id,
        Flashcard.user_id == current_user.id
    ).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
        
    db.delete(card)
    db.commit()
    return {"status": "success", "message": "Flashcard deleted successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# AI Study Analytics & Mastery Endpoints
# ─────────────────────────────────────────────────────────────────────────────

from .schemas import SubjectMastery

@app.get("/api/analytics/mastery", response_model=MasteryResponse)
def get_study_mastery(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key: Optional[str] = Depends(get_groq_api_key)
):
    sessions = db.query(StudySession).filter(StudySession.user_id == current_user.id).all()
    attempts = db.query(QuizAttempt).filter(QuizAttempt.user_id == current_user.id).all()
    
    subjects = [s for s in ALLOWED_SUBJECTS if s != "Other"]
    
    topics = db.query(Topic).all()
    topic_to_subject = {t.id: t.subject for t in topics}
    
    study_seconds_by_subject = {}
    for s in sessions:
        subj = "General"
        if s.topic_id and s.topic_id in topic_to_subject:
            subj = topic_to_subject[s.topic_id]
        study_seconds_by_subject[subj] = study_seconds_by_subject.get(subj, 0.0) + (s.duration or 0.0)
        
    quiz_scores_by_subject = {}
    for a in attempts:
        subj = "General"
        if a.topic_id and a.topic_id in topic_to_subject:
            subj = topic_to_subject[a.topic_id]
        elif a.topic and a.topic.subject:
            subj = a.topic.subject
        if subj not in quiz_scores_by_subject:
            quiz_scores_by_subject[subj] = []
        quiz_scores_by_subject[subj].append(a.score)
        
    subject_masteries = []
    weaknesses = []
    
    for subj in subjects:
        hours = study_seconds_by_subject.get(subj, 0.0) / 3600.0
        scores = quiz_scores_by_subject.get(subj, [])
        avg_score = sum(scores) / len(scores) if scores else 0.0
        
        if scores:
            hours_component = min(hours / 10.0, 1.0) * 30.0
            score_component = (avg_score / 100.0) * 70.0
            mastery = score_component + hours_component
        else:
            mastery = min(hours / 10.0, 1.0) * 50.0
            
        mastery = round(min(max(mastery, 0.0), 100.0), 1)
        
        subject_masteries.append(SubjectMastery(
            subject=subj,
            quiz_score_avg=round(avg_score, 1),
            study_hours=round(hours, 2),
            mastery_pct=mastery,
            quiz_count=len(scores)
        ))
        
        if (scores and avg_score < 70.0) or (hours > 1.0 and not scores):
            weaknesses.append(subj)
            
    total_study_hours = sum(s.duration or 0.0 for s in sessions) / 3600.0
    all_scores = [a.score for a in attempts]
    overall_quiz_avg = sum(all_scores) / len(all_scores) if all_scores else 0.0
    
    active_masteries = [sm.mastery_pct for sm in subject_masteries if sm.quiz_count > 0 or sm.study_hours > 0]
    overall_mastery = sum(active_masteries) / len(active_masteries) if active_masteries else 0.0
    overall_mastery = round(min(max(overall_mastery, 0.0), 100.0), 1)
    
    ai_recommendations = ""
    model_name = "demo-coach-model"
    
    subject_details_str = "\n".join([
        f"- {sm.subject}: Study Hours = {sm.study_hours:.1f}, Quiz Avg = {sm.quiz_score_avg:.1f}%, Mastery = {sm.mastery_pct}%"
        for sm in subject_masteries
    ])
    
    if key:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage
        try:
            llm = ChatGroq(
                model="llama-3.3-70b-versatile",
                groq_api_key=key,
                temperature=0.3,
                max_tokens=500
            )
            prompt = f"""You are EduAgent's expert AI Coach. Analyze this student's performance report:
User: {current_user.email.split("@")[0]}
Overall Study Hours: {total_study_hours:.1f} hours
Overall Quiz Average: {overall_quiz_avg:.1f}%

Performance details by subject:
{subject_details_str}

Identify their primary weaknesses and provide 3 concrete, actionable learning recommendations (e.g. which subjects to study, what kinds of practice to focus on, how to use flashcards). Keep it encouraging and bulleted. Keep the entire response under 150 words."""
            
            res = llm.invoke([HumanMessage(content=prompt)])
            ai_recommendations = res.content.strip()
            model_name = "llama-3.3-70b-versatile (Groq)"
        except Exception as e:
            logger.warning(f"AI Coach API call failed: {e}")
            key = None
            
    if not key:
        if not weaknesses:
            ai_recommendations = (
                "### Excellent Work!\n"
                "• You have consistent mastery across all subjects. Maintain this pace!\n"
                "• Start testing yourself with **Advanced** difficulty quizzes to push your boundaries.\n"
                "• Use the Flashcards page regularly to ensure long-term retention of key concepts."
            )
        else:
            weaknesses_str = ", ".join(weaknesses)
            ai_recommendations = (
                f"### Actions to Improve in {weaknesses_str}:\n"
                f"• **Focus Study**: Dedicate your next study session specifically to **{weaknesses[0]}** to raise your performance.\n"
                "• **Generate Flashcards**: Use the Flashcard generator on these topics. Spaced repetition will help commit core terms to memory.\n"
                "• **Targeted Quizzes**: Take 2-3 short quizzes at **Beginner** or **Intermediate** level in your weak areas before advancing."
            )
            
    return MasteryResponse(
        subjects=subject_masteries,
        overall_mastery=overall_mastery,
        weaknesses=weaknesses,
        ai_recommendations=ai_recommendations,
        model=model_name
    )

