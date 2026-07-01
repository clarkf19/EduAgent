# 🎓 EduAgent — Cooperative Multi-Agent AI Learning Suite

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-blue?logo=nextdotjs&logoColor=white&style=flat-square)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green?logo=fastapi&logoColor=white&style=flat-square)](https://fastapi.tiangolo.com/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-orange?style=flat-square)](https://www.trychroma.com/)
[![LangChain](https://img.shields.io/badge/Framework-LangChain-red?style=flat-square)](https://www.langchain.com/)

**EduAgent** is a production-grade multi-agent learning platform that transforms dense study materials (lecture slides, notes, and textbooks) into interactive, personalized educational pathways. By coordinating a cooperative swarm of specialized AI agents, the platform constructs concept mind maps, generates adaptive practice quizzes, designs day-by-day study calendars, and answers complex follow-up questions with precise citations.

---

## 🤖 The Cooperative Agent Swarm

The workspace coordinates four autonomous agents to optimize academic performance:

*   **👨‍🏫 Teacher Agent**: Analyzes uploaded document files, extracts core concepts, structures definitions, and compiles real-world study guides.
*   **💬 Doubt Solver**: Answers student queries, retrieving context from the vector database and citing original source documents with inline footnotes.
*   **📝 Quiz Generator**: Formulates personalized, multiple-choice practice quizzes that scale in difficulty (Beginner, Intermediate, Advanced) based on performance logs.
*   **📅 Study Planner**: Generates calendar roadmaps mapping milestones from study topics directly to your exam date.

---

## 🛠️ Architecture & Workflow

```mermaid
graph TD
    User([Student]) -->|Uploads PDF Notes| Gateway[System Gateway]
    Gateway -->|Parse Text Chunks| Embedding[Sentence Transformers]
    Embedding -->|Save Vectors| Chroma[(ChromaDB)]
    
    User -->|Queries / Requests Quiz| Orchestrator{Agent Orchestrator}
    Orchestrator -->|Vector Lookup| Chroma
    
    Orchestrator -->|Analyze Concepts| Teacher[Teacher Agent]
    Orchestrator -->|Formulate Q&A| Doubt[Doubt Solver]
    Orchestrator -->|Generate MCQs| Quiz[Quiz Master]
    Orchestrator -->|Map Milestones| Planner[Study Planner]
    
    Teacher & Doubt & Quiz & Planner -->|Coordinated LLM Output| UI[Interactive Glassmorphic Next.js UI]
    UI --> User
```

---

## ⚡ Tech Stack

### Frontend
*   **Next.js 16** (App Router) & TypeScript
*   **Vanilla CSS Glassmorphism** (Zero tailwind bloat, tailored dark themes, sleek responsive grids)
*   **HTML5 Canvas** (Dynamic mind map node layouts with physics-based coordinates)
*   **Vercel** (Global CDN and static edge hosting)

### Backend
*   **FastAPI** (Python 3.11 asynchronous web framework)
*   **LangChain** (Agent routing and chain integration)
*   **ChromaDB** (Local vector database indexing embeddings)
*   **SQLAlchemy & SQLite** (User profile analytics, quiz logs, and study schedules)
*   **Models**: Groq (Llama 3.3 70B for instant quiz compilation) & Google Gemini (for advanced grounding/parsing)

---

## 🚀 Local Development Setup

### Prerequisites
*   Node.js (v20+)
*   Python (3.11+)
*   Docker & Docker Compose (optional)

### Backend Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create your local environment file:
   ```bash
   cp .env.example .env
   ```
3. Populate your `.env` with your API keys (e.g. `GROQ_API_KEY`, `GEMINI_API_KEY`, and Gmail App credentials for SMTP password resets).
4. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

### Frontend Configuration
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Create your local environment file:
   ```bash
   echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" > .env.local
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Deployment (Self-Hosted)
To spin up the entire application stack locally using Docker:
```bash
docker-compose up --build
```
This builds the backend, builds the Next.js frontend, and configures an Nginx reverse-proxy on port `80`.

---

## 🔒 Production Operations
For detailed guides on production environments (e.g., Vercel + DigitalOcean Droplet with SSL certificates, database backups, and environment configs), refer to the **[DEPLOYMENT.md](DEPLOYMENT.md)** runbook.
