"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

interface UploadStage {
  id: string;
  label: string;
  detail: string;
  icon: string;
  durationMs: number;
}

const UPLOAD_STAGES: UploadStage[] = [
  { id: "upload",   label: "Uploading File",          detail: "Sending PDF to server…",                 icon: "📤", durationMs: 600  },
  { id: "parse",    label: "Parsing PDF",              detail: "Extracting text from pages…",            icon: "📖", durationMs: 900  },
  { id: "chunk",    label: "Chunking Content",         detail: "Splitting into semantic segments…",      icon: "✂️", durationMs: 700  },
  { id: "embed",    label: "Generating Embeddings",    detail: "Running all-MiniLM-L6-v2 model…",        icon: "🧠", durationMs: 1200 },
  { id: "index",    label: "Indexing into ChromaDB",   detail: "Storing vectors in knowledge base…",     icon: "⚡", durationMs: 500  },
  { id: "done",     label: "Complete",                 detail: "Document is ready for AI Tutor!",        icon: "✅", durationMs: 0    },
];

// --- Subject List ---
const SUBJECTS = [
  "All Subjects",
  "Computer Networks",
  "Algorithms",
  "Database Systems",
  "System Design",
  "Operating Systems",
  "Machine Learning",
  "Data Structures",
  "Mathematics",
  "Other",
];

// --- Interfaces ---
interface Question {
  id: number;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
}

interface Attempt {
  id: number;
  score: number;
  total_questions: number;
  difficulty: string;
  timestamp: string;
}

// --- Auth Token Helper (localStorage "token" primary source) ---
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const ls = localStorage.getItem("token");
  if (ls) return ls;
  const match = document.cookie.match(/(^| )token=([^;]+)/);
  return match ? match[2] : null;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getAuthToken();
  const apiKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") : null;
  return fetch(`http://127.0.0.1:8000${path}`, {
    ...opts,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Gemini-API-Key": apiKey } : {}),
      ...(opts.headers || {}),
    },
  });
}

// --- Custom Markdown Parser for Theory Explanations ---
function MarkdownRenderer({
  text,
  sources,
  onSourceClick,
}: {
  text: string;
  sources?: any[];
  onSourceClick: (idx: number) => void;
}) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} style={codeBlockStyle}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Process headers, bullet points, empty lines, and paragraphs
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} style={h3Style}>
          {parseInlineFormatting(line.slice(4), sources, onSourceClick)}
        </h3>
      );
      continue;
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={i} style={h4Style}>
          {parseInlineFormatting(line.slice(5), sources, onSourceClick)}
        </h4>
      );
      continue;
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} style={h2Style}>
          {parseInlineFormatting(line.slice(3), sources, onSourceClick)}
        </h2>
      );
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <ul key={i} style={ulStyle}>
          <li style={liStyle}>
            {parseInlineFormatting(line.slice(2), sources, onSourceClick)}
          </li>
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: "8px" }} />);
      continue;
    }

    elements.push(
      <p key={i} style={pStyle}>
        {parseInlineFormatting(line, sources, onSourceClick)}
      </p>
    );
  }

  return <div>{elements}</div>;
}

function parseInlineFormatting(
  text: string,
  sources?: any[],
  onSourceClick?: (idx: number) => void
): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.flatMap((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return [
        <strong key={`bold-${idx}`} style={{ color: "#fff" }}>
          {part.slice(2, -2)}
        </strong>,
      ];
    }
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.flatMap((subPart, sIdx) => {
      if (subPart.startsWith("`") && subPart.endsWith("`")) {
        return [
          <code key={`code-${idx}-${sIdx}`} style={inlineCodeStyle}>
            {subPart.slice(1, -1)}
          </code>,
        ];
      }

      const citationParts = subPart.split(/(\[Source \d+[^\]]*\])/g);
      return citationParts.map((citPart, cIdx) => {
        if (citPart.startsWith("[Source ") && citPart.endsWith("]")) {
          const m = citPart.match(/\[Source (\d+)/);
          if (m && onSourceClick) {
            const num = parseInt(m[1], 10);
            return (
              <button
                key={`citation-${idx}-${sIdx}-${cIdx}`}
                type="button"
                onClick={() => onSourceClick(num - 1)}
                style={citationBadgeStyle}
                title={citPart}
              >
                [{num}]
              </button>
            );
          }
        }
        return citPart;
      });
    });
  });
}

// ── Progress Overlay Component ───────────────────────────────────────────────
function UploadProgressOverlay({
  visible,
  stageIndex,
  progressPercent,
  filename,
  resultChunks,
}: {
  visible: boolean;
  stageIndex: number;
  progressPercent: number;
  filename: string;
  resultChunks: number | null;
}) {
  if (!visible) return null;
  const isDone = stageIndex >= UPLOAD_STAGES.length - 1;
  const stage = UPLOAD_STAGES[Math.min(stageIndex, UPLOAD_STAGES.length - 1)];

  return (
    <div style={overlayBackdropStyle}>
      <div style={overlayCardStyle} className="glass-panel animate-fade-in">
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "48px", marginBottom: "12px", lineHeight: 1 }}>
            {stage.icon}
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px", color: "#fff" }}>
            {isDone ? "Upload Complete!" : "Processing Document"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", maxWidth: "300px", margin: "0 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filename}
          </p>
        </div>

        {/* Macro progress bar */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Overall Progress</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div style={overlayBarTrackStyle}>
            <div
              style={{
                ...overlayBarFillStyle,
                width: `${progressPercent}%`,
                background: isDone
                  ? "linear-gradient(90deg, var(--success), #34D399)"
                  : "linear-gradient(90deg, var(--accent), #818CF8)",
                boxShadow: isDone
                  ? "0 0 12px var(--success-glow)"
                  : "0 0 12px rgba(99,102,241,0.5)",
              }}
            />
          </div>
        </div>

        {/* Stage steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
          {UPLOAD_STAGES.slice(0, -1).map((s, i) => {
            const state =
              i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
            return (
              <div key={s.id} style={stageRowStyle(state)}>
                <div style={stageIconStyle(state)}>
                  {state === "done" ? "✓" : state === "active" ? <span style={miniSpinnerStyle} /> : "○"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: state === "active" ? 600 : 400, color: state === "pending" ? "var(--text-muted)" : "var(--text-primary)", margin: 0 }}>
                    {s.label}
                  </p>
                  {state === "active" && (
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
                      {s.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Success result */}
        {isDone && resultChunks !== null && (
          <div style={successResultStyle}>
            <span style={{ fontSize: "20px" }}>🎉</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--success)", margin: 0 }}>
                {resultChunks} text segments indexed into ChromaDB
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", margin: 0 }}>
                Document is now available for quiz grounding!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Quiz Page Component ---
export default function QuizPage() {
  const [step, setStep] = useState<"config" | "running" | "result" | "theory">("config");
  const [mode, setMode] = useState<"mcq" | "theory" | "upload">("mcq");
  const [subject, setSubject] = useState("All Subjects");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [numQuestions, setNumQuestions] = useState(5);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [savingAttempt, setSavingAttempt] = useState(false);

  const [theoryResult, setTheoryResult] = useState<{
    answer: string;
    sources: any[];
    used_knowledge_base: boolean;
    model: string;
  } | null>(null);

  const [selectedSource, setSelectedSource] = useState<any | null>(null);

  // ── Upload-in-quiz state ──────────────────────────────────────────────────
  const [uploadSubject, setUploadSubject] = useState("Other");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [resultChunks, setResultChunks] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [postUploadMode, setPostUploadMode] = useState<"mcq" | "theory" | "explain" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateStages = (onComplete: () => void): (() => void) => {
    let cancelled = false;
    let currentStage = 0;
    const stages = UPLOAD_STAGES.slice(0, -1);
    const totalDuration = stages.reduce((s, st) => s + st.durationMs, 0);
    let elapsed = 0;
    const run = () => {
      if (cancelled || currentStage >= stages.length) return;
      setStageIndex(currentStage);
      const dur = stages[currentStage].durationMs;
      stageTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        elapsed += dur;
        setProgressPercent(Math.min(90, (elapsed / totalDuration) * 90));
        currentStage++;
        if (currentStage >= stages.length) onComplete();
        else run();
      }, dur);
    };
    run();
    return () => { cancelled = true; if (stageTimerRef.current) clearTimeout(stageTimerRef.current); };
  };

  const handleUpload = async () => {
    if (!selectedFile) { setUploadError("Please select a PDF file first."); return; }
    setUploadError(""); setUploadSuccess(""); setResultChunks(null);
    setUploadingFileName(selectedFile.name);
    setStageIndex(0); setProgressPercent(0); setShowProgress(true);

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("subject", uploadSubject);

    let apiResolved = false, animationDone = false;
    let apiResult: { ok: boolean; data: Record<string, unknown> } | null = null;

    const finalize = async () => {
      if (!apiResolved || !animationDone) return;
      if (apiResult?.ok) {
        setProgressPercent(100);
        setStageIndex(UPLOAD_STAGES.length - 1);
        const chunks = (apiResult.data as { num_chunks?: number }).num_chunks ?? 0;
        setResultChunks(chunks);
        setUploadSuccess(`✓ Indexed "${(apiResult.data as { filename?: string }).filename}" — ${chunks} segments stored.`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await fetchDocuments();
        setTimeout(() => setShowProgress(false), 2500);
      } else {
        setShowProgress(false);
        setUploadError((apiResult?.data as { detail?: string })?.detail || "Upload failed. Please try again.");
      }
    };

    const cancelAnim = animateStages(() => { animationDone = true; finalize(); });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const apiKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") : null;
      const headers: Record<string, string> = { Authorization: token ? `Bearer ${token}` : "" };
      if (apiKey) headers["X-Gemini-API-Key"] = apiKey;
      const res = await fetch("http://127.0.0.1:8000/api/documents/upload", { method: "POST", body: form, headers });
      const data = await res.json();
      apiResult = { ok: res.ok, data };
      apiResolved = true;
      finalize();
    } catch {
      cancelAnim(); setShowProgress(false);
      setUploadError("Network error. Make sure the backend is running.");
    }
  };

  const handleUploadDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setUploadDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") { setSelectedFile(file); setUploadError(""); }
    else setUploadError("Only PDF files are supported.");
  }, []);

  const fetchAttempts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/quiz/attempts");
      if (res.ok) setAttempts(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await apiFetch("/api/documents");
      if (res.ok) setDocuments(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchAttempts();
    fetchDocuments();
  }, [fetchAttempts, fetchDocuments]);

  const getDocCountForSubject = (subj: string) => {
    if (subj === "All Subjects") return documents.length;
    return documents.filter((d) => d.subject === subj).length;
  };

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      if (mode === "mcq") {
        const res = await apiFetch("/api/quiz/generate", {
          method: "POST",
          body: JSON.stringify({
            topic,
            difficulty,
            num_questions: numQuestions,
          }),
        });
        if (!res.ok) throw new Error("Quiz generation failed");
        const data = await res.json();
        setQuestions(data.questions);
        setAnswers({});
        setCurrentIdx(0);
        setStep("running");
      } else {
        // Theory Explainer Mode
        const res = await apiFetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            question: `Please explain the concept of "${topic}" in detail, highlighting key aspects and structures.`,
            subject: subject === "All Subjects" ? undefined : subject,
          }),
        });
        if (!res.ok) throw new Error("Theory explanation failed");
        const data = await res.json();
        setTheoryResult(data);
        setStep("theory");
      }
    } catch (err) {
      alert(`Failed to generate ${mode === "mcq" ? "quiz" : "theory explanation"}. Please ensure the backend is running.`);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (optionLetter: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentIdx]: optionLetter,
    }));
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      submitQuiz();
    }
  };

  const calculateScore = () => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) correctCount++;
    });
    return (correctCount / questions.length) * 100;
  };

  const submitQuiz = async () => {
    setStep("result");
    setSavingAttempt(true);

    const score = calculateScore();
    try {
      await apiFetch("/api/quiz/attempt", {
        method: "POST",
        body: JSON.stringify({
          score,
          total_questions: questions.length,
          difficulty,
          topic,
          subject: subject === "All Subjects" ? undefined : subject,
        }),
      });
      fetchAttempts();
    } catch { /* ignore */ } finally {
      setSavingAttempt(false);
    }
  };

  const handleReset = () => {
    setStep("config");
    setQuestions([]);
    setAnswers({});
    setCurrentIdx(0);
    setTheoryResult(null);
  };

  const getOptionLetter = (optStr: string) => {
    const match = optStr.match(/^([A-D])\)/i);
    return match ? match[1].toUpperCase() : optStr.charAt(0).toUpperCase();
  };

  return (
    <div style={containerStyle} className="animate-fade-in">
      {/* Header */}
      <div>
        <h1 style={titleStyle}>Adaptive Quizzes & Concepts</h1>
        <p style={subtitleStyle}>
          Test your retention, learn concept theory, and boost scores through custom RAG agents.
        </p>
      </div>

      <div style={gridStyle}>
        {/* Main Work Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {step === "config" && (
            <div className="glass-panel" style={panelStyle}>
              {/* Mode Tabs */}
              <div style={tabContainerStyle}>
                <button type="button" onClick={() => setMode("mcq")} style={tabStyle(mode === "mcq")}>
                  ⚡ Practice MCQ Quiz
                </button>
                <button type="button" onClick={() => setMode("theory")} style={tabStyle(mode === "theory")}>
                  📚 Learn Theory First
                </button>
                <button type="button" onClick={() => setMode("upload")} style={tabStyle(mode === "upload")}>
                  📎 Upload PDF Notes
                </button>
              </div>

              {/* ── Upload PDF Mode ─────────────────────────────────────────── */}
              {mode === "upload" && (
                <div style={formStyle}>
                  <h2 style={sectionTitleStyle}>📎 Upload PDF & Instantly Study It</h2>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "-10px" }}>
                    Upload your PDF notes. Then choose to generate a quiz, get a theory summary, or have the AI explain it.
                  </p>

                  {/* Subject selector */}
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Subject Category</label>
                    <select value={uploadSubject} onChange={(e) => setUploadSubject(e.target.value)} style={selectStyle}>
                      {["Computer Networks","Algorithms","Database Systems","System Design","Operating Systems","Machine Learning","Data Structures","Mathematics","Other"].map((s) => (
                        <option key={s} value={s} style={{ background: "#1f2937", color: "#f3f4f6" }}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDrop={handleUploadDrop}
                    onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
                    onDragLeave={() => setUploadDragOver(false)}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${uploadDragOver ? "var(--accent)" : selectedFile ? "var(--success)" : "var(--border-glass)"}`,
                      borderRadius: "12px",
                      padding: "36px 24px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: uploadDragOver ? "rgba(99,102,241,0.06)" : selectedFile ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.02)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ fontSize: "40px", marginBottom: "10px" }}>{selectedFile ? "📄" : "📁"}</div>
                    {selectedFile ? (
                      <div>
                        <p style={{ fontWeight: 600, color: "var(--success)", fontSize: "15px", margin: 0 }}>{selectedFile.name}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>
                          {(selectedFile.size / 1024).toFixed(1)} KB · Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)", margin: 0 }}>Drop PDF here or click to browse</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginTop: "4px" }}>PDF files only · Max 20 MB</p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFile(f); setUploadError(""); } }} />
                  </div>

                  {uploadError && <p style={{ color: "#EF4444", fontSize: "13px" }}>⚠ {uploadError}</p>}
                  {uploadSuccess && (
                    <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: "var(--success)" }}>
                      {uploadSuccess}
                    </div>
                  )}

                  {/* Upload button */}
                  <button
                    type="button"
                    disabled={!selectedFile || showProgress}
                    onClick={handleUpload}
                    style={{ ...btnPrimaryStyle, opacity: !selectedFile || showProgress ? 0.6 : 1, cursor: !selectedFile || showProgress ? "not-allowed" : "pointer" }}
                  >
                    {showProgress ? "Processing..." : "📤 Upload & Index PDF"}
                  </button>

                  {/* Post-upload actions — show after successful upload */}
                  {uploadSuccess && (
                    <div>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>What would you like to do with this document?</p>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button type="button" onClick={() => { setMode("mcq"); setSubject(uploadSubject); }}
                          style={{ ...btnPrimaryStyle, flex: 1, margin: 0, fontSize: "13px", padding: "12px 16px" }}>
                          ⚡ Generate MCQ Quiz (up to 50 Qs)
                        </button>
                        <button type="button" onClick={() => { setMode("theory"); setSubject(uploadSubject); }}
                          style={{ ...btnPrimaryStyle, flex: 1, margin: 0, fontSize: "13px", padding: "12px 16px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                          📚 Theory Summary & Explanation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── MCQ / Theory Form ─────────────────────────────────────── */}
              {(mode === "mcq" || mode === "theory") && (
                <>
                <h2 style={sectionTitleStyle}>
                  {mode === "mcq" ? "⚡ Setup Your Practice Quiz" : "📚 Generate Concept Explanation"}
                </h2>

                <form onSubmit={handleStartQuiz} style={formStyle}>
                  <div style={rowStyle}>
                    <div style={{ ...formGroupStyle, flex: 1 }}>
                      <label style={labelStyle}>Subject / Topic Domain</label>
                      <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}>
                        {SUBJECTS.map((s) => {
                          const count = getDocCountForSubject(s);
                          return (
                            <option key={s} value={s} style={{ background: "#1f2937", color: "#f3f4f6" }}>
                              {s} {count > 0 ? `(📚 ${count} notes)` : s === "All Subjects" ? "" : "(general knowledge)"}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Topic or Concept</label>
                    <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                      placeholder={subject === "Computer Networks" ? "e.g. TCP Handshake, BGP routing, DNS..." : subject === "Algorithms" ? "e.g. Merge Sort, Dijkstra, DP..." : "e.g. SQL Joins, OSI Model, Process vs Thread..."}
                      style={inputStyle} required />
                  </div>

                  {subject !== "All Subjects" && (
                    <div style={groundingBadgeStyle(getDocCountForSubject(subject) > 0)}>
                      {getDocCountForSubject(subject) > 0 ? (
                        <span>✓ Grounded: Using your <strong>{getDocCountForSubject(subject)}</strong> uploaded doc(s) in {subject}.</span>
                      ) : (
                        <span>⚠️ No notes for {subject} yet — using general world knowledge.</span>
                      )}
                    </div>
                  )}

                  {mode === "mcq" && (
                    <div style={rowStyle}>
                      <div style={{ ...formGroupStyle, flex: 1 }}>
                        <label style={labelStyle}>Difficulty Level</label>
                        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={selectStyle}>
                          <option value="Beginner" style={{ background: "#1f2937", color: "#f3f4f6" }}>Beginner</option>
                          <option value="Intermediate" style={{ background: "#1f2937", color: "#f3f4f6" }}>Intermediate</option>
                          <option value="Advanced" style={{ background: "#1f2937", color: "#f3f4f6" }}>Advanced</option>
                        </select>
                      </div>
                      <div style={{ ...formGroupStyle, flex: 1 }}>
                        <label style={labelStyle}>Number of Questions</label>
                        <select value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} style={selectStyle}>
                          <option value={5} style={{ background: "#1f2937", color: "#f3f4f6" }}>5 Questions</option>
                          <option value={10} style={{ background: "#1f2937", color: "#f3f4f6" }}>10 Questions</option>
                          <option value={20} style={{ background: "#1f2937", color: "#f3f4f6" }}>20 Questions</option>
                          <option value={50} style={{ background: "#1f2937", color: "#f3f4f6" }}>50 Questions (Deep Dive)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    style={{ ...btnPrimaryStyle, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}>
                    {loading
                      ? (mode === "mcq" ? "Generating Quiz..." : "Generating Explanation...")
                      : (mode === "mcq" ? "Generate Custom Quiz 🚀" : "Generate Concept Explanation 📚")}
                  </button>
                </form>
                </>
              )}
            </div>
          )}

          {step === "running" && questions.length > 0 && (
            <div className="glass-panel" style={panelStyle}>
              {/* Progress */}
              <div style={progressHeaderStyle}>
                <span style={progressTextStyle}>
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span style={difficultyBadgeStyle(questions[currentIdx].difficulty)}>
                  {questions[currentIdx].difficulty}
                </span>
              </div>
              <div style={progressBarBgStyle}>
                <div style={progressBarFillStyle(((currentIdx + 1) / questions.length) * 100)} />
              </div>

              {/* Question Text */}
              <h3 style={questionStyle}>{questions[currentIdx].question}</h3>

              {/* Option Cards */}
              <div style={optionsGridStyle}>
                {questions[currentIdx].options.map((opt, idx) => {
                  const letter = getOptionLetter(opt);
                  const isSelected = answers[currentIdx] === letter;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(letter)}
                      style={{
                        ...optionCardStyle,
                        background: isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.02)",
                        borderColor: isSelected ? "var(--accent)" : "var(--border-glass)",
                        boxShadow: isSelected ? "0 0 16px var(--accent-glow)" : "none",
                      }}
                    >
                      <span
                        style={{
                          ...optionBadgeStyle,
                          background: isSelected ? "var(--accent)" : "rgba(255,255,255,0.06)",
                          color: isSelected ? "#fff" : "var(--text-secondary)",
                        }}
                      >
                        {letter}
                      </span>
                      <span style={optionTextStyle}>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Actions */}
              <div style={actionRowStyle}>
                <button
                  onClick={handleNext}
                  disabled={!answers[currentIdx]}
                  style={{
                    ...btnPrimaryStyle,
                    marginTop: 0,
                    width: "auto",
                    padding: "12px 30px",
                    opacity: !answers[currentIdx] ? 0.6 : 1,
                    cursor: !answers[currentIdx] ? "not-allowed" : "pointer",
                  }}
                >
                  {currentIdx === questions.length - 1 ? "Finish Quiz 🏁" : "Next Question ➔"}
                </button>
              </div>
            </div>
          )}

          {step === "result" && (
            <div className="glass-panel" style={panelStyle}>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <span style={{ fontSize: "52px" }}>🏆</span>
                <h2 style={{ fontSize: "24px", fontWeight: 700, marginTop: "12px" }}>Quiz Results</h2>
                <div style={{ fontSize: "40px", fontWeight: 800, color: calculateScore() >= 70 ? "var(--success)" : "#F59E0B", margin: "16px 0" }}>
                  {calculateScore().toFixed(0)}%
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                  You answered {questions.filter((q, idx) => answers[idx] === q.correct_answer).length} out of {questions.length} questions correctly.
                </p>
              </div>

              <h3 style={{ ...sectionTitleStyle, borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px", marginBottom: "16px" }}>
                Detailed Explanation & Review
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {questions.map((q, idx) => {
                  const userAns = answers[idx];
                  const correctAns = q.correct_answer;
                  const isCorrect = userAns === correctAns;

                  return (
                    <div key={idx} style={reviewCardStyle(isCorrect)}>
                      <p style={{ fontWeight: 600, fontSize: "14.5px" }}>
                        {idx + 1}. {q.question}
                      </p>
                      <div style={{ display: "flex", gap: "20px", marginTop: "10px", fontSize: "13px" }}>
                        <span style={{ color: isCorrect ? "var(--success)" : "#EF4444" }}>
                          Your Answer: {userAns} {isCorrect ? "✓" : "✗"}
                        </span>
                        {!isCorrect && (
                          <span style={{ color: "var(--success)" }}>
                            Correct Answer: {correctAns}
                          </span>
                        )}
                      </div>
                      <p style={{ marginTop: "10px", color: "var(--text-secondary)", fontSize: "13px", background: "rgba(0,0,0,0.15)", padding: "10px 14px", borderRadius: "6px" }}>
                        💡 <strong>Explanation:</strong> {q.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>

              <button onClick={handleReset} style={{ ...btnPrimaryStyle, marginTop: "28px" }}>
                Practice Another Topic ⚡
              </button>
            </div>
          )}

          {step === "theory" && theoryResult && (
            <div className="glass-panel animate-fade-in" style={panelStyle}>
              {/* Theory Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-glass)", paddingBottom: "14px", marginBottom: "20px" }}>
                <div>
                  <span style={theoryBadgeStyle}>📚 THEORY Swarm ACTIVE</span>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, marginTop: "6px" }}>{topic}</h2>
                  <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                    Subject: <strong style={{ color: "#fff" }}>{subject}</strong>
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "block" }}>Swarm model:</span>
                  <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600 }}>{theoryResult.model || "gemini-1.5-flash"}</span>
                </div>
              </div>

              {/* RAG Status */}
              <div style={{
                background: theoryResult.used_knowledge_base ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${theoryResult.used_knowledge_base ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px"
              }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: theoryResult.used_knowledge_base ? "var(--success)" : "var(--text-secondary)"
                }} />
                <span>
                  {theoryResult.used_knowledge_base
                    ? "Grounded: Retrieved relevant passages from your uploaded document files."
                    : "General Explanation: No notes available. Generated using standard pre-trained academic frameworks."}
                </span>
              </div>

              {/* Markdown Content */}
              <div style={{ minHeight: "200px" }}>
                <MarkdownRenderer
                  text={theoryResult.answer}
                  sources={theoryResult.sources}
                  onSourceClick={(idx) => setSelectedSource(theoryResult.sources[idx])}
                />
              </div>

              {/* Bottom Actions */}
              <div style={{ display: "flex", gap: "16px", marginTop: "32px", borderTop: "1px solid var(--border-glass)", paddingTop: "20px" }}>
                <button
                  onClick={() => {
                    setMode("mcq");
                    setStep("config");
                  }}
                  style={{
                    ...btnPrimaryStyle,
                    margin: 0,
                    flex: 1
                  }}
                >
                  ⚡ Take a Practice Quiz
                </button>
                <button
                  onClick={() => setStep("config")}
                  style={{
                    ...btnPrimaryStyle,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-glass)",
                    color: "var(--text-primary)",
                    boxShadow: "none",
                    margin: 0,
                    flex: 1
                  }}
                >
                  ⬅ Back to Setup
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={sidebarStyle}>
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={sidebarTitleStyle}>📊 Attempt History</h3>
            {attempts.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "10px" }}>
                No attempts recorded yet. Take your first quiz!
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
                {attempts.slice(0, 6).map((att) => (
                  <div key={att.id} style={attemptRowStyle}>
                    <div>
                      <span style={difficultyLabelStyle(att.difficulty)}>{att.difficulty}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "8px" }}>
                        {new Date(att.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: att.score >= 70 ? "var(--success)" : "#F59E0B" }}>
                      {att.score.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Source Drawer */}
      {selectedSource && (
        <div style={drawerOverlayStyle} onClick={() => setSelectedSource(null)}>
          <div style={drawerContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={drawerHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={sourceBadgeStyle}>{selectedSource.subject || "Reference"}</span>
                <span style={drawerTitleStyle}>Source details</span>
              </div>
              <button onClick={() => setSelectedSource(null)} style={drawerCloseBtnStyle}>✕</button>
            </div>
            <div style={drawerBodyStyle}>
              <div style={drawerMetaRowStyle}>
                <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                  File: <strong style={{ color: "#fff" }}>{selectedSource.filename}</strong>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                  Location: <strong style={{ color: "#fff" }}>Page {selectedSource.page}</strong>
                </div>
              </div>
              <h4 style={{ fontSize: "12.5px", fontWeight: 600, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: "20px", marginBottom: "8px" }}>
                📚 Full Text Segment
              </h4>
              <div style={drawerChunkTextStyle}>
                {selectedSource.text || selectedSource.preview}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Overlay */}
      <UploadProgressOverlay
        visible={showProgress}
        stageIndex={stageIndex}
        progressPercent={progressPercent}
        filename={uploadingFileName}
        resultChunks={resultChunks}
      />
    </div>
  );
}

// --- Styles ---
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  maxWidth: "1100px",
  margin: "0 auto",
};

const titleStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text-secondary)",
  marginTop: "4px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 300px",
  gap: "24px",
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  padding: "28px 32px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  marginBottom: "20px",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const formGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  padding: "12px 16px",
  fontSize: "14.5px",
  outline: "none",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
};

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  padding: "12px 16px",
  fontSize: "14px",
  outline: "none",
  cursor: "pointer",
};

const btnPrimaryStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "14px",
  fontSize: "14.5px",
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "10px",
  boxShadow: "0 0 20px rgba(99,102,241,0.3)",
};

const progressHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
};

const progressTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
};

const difficultyBadgeStyle = (diff: string): React.CSSProperties => {
  const isHard = diff === "Advanced";
  const isMed = diff === "Intermediate";
  return {
    fontSize: "11px",
    background: isHard ? "rgba(239,68,68,0.15)" : isMed ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
    color: isHard ? "#EF4444" : isMed ? "#F59E0B" : "var(--success)",
    border: `1px solid ${isHard ? "rgba(239,68,68,0.3)" : isMed ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
    borderRadius: "12px",
    padding: "2px 8px",
  };
};

const progressBarBgStyle: React.CSSProperties = {
  height: "6px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: "3px",
  overflow: "hidden",
  marginBottom: "28px",
};

const progressBarFillStyle = (pct: number): React.CSSProperties => ({
  height: "100%",
  width: `${pct}%`,
  background: "linear-gradient(90deg, var(--accent), #818CF8)",
  transition: "width 0.3s ease",
});

const questionStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  lineHeight: 1.5,
  marginBottom: "24px",
  color: "#fff",
};

const optionsGridStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const optionCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "16px 20px",
  borderRadius: "8px",
  border: "1px solid",
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.2s ease",
};

const optionBadgeStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: "13px",
  flexShrink: 0,
};

const optionTextStyle: React.CSSProperties = {
  fontSize: "14.5px",
  color: "var(--text-primary)",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: "32px",
};

const reviewCardStyle = (isCorrect: boolean): React.CSSProperties => ({
  background: isCorrect ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
  border: `1px solid ${isCorrect ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
  borderRadius: "8px",
  padding: "16px 20px",
});

const sidebarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const sidebarTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
};

const attemptRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "6px",
};

const difficultyLabelStyle = (diff: string): React.CSSProperties => {
  const isHard = diff === "Advanced";
  const isMed = diff === "Intermediate";
  return {
    fontSize: "10px",
    fontWeight: 600,
    color: isHard ? "#EF4444" : isMed ? "#F59E0B" : "var(--success)",
    textTransform: "uppercase",
  };
};

// --- Tab styles ---
const tabContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginBottom: "24px",
  borderBottom: "1px solid var(--border-glass)",
  paddingBottom: "12px",
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "rgba(99, 102, 241, 0.15)" : "transparent",
  color: active ? "var(--accent)" : "var(--text-secondary)",
  border: `1px solid ${active ? "rgba(99, 102, 241, 0.35)" : "transparent"}`,
  borderRadius: "20px",
  padding: "8px 18px",
  fontSize: "13.5px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
  outline: "none",
});

const groundingBadgeStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
  color: active ? "var(--success)" : "#F59E0B",
  border: `1px solid ${active ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.25)"}`,
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "12.5px",
  marginTop: "4px",
  lineHeight: "1.4",
});

const theoryBadgeStyle: React.CSSProperties = {
  background: "rgba(99, 102, 241, 0.15)",
  color: "var(--accent)",
  border: "1px solid rgba(99, 102, 241, 0.35)",
  borderRadius: "12px",
  padding: "2px 8px",
  fontSize: "10px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  display: "inline-block",
};

// --- Markdown Styles ---
const h2Style: React.CSSProperties = { fontSize: "18px", fontWeight: 700, margin: "14px 0 8px 0", color: "#fff" };
const h3Style: React.CSSProperties = { fontSize: "16px", fontWeight: 600, margin: "12px 0 6px 0", color: "#f8fafc" };
const h4Style: React.CSSProperties = { fontSize: "14px", fontWeight: 600, margin: "8px 0 4px 0", color: "#f1f5f9" };
const pStyle: React.CSSProperties = { fontSize: "14.5px", lineHeight: 1.6, margin: "4px 0 6px 0", color: "rgba(255,255,255,0.85)" };
const ulStyle: React.CSSProperties = { paddingLeft: "18px", margin: "4px 0 8px 0" };
const liStyle: React.CSSProperties = { listStyleType: "disc", fontSize: "14px", lineHeight: 1.5, color: "rgba(255,255,255,0.8)" };
const codeBlockStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.25)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "6px",
  padding: "12px 14px",
  margin: "10px 0",
  overflowX: "auto",
  fontSize: "13px",
  fontFamily: "monospace",
  color: "#818CF8",
};
const inlineCodeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "4px",
  padding: "2px 5px",
  fontSize: "13px",
  fontFamily: "monospace",
  color: "#A7F3D0",
};
const citationBadgeStyle: React.CSSProperties = {
  background: "rgba(52, 211, 153, 0.15)",
  color: "#34D399",
  border: "1px solid rgba(52, 211, 153, 0.35)",
  borderRadius: "4px",
  padding: "1px 5px",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  margin: "0 2px",
  display: "inline-block",
  lineHeight: "1.2",
  transition: "all 0.15s ease",
};

// --- Drawer Styles ---
const drawerOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(4px)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "flex-end",
};

const drawerContentStyle: React.CSSProperties = {
  width: "420px",
  height: "100%",
  background: "rgba(17, 24, 39, 0.95)",
  backdropFilter: "blur(16px)",
  borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.5)",
  padding: "32px",
  display: "flex",
  flexDirection: "column",
};

const drawerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  paddingBottom: "16px",
  marginBottom: "20px",
};

const drawerTitleStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#fff",
};

const drawerCloseBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-secondary)",
  fontSize: "18px",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: "4px",
  transition: "background 0.2s",
};

const drawerBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};

const drawerMetaRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  background: "rgba(255, 255, 255, 0.02)",
  padding: "16px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.04)",
};

const drawerChunkTextStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: "8px",
  padding: "16px",
  fontSize: "14px",
  lineHeight: "1.6",
  color: "rgba(255, 255, 255, 0.85)",
  whiteSpace: "pre-wrap",
  fontFamily: "monospace",
  overflowY: "auto",
  flex: 1,
};

const sourceBadgeStyle: React.CSSProperties = {
  background: "rgba(99, 102, 241, 0.15)",
  color: "var(--accent)",
  border: "1px solid rgba(99, 102, 241, 0.35)",
  borderRadius: "12px",
  padding: "2px 8px",
  fontSize: "11px",
  fontWeight: 600,
};

// ── Upload Overlay Styles ──────────────────────────────────────────────────────
const overlayBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  backdropFilter: "blur(6px)",
  zIndex: 2000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const overlayCardStyle: React.CSSProperties = {
  width: "420px",
  maxWidth: "calc(100vw - 48px)",
  background: "rgba(15,23,42,0.95)",
  backdropFilter: "blur(20px)",
  borderRadius: "20px",
  border: "1px solid rgba(99,102,241,0.25)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  padding: "36px 32px",
};

const overlayBarTrackStyle: React.CSSProperties = {
  height: "8px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: "4px",
  overflow: "hidden",
};

const overlayBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "4px",
  transition: "width 0.4s ease, background 0.4s ease",
};

const stageRowStyle = (state: "done" | "active" | "pending"): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 14px",
  borderRadius: "10px",
  background:
    state === "active"
      ? "rgba(99,102,241,0.08)"
      : state === "done"
      ? "rgba(16,185,129,0.05)"
      : "transparent",
  border: `1px solid ${
    state === "active"
      ? "rgba(99,102,241,0.2)"
      : state === "done"
      ? "rgba(16,185,129,0.15)"
      : "transparent"
  }`,
  transition: "all 0.3s ease",
});

const stageIconStyle = (state: "done" | "active" | "pending"): React.CSSProperties => ({
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  fontWeight: 700,
  flexShrink: 0,
  background:
    state === "done"
      ? "rgba(16,185,129,0.2)"
      : state === "active"
      ? "rgba(99,102,241,0.2)"
      : "rgba(255,255,255,0.05)",
  color:
    state === "done"
      ? "var(--success)"
      : state === "active"
      ? "var(--accent)"
      : "var(--text-muted)",
  border: `1px solid ${
    state === "done"
      ? "rgba(16,185,129,0.3)"
      : state === "active"
      ? "rgba(99,102,241,0.3)"
      : "rgba(255,255,255,0.06)"
  }`,
});

const miniSpinnerStyle: React.CSSProperties = {
  width: "10px",
  height: "10px",
  border: "2px solid rgba(99,102,241,0.3)",
  borderTop: "2px solid var(--accent)",
  borderRadius: "50%",
  display: "inline-block",
  animation: "spin 0.8s linear infinite",
};

const successResultStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "rgba(16,185,129,0.08)",
  border: "1px solid rgba(16,185,129,0.25)",
  borderRadius: "12px",
  padding: "14px 18px",
};
