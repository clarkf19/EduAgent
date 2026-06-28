"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

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

interface Message {
  sender: "user" | "ai";
  text: string;
  sources?: Array<{
    filename: string;
    page: string;
    subject: string;
    preview: string;
    text?: string;
  }>;
  model?: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  subject: string;
}

const STORAGE_KEY = "eduagent_chat_history";

function loadHistory(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  // Keep max 30 sessions
  const trimmed = sessions.slice(0, 30);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getCookie("access_token") || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
  const apiKey = typeof window !== "undefined" ? localStorage.getItem("groq_api_key") : null;
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Groq-Api-Key": apiKey } : {}),
      ...(opts.headers || {}),
    },
  });
}

// Derive a short title from the first user message
function deriveTitle(messages: Message[]): string {
  const first = messages.find((m) => m.sender === "user");
  if (!first) return "New Chat";
  const words = first.text.trim().split(/\s+/).slice(0, 7).join(" ");
  return words.length < first.text.trim().length ? words + "…" : words;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Markdown Renderer ────────────────────────────────────────────────────────
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

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} style={h3Style}>{parseInline(line.slice(4), sources, onSourceClick)}</h3>);
      continue;
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} style={h4Style}>{parseInline(line.slice(5), sources, onSourceClick)}</h4>);
      continue;
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} style={h2Style}>{parseInline(line.slice(3), sources, onSourceClick)}</h2>);
      continue;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <ul key={i} style={ulStyle}>
          <li style={liStyle}>{parseInline(line.slice(2), sources, onSourceClick)}</li>
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
        {parseInline(line, sources, onSourceClick)}
      </p>
    );
  }

  return <div>{elements}</div>;
}

function parseInline(
  text: string,
  sources?: any[],
  onSourceClick?: (idx: number) => void
): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.flatMap((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return [<strong key={`bold-${idx}`} style={{ color: "#fff" }}>{part.slice(2, -2)}</strong>];
    }
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.flatMap((subPart, sIdx) => {
      if (subPart.startsWith("`") && subPart.endsWith("`")) {
        return [<code key={`code-${idx}-${sIdx}`} style={inlineCodeStyle}>{subPart.slice(1, -1)}</code>];
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

// ── Main Component ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: "Hello! I am EduAgent's Expert Tutor. Ask me any question, or upload custom study notes in the **Upload** page, and I will base my explanations directly on your uploaded materials.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSubject, setActiveSubject] = useState("All Subjects");
  const [selectedSource, setSelectedSource] = useState<any | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Persist current session whenever messages change (if we have more than the greeting)
  useEffect(() => {
    const userMessages = messages.filter((m) => m.sender === "user");
    if (userMessages.length === 0) return; // nothing to save yet

    setHistory((prev) => {
      const title = deriveTitle(messages);
      if (activeSessionId) {
        // update existing
        const updated = prev.map((s) =>
          s.id === activeSessionId ? { ...s, title, messages, subject: activeSubject } : s
        );
        saveHistory(updated);
        return updated;
      } else {
        // create new session
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title,
          messages,
          createdAt: Date.now(),
          subject: activeSubject,
        };
        setActiveSessionId(newSession.id);
        const updated = [newSession, ...prev];
        saveHistory(updated);
        return updated;
      }
    });
  }, [messages]);

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([
      {
        sender: "ai",
        text: "Hello! I am EduAgent's Expert Tutor. Ask me any question, or upload custom study notes in the **Upload** page, and I will base my explanations directly on your uploaded materials.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");
    setActiveSubject("All Subjects");
    setHistoryOpen(false);
  };

  const loadSession = (session: ChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setActiveSubject(session.subject || "All Subjects");
    setHistoryOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveHistory(updated);
      return updated;
    });
    if (activeSessionId === id) {
      startNewChat();
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      sender: "user",
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const selectedSubject = activeSubject === "All Subjects" ? null : activeSubject;
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: userMessage.text,
          subject: selectedSubject,
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.answer,
          sources: data.sources,
          model: data.model,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "⚠ **Error**: Could not reach the tutoring agents. Make sure the backend server is running.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={containerStyle} className="animate-fade-in">
        {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={titleStyle}>AI Tutor Space</h1>
          <p style={subtitleStyle}>Resolve doubts, review core principles, and query your knowledge base.</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={() => setHistoryOpen(!historyOpen)} style={historyToggleBtnStyle} title="Chat History">
            🕐 History {history.length > 0 && <span style={historyCountBadge}>{history.length}</span>}
          </button>
          <button onClick={startNewChat} style={newChatBtnStyle} title="Start new chat">
            ✏️ New Chat
          </button>
        </div>
      </div>

      {/* Subject Pills */}
      <div style={pillContainerStyle}>
        {SUBJECTS.map((sub) => (
          <button
            key={sub}
            onClick={() => setActiveSubject(sub)}
            style={{
              ...pillStyle,
              background: activeSubject === sub ? "var(--accent)" : "rgba(255, 255, 255, 0.04)",
              borderColor: activeSubject === sub ? "var(--accent)" : "var(--border-glass)",
              color: activeSubject === sub ? "#fff" : "var(--text-secondary)",
              boxShadow: activeSubject === sub ? "0 0 14px var(--accent-glow)" : "none",
            }}
          >
            {sub === "All Subjects" ? "🌐 All Subjects" : sub}
          </button>
        ))}
      </div>

      {/* Workspace Grid */}
      <div style={gridStyle}>
        {/* Chat Panel */}
        <div className="glass-panel" style={chatPanelStyle}>
          <div style={messagesBoxStyle}>
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  ...messageWrapperStyle,
                  justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.sender === "ai" && <div style={avatarStyle}>👨‍🏫</div>}

                <div
                  style={{
                    ...bubbleStyle,
                    background:
                      msg.sender === "user"
                        ? "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(129, 140, 248, 0.08))"
                        : "rgba(255, 255, 255, 0.03)",
                    border:
                      msg.sender === "user"
                        ? "1px solid rgba(99, 102, 241, 0.35)"
                        : "1px solid rgba(255,255,255,0.06)",
                    borderRadius:
                      msg.sender === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  }}
                >
                  <MarkdownRenderer
                    text={msg.text}
                    sources={msg.sources}
                    onSourceClick={(sIdx) => {
                      if (msg.sources && msg.sources[sIdx]) {
                        setSelectedSource(msg.sources[sIdx]);
                      }
                    }}
                  />

                  {/* Message Meta */}
                  <div style={metaContainerStyle}>
                    {msg.model && <span style={modelBadgeStyle}>{msg.model}</span>}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {msg.sender === "user" && <div style={avatarStyle}>🎓</div>}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={messageWrapperStyle}>
                <div style={avatarStyle}>👨‍🏫</div>
                <div style={{ ...bubbleStyle, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px" }}>
                  <div style={{ display: "flex", gap: "6px", padding: "4px 0" }}>
                    <div style={{ ...dotStyle, animationDelay: "0s" }} />
                    <div style={{ ...dotStyle, animationDelay: "0.2s" }} />
                    <div style={{ ...dotStyle, animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSend} style={formStyle}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeSubject === "All Subjects"
                  ? "Ask about any concept (e.g. 'Explain merge sort')..."
                  : `Ask about ${activeSubject}...`
              }
              style={inputStyle}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                ...submitBtnStyle,
                opacity: loading || !input.trim() ? 0.6 : 1,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "..." : "Send ⚡"}
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <div style={sidebarStyle}>
          {/* Agent Status */}
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={panelHeadingStyle}>🦾 Active Agent Node</h3>
            <p style={panelBodyStyle}>
              Your request is routed directly to the <strong style={{ color: "#a5b4fc" }}>Concept Tutor Agent</strong>, which queries the ChromaDB vector store.
            </p>
            <div style={agentStatusStyle}>
              <span style={indicatorStyle} />
              <span style={{ fontSize: "12px", color: "var(--success)" }}>Tutor Agents Connected</span>
            </div>
          </div>

          {/* Helpful Prompts */}
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={panelHeadingStyle}>💡 Helpful Prompts</h3>
            <div style={promptsListStyle}>
              <button onClick={() => setInput("Explain TCP congestion control using a water pipe analogy.")} style={promptBtnStyle}>
                Explain TCP congestion control
              </button>
              <button onClick={() => setInput("What is the time complexity of QuickSort vs MergeSort in worst case?")} style={promptBtnStyle}>
                QuickSort vs MergeSort complexity
              </button>
              <button onClick={() => setInput("Explain dynamic programming in 3 simple rules.")} style={promptBtnStyle}>
                Dynamic programming rules
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ── Chat History Drawer ── */}
      {historyOpen && (
        <>
          {/* Backdrop */}
          <div style={historyBackdropStyle} onClick={() => setHistoryOpen(false)} />
          {/* Drawer */}
          <div style={historyDrawerStyle}>
            <div style={historyDrawerHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>🕐</span>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>Chat History</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button onClick={startNewChat} style={newChatSmallBtnStyle}>+ New Chat</button>
                <button onClick={() => setHistoryOpen(false)} style={drawerCloseBtnStyle}>✕</button>
              </div>
            </div>

            <div style={historyListStyle}>
              {history.length === 0 ? (
                <div style={emptyHistoryStyle}>
                  <span style={{ fontSize: "32px" }}>💬</span>
                  <p style={{ margin: "10px 0 4px", color: "#fff", fontWeight: 600, fontSize: "14px" }}>No past chats yet</p>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "12px" }}>Your conversations will appear here automatically.</p>
                </div>
              ) : (
                history.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session)}
                    style={{
                      ...historyItemStyle,
                      background: activeSessionId === session.id
                        ? "rgba(99,102,241,0.12)"
                        : "rgba(255,255,255,0.025)",
                      borderColor: activeSessionId === session.id
                        ? "rgba(99,102,241,0.4)"
                        : "rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={historyItemTitleStyle}>{session.title}</div>
                      <div style={historyItemMetaStyle}>
                        <span style={historySubjectBadgeStyle}>{session.subject || "All Subjects"}</span>
                        <span>{formatRelativeTime(session.createdAt)}</span>
                        <span>{session.messages.filter((m) => m.sender === "user").length} msg{session.messages.filter((m) => m.sender === "user").length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      style={deleteSessionBtnStyle}
                      title="Delete this chat"
                    >
                      🗑
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Source Detail Drawer */}
      {selectedSource && (
        <div style={drawerOverlayStyle} onClick={() => setSelectedSource(null)}>
          <div style={drawerContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={drawerHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={sourceBadgeStyle}>{selectedSource.subject || "Reference"}</span>
                <span style={drawerTitleStyle}>Source Details</span>
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
    </>
  );
}

// ── Markdown styles ──────────────────────────────────────────────────────────
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

// ── Layout ───────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  maxWidth: "1100px",
  margin: "0 auto",
  height: "calc(100vh - 120px)",
};

const titleStyle: React.CSSProperties = { fontSize: "26px", fontWeight: 700 };
const subtitleStyle: React.CSSProperties = { fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" };

const pillContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  paddingBottom: "6px",
};

const pillStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "20px",
  fontSize: "12.5px",
  fontWeight: 500,
  border: "1px solid",
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.2s ease",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gap: "20px",
  flex: 1,
  minHeight: 0,
};

const chatPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: "0",
  minHeight: 0,
  borderRadius: "var(--border-radius-lg)",
  background: "rgba(13, 17, 23, 0.25)",
};

const messagesBoxStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const messageWrapperStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  maxWidth: "85%",
};

const avatarStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--border-glass)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  flexShrink: 0,
};

const bubbleStyle: React.CSSProperties = {
  padding: "16px 20px",
  minWidth: "100px",
  boxShadow: "0 4px 18px rgba(0, 0, 0, 0.15)",
};

const metaContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "11px",
  color: "var(--text-secondary)",
  marginTop: "10px",
  borderTop: "1px solid rgba(255,255,255,0.04)",
  paddingTop: "6px",
};

const modelBadgeStyle: React.CSSProperties = {
  background: "rgba(236,72,153,0.12)",
  color: "#EC4899",
  border: "1px solid rgba(236,72,153,0.25)",
  borderRadius: "10px",
  padding: "1px 6px",
  fontSize: "10px",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  borderTop: "1px solid var(--border-glass)",
  padding: "16px 20px",
  gap: "12px",
  background: "rgba(0,0,0,0.15)",
  borderRadius: "0 0 var(--border-radius-lg) var(--border-radius-lg)",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "var(--border-radius)",
  color: "var(--text-primary)",
  padding: "12px 18px",
  fontSize: "14px",
  outline: "none",
  transition: "all 0.2s ease",
};

const submitBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  border: "none",
  borderRadius: "var(--border-radius)",
  color: "#fff",
  padding: "0 22px",
  fontSize: "14px",
  fontWeight: 600,
  boxShadow: "0 0 16px rgba(99,102,241,0.3)",
};

const sidebarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  overflowY: "auto",
};

const panelHeadingStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--text-primary)",
};

const panelBodyStyle: React.CSSProperties = {
  fontSize: "12.5px",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
  marginTop: "8px",
};

const agentStatusStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginTop: "14px",
};

const indicatorStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "var(--success)",
  boxShadow: "0 0 6px var(--success-glow)",
};

const promptsListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginTop: "12px",
};

const promptBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "6px",
  color: "var(--text-secondary)",
  padding: "8px 12px",
  fontSize: "12px",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const dotStyle: React.CSSProperties = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "rgba(255,255,255,0.5)",
  animation: "loadingSkeleton 1.4s infinite ease-in-out both",
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

// ── Header buttons ───────────────────────────────────────────────────────────
const historyToggleBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "var(--text-secondary)",
  padding: "8px 14px",
  fontSize: "13px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  transition: "all 0.2s ease",
};

const historyCountBadge: React.CSSProperties = {
  background: "var(--accent)",
  color: "#fff",
  borderRadius: "10px",
  padding: "1px 6px",
  fontSize: "10px",
  fontWeight: 700,
};

const newChatBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  padding: "8px 14px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 0 12px rgba(99,102,241,0.25)",
};

// ── History Drawer ───────────────────────────────────────────────────────────
const historyBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.35)",
  backdropFilter: "blur(3px)",
  zIndex: 999,
};

const historyDrawerStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: "360px",
  height: "100vh",
  background: "rgba(13, 17, 23, 0.97)",
  backdropFilter: "blur(24px)",
  borderLeft: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
};

const historyDrawerHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 20px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const historyListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const historyItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid",
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const historyItemTitleStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#e2e8f0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  marginBottom: "5px",
};

const historyItemMetaStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "11px",
  color: "var(--text-muted)",
};

const historySubjectBadgeStyle: React.CSSProperties = {
  background: "rgba(99,102,241,0.15)",
  color: "#a5b4fc",
  border: "1px solid rgba(99,102,241,0.2)",
  borderRadius: "8px",
  padding: "1px 6px",
  fontSize: "10px",
  fontWeight: 600,
};

const deleteSessionBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
  opacity: 0.4,
  padding: "4px",
  borderRadius: "4px",
  transition: "opacity 0.15s ease",
  flexShrink: 0,
};

const emptyHistoryStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 20px",
  textAlign: "center",
};

const newChatSmallBtnStyle: React.CSSProperties = {
  background: "rgba(99,102,241,0.15)",
  border: "1px solid rgba(99,102,241,0.25)",
  borderRadius: "6px",
  color: "#a5b4fc",
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

// ── Source drawer ────────────────────────────────────────────────────────────
const sourceBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  background: "rgba(99,102,241,0.15)",
  color: "var(--accent)",
  border: "1px solid rgba(99,102,241,0.25)",
  borderRadius: "10px",
  padding: "1px 6px",
  marginRight: "8px",
};

const drawerOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
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
  fontWeight: 700,
  color: "#fff",
};

const drawerBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
};

const drawerMetaRowStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "8px",
  padding: "14px",
};

const drawerChunkTextStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "8px",
  padding: "16px",
  fontSize: "13.5px",
  lineHeight: 1.7,
  color: "rgba(255,255,255,0.75)",
  whiteSpace: "pre-wrap",
};

const drawerCloseBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "6px",
  color: "var(--text-secondary)",
  cursor: "pointer",
  width: "30px",
  height: "30px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
};
