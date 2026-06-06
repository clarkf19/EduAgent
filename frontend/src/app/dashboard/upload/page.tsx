"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";

const SUBJECTS = [
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

// ── Upload stages definition ─────────────────────────────────────────────────
interface UploadStage {
  id: string;
  label: string;
  detail: string;
  icon: string;
  durationMs: number; // simulated stage duration
}

const UPLOAD_STAGES: UploadStage[] = [
  { id: "upload",   label: "Uploading File",          detail: "Sending PDF to server…",                 icon: "📤", durationMs: 600  },
  { id: "parse",    label: "Parsing PDF",              detail: "Extracting text from pages…",            icon: "📖", durationMs: 900  },
  { id: "chunk",    label: "Chunking Content",         detail: "Splitting into semantic segments…",      icon: "✂️", durationMs: 700  },
  { id: "embed",    label: "Generating Embeddings",    detail: "Running all-MiniLM-L6-v2 model…",        icon: "🧠", durationMs: 1200 },
  { id: "index",    label: "Indexing into ChromaDB",   detail: "Storing vectors in knowledge base…",     icon: "⚡", durationMs: 500  },
  { id: "done",     label: "Complete",                 detail: "Document is ready for AI Tutor!",        icon: "✅", durationMs: 0    },
];

interface DocumentRecord {
  id: number;
  filename: string;
  subject: string;
  file_size: number;
  num_chunks: number;
  uploaded_at: string;
  user_id: number;
}

interface VectorStats {
  total_documents: number;
  total_chunks: number;
  subjects: string[];
  chroma_collection_size: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getCookie("access_token") || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const apiKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") : null;
  return fetch(`http://127.0.0.1:8000${path}`, {
    ...opts,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      ...(apiKey ? { "X-Gemini-API-Key": apiKey } : {}),
      ...(opts.headers || {}),
    },
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
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "6px" }}>
            {isDone ? "Upload Complete!" : "Processing Document"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "13px", maxWidth: "300px", margin: "0 auto" }}>
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
          <div style={progressBarTrackStyle}>
            <div
              style={{
                ...progressBarFillStyle,
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
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Document is now available in AI Tutor Chat
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [subject, setSubject] = useState(SUBJECTS[0]);

  // Upload progress state
  const [showProgress, setShowProgress] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [resultChunks, setResultChunks] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState("");

  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [stats, setStats] = useState<VectorStats | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await apiFetch("/api/documents");
      if (res.ok) setDocuments(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch("/api/documents/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchDocuments(), fetchStats()]).finally(() =>
      setLoadingDocs(false)
    );
  }, [fetchDocuments, fetchStats]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      setUploadError("");
    } else {
      setUploadError("Only PDF files are supported.");
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError("");
    }
  };

  // Animate through stages up to (but not including) the final "done" stage,
  // then resolve. Returns a cleanup function.
  const animateStages = (
    onComplete: () => void
  ): (() => void) => {
    let cancelled = false;
    let currentStage = 0;
    // Stages to animate: all except last "done" stage
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
        if (currentStage >= stages.length) {
          onComplete();
        } else {
          run();
        }
      }, dur);
    };
    run();
    return () => { cancelled = true; if (stageTimerRef.current) clearTimeout(stageTimerRef.current); };
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError("Please select a PDF file first.");
      return;
    }
    setUploadError("");
    setUploadSuccess("");
    setResultChunks(null);
    setUploadingFileName(selectedFile.name);
    setStageIndex(0);
    setProgressPercent(0);
    setShowProgress(true);

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("subject", subject);

    // Start animation concurrently with the actual API call
    let apiResolved = false;
    let animationDone = false;
    let apiResult: { ok: boolean; data: Record<string, unknown> } | null = null;

    const finalize = async () => {
      if (!apiResolved || !animationDone) return;
      // Both animation and API done — show result
      if (apiResult?.ok) {
        setProgressPercent(100);
        setStageIndex(UPLOAD_STAGES.length - 1);
        setResultChunks((apiResult.data as { num_chunks?: number }).num_chunks ?? 0);
        setUploadSuccess(
          `✓ Indexed "${(apiResult.data as { filename?: string }).filename}" — ${(apiResult.data as { num_chunks?: number }).num_chunks} text segments stored.`
        );
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await Promise.all([fetchDocuments(), fetchStats()]);
        // Auto-close overlay after 2.5s
        setTimeout(() => setShowProgress(false), 2500);
      } else {
        setShowProgress(false);
        setUploadError((apiResult?.data as { detail?: string })?.detail || "Upload failed. Please try again.");
      }
    };

    // Animation
    const cancelAnim = animateStages(() => {
      animationDone = true;
      finalize();
    });

    // API call
    try {
      const res = await apiFetch("/api/documents/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      apiResult = { ok: res.ok, data };
      apiResolved = true;
      finalize();
    } catch {
      cancelAnim();
      setShowProgress(false);
      setUploadError("Network error. Make sure the backend is running.");
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      await Promise.all([fetchDocuments(), fetchStats()]);
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  };

  const isUploading = showProgress && stageIndex < UPLOAD_STAGES.length - 1;

  return (
    <div style={containerStyle} className="animate-fade-in">
      {/* Animated upload overlay */}
      <UploadProgressOverlay
        visible={showProgress}
        stageIndex={stageIndex}
        progressPercent={progressPercent}
        filename={uploadingFileName}
        resultChunks={resultChunks}
      />

      {/* Header */}
      <div>
        <h1 style={titleStyle}>Upload Materials</h1>
        <p style={subtitleStyle}>
          Ingest notes, PDFs, and lecture slides to build your personal AI knowledge base.
        </p>
      </div>

      <div style={gridStyle}>
        {/* ── Left Column: Upload Form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Dropzone */}
          <div
            className="glass-panel"
            style={{
              ...dropzoneStyle,
              borderColor: dragOver
                ? "var(--accent)"
                : selectedFile
                ? "var(--success)"
                : "rgba(255,255,255,0.12)",
              boxShadow: dragOver
                ? "0 0 24px var(--accent-glow)"
                : selectedFile
                ? "0 0 18px var(--success-glow)"
                : "none",
              transform: dragOver ? "scale(1.01)" : "scale(1)",
              pointerEvents: isUploading ? "none" : "auto",
              opacity: isUploading ? 0.5 : 1,
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
            {selectedFile ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "40px", marginBottom: "12px" }}>📄</div>
                <p style={{ fontWeight: 600, color: "var(--success)", fontSize: "15px" }}>
                  {selectedFile.name}
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                  {formatBytes(selectedFile.size)}
                </p>
                <button
                  style={clearBtnStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  ✕ Remove
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: "40px", marginBottom: "14px", opacity: 0.7 }}>📂</div>
                <p style={{ fontWeight: 600, fontSize: "15px" }}>
                  Drag & drop a PDF here
                </p>
                <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px" }}>
                  or click to browse — PDF files only
                </p>
              </div>
            )}
          </div>

          {/* Subject selector */}
          <div className="glass-panel" style={formCardStyle}>
            <label style={labelStyle}>Subject Category</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={selectStyle}
              disabled={isUploading}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Error / Success Alerts */}
          {uploadError && (
            <div style={alertStyle("rgba(239,68,68,0.15)", "rgba(239,68,68,0.5)")}>
              ⚠ {uploadError}
            </div>
          )}
          {uploadSuccess && !showProgress && (
            <div style={alertStyle("rgba(16,185,129,0.12)", "rgba(16,185,129,0.4)")}>
              {uploadSuccess}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={isUploading || !selectedFile}
            style={{
              ...uploadBtnStyle,
              opacity: isUploading || !selectedFile ? 0.5 : 1,
              cursor: isUploading || !selectedFile ? "not-allowed" : "pointer",
            }}
          >
            {isUploading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
                <span style={spinnerStyle} /> Processing & Indexing…
              </span>
            ) : (
              "⚡ Upload & Index to Knowledge Base"
            )}
          </button>
        </div>

        {/* ── Right Column: Stats ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Vector Stats Widget */}
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h3 style={sectionTitleStyle}>🧠 Knowledge Base Stats</h3>
            {stats ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
                <StatRow label="Documents Uploaded" value={String(stats.total_documents)} color="var(--accent)" />
                <StatRow label="Text Segments (Chunks)" value={String(stats.total_chunks)} color="var(--success)" />
                <StatRow label="ChromaDB Vector Index" value={String(stats.chroma_collection_size)} color="#EC4899" />
                <StatRow label="Subjects Covered" value={String(stats.subjects.length)} color="#F59E0B" />
                {stats.subjects.length > 0 && (
                  <div style={{ marginTop: "4px" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "12px", marginBottom: "8px" }}>Active Subjects</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {stats.subjects.map((s) => (
                        <span key={s} style={tagStyle}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "16px" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: "32px", borderRadius: "8px", marginBottom: "10px" }} />
                ))}
              </div>
            )}
          </div>

          {/* Embedding model info */}
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={sectionTitleStyle}>🔬 Embedding Model</h3>
            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <InfoRow label="Model" value="all-MiniLM-L6-v2" />
              <InfoRow label="Vector Size" value="384 dimensions" />
              <InfoRow label="Distance Metric" value="Cosine Similarity" />
              <InfoRow label="Chunking Strategy" value="800-char sliding window" />
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px var(--success-glow)" }} />
                <span style={{ fontSize: "13px", color: "var(--success)" }}>Model Active</span>
              </div>
            </div>
          </div>

          {/* Processing Pipeline visual */}
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={sectionTitleStyle}>🔄 Processing Pipeline</h3>
            <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {UPLOAD_STAGES.slice(0, -1).map((s, i) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{s.icon}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{s.label}</span>
                  {i < UPLOAD_STAGES.length - 2 && (
                    <span style={{ marginLeft: "auto", opacity: 0.3, fontSize: "10px" }}>↓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Document List ── */}
      <div className="glass-panel" style={{ padding: "24px 28px" }}>
        <h3 style={{ ...sectionTitleStyle, marginBottom: "18px" }}>📚 Uploaded Documents</h3>
        {loadingDocs ? (
          <div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: "52px", borderRadius: "8px", marginBottom: "8px" }} />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>📭</div>
            <p>No documents yet. Upload your first PDF to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {["Filename", "Subject", "Chunks", "Size", "Uploaded", "Action"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={trStyle}>
                    <td style={tdStyle}>
                      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ opacity: 0.7 }}>📄</span>
                        <span style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.filename}
                        </span>
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={tagStyle}>{doc.subject}</span>
                    </td>
                    <td style={{ ...tdStyle, color: "var(--success)", fontWeight: 600 }}>
                      {doc.num_chunks}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--text-secondary)" }}>
                      {formatBytes(doc.file_size)}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: "13px" }}>
                      {formatDate(doc.uploaded_at)}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        style={deleteBtnStyle}
                      >
                        {deletingId === doc.id ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: "20px", fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "28px",
  maxWidth: "1100px",
  margin: "0 auto",
};

const titleStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text-secondary)",
  marginTop: "4px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: "24px",
  alignItems: "start",
};

const dropzoneStyle: React.CSSProperties = {
  border: "2px dashed rgba(255,255,255,0.12)",
  borderRadius: "var(--border-radius-lg)",
  padding: "52px 32px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.25s ease",
  minHeight: "200px",
};

const formCardStyle: React.CSSProperties = {
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
  fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  padding: "10px 14px",
  fontSize: "14px",
  width: "100%",
  cursor: "pointer",
  outline: "none",
};

const uploadBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--border-radius)",
  padding: "14px 24px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 0 20px rgba(99,102,241,0.35)",
};

const clearBtnStyle: React.CSSProperties = {
  marginTop: "12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border-glass)",
  color: "var(--text-secondary)",
  borderRadius: "6px",
  padding: "6px 14px",
  fontSize: "12px",
  cursor: "pointer",
};

const spinnerStyle: React.CSSProperties = {
  display: "inline-block",
  width: "14px",
  height: "14px",
  border: "2px solid rgba(255,255,255,0.3)",
  borderTop: "2px solid #fff",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const alertStyle = (bg: string, border: string): React.CSSProperties => ({
  background: bg,
  border: `1px solid ${border}`,
  borderRadius: "8px",
  padding: "12px 16px",
  fontSize: "13.5px",
  lineHeight: 1.5,
});

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
};

const tagStyle: React.CSSProperties = {
  background: "rgba(99,102,241,0.15)",
  border: "1px solid rgba(99,102,241,0.3)",
  borderRadius: "20px",
  padding: "3px 10px",
  fontSize: "12px",
  color: "var(--accent)",
  whiteSpace: "nowrap",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "12px",
  color: "var(--text-secondary)",
  fontWeight: 500,
  borderBottom: "1px solid var(--border-glass)",
  whiteSpace: "nowrap",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: "14px",
  color: "var(--text-primary)",
};

const deleteBtnStyle: React.CSSProperties = {
  background: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(239,68,68,0.3)",
  color: "#EF4444",
  borderRadius: "6px",
  padding: "5px 12px",
  fontSize: "12px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

// ── Overlay styles ──────────────────────────────────────────────────────────

const overlayBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.65)",
  backdropFilter: "blur(8px)",
};

const overlayCardStyle: React.CSSProperties = {
  width: "420px",
  maxWidth: "90vw",
  padding: "36px 32px",
  borderRadius: "20px",
};

const progressBarTrackStyle: React.CSSProperties = {
  height: "8px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: "100px",
  overflow: "hidden",
};

const progressBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: "100px",
  transition: "width 0.4s cubic-bezier(0.4,0,0.2,1), background 0.4s ease",
};

const stageRowStyle = (state: "done" | "active" | "pending"): React.CSSProperties => ({
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  padding: "8px 12px",
  borderRadius: "10px",
  background: state === "active"
    ? "rgba(99,102,241,0.1)"
    : state === "done"
    ? "rgba(16,185,129,0.06)"
    : "transparent",
  border: state === "active"
    ? "1px solid rgba(99,102,241,0.25)"
    : "1px solid transparent",
  transition: "all 0.3s ease",
});

const stageIconStyle = (state: "done" | "active" | "pending"): React.CSSProperties => ({
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: state === "done"
    ? "var(--success)"
    : state === "active"
    ? "var(--accent)"
    : "rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "10px",
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0,
  marginTop: "1px",
  boxShadow: state === "active" ? "0 0 8px rgba(99,102,241,0.5)" : "none",
  transition: "all 0.3s ease",
});

const miniSpinnerStyle: React.CSSProperties = {
  display: "inline-block",
  width: "8px",
  height: "8px",
  border: "1.5px solid rgba(255,255,255,0.3)",
  borderTop: "1.5px solid #fff",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const successResultStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "14px 16px",
  background: "rgba(16,185,129,0.1)",
  border: "1px solid rgba(16,185,129,0.3)",
  borderRadius: "12px",
};
