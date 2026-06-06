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
from .models import User, Topic, StudySession, QuizAttempt, Document, StudyGoal
from .schemas import (
    UserCreate, UserResponse, Token,
    StudySessionResponse, StudySessionCreate,
    DocumentResponse, DocumentStats,
    ChatRequest, ChatResponse,
    QuizGenerateRequest, QuizGenerateResponse, QuizAttemptCreate, QuizAttemptResponse,
    StudyPlanRequest, StudyPlanResponse,
    StudyGoalCreate, StudyGoalResponse,
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Initialize database tables & ChromaDB collection at startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
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
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered",
        )
    hashed_pwd = get_password_hash(user_data.password)
    db_user = User(email=user_data.email, hashed_password=hashed_pwd)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
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

    # 3. Fetch documents to compute syllabus completion rate
    docs_count = db.query(Document).filter(Document.user_id == current_user.id).count()
    completion_rate = min(docs_count * 0.25, 1.0) # 4 docs = 100% completion in baseline

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
        {"title": "Syllabus Mastered", "value": f"{int(completion_rate * 100)}%", "trend": "up" if completion_rate > 0 else "neutral", "percentage": "15%" if completion_rate > 0 else "0%"},
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

# Helper to check if Gemini key is set to a real value
def get_gemini_api_key(x_gemini_api_key: Optional[str] = Header(None)) -> Optional[str]:
    if x_gemini_api_key and x_gemini_api_key.strip() and x_gemini_api_key.strip().lower() not in ["null", "undefined", ""]:
        return x_gemini_api_key.strip()
    key = os.getenv("GEMINI_API_KEY")
    if not key or key == "your_gemini_api_key_here":
        return None
    return key


@app.post("/api/chat", response_model=ChatResponse)
def chat_explain(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    key: Optional[str] = Depends(get_gemini_api_key),
):
    if not key:
        logger.info("GEMINI_API_KEY is not set. Returning mock explanation.")
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
    key: Optional[str] = Depends(get_gemini_api_key),
):
    if not key:
        logger.info("GEMINI_API_KEY not set — using topic-aware demo questions.")
        topic_label = req.topic or "General Knowledge"
        diff_label = req.difficulty or "Intermediate"
        mock_questions = _generate_topic_mock_questions(topic_label, diff_label, req.num_questions or 5)
        return QuizGenerateResponse(
            questions=mock_questions,
            topic=req.topic,
            difficulty=req.difficulty,
            num_questions=len(mock_questions),
            used_knowledge_base=False,
            model="demo-mode-add-gemini-key",
        )

    try:
        res = run_quiz_generator(
            topic=req.topic,
            api_key=key,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
            user_id=current_user.id,
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quiz generator error: {str(e)}",
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


@app.post("/api/study-plan", response_model=StudyPlanResponse)
def generate_study_plan_endpoint(
    req: StudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key: Optional[str] = Depends(get_gemini_api_key),
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

