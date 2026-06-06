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
      "Content-Type": "application/json",
      ...(apiKey ? { "X-Gemini-API-Key": apiKey } : {}),
      ...(opts.headers || {}),
    },
  });
}

// Simple Custom Markdown Parser to render beautiful styled text without needing external packages
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

    // Process normal line formatting (Headers, Lists, Bold)
    let renderedLine: React.ReactNode = line;

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} style={h3Style}>{parseInlineFormatting(line.slice(4), sources, onSourceClick)}</h3>);
      continue;
    } else if (line.startsWith("#### ")) {
      elements.push(<h4 key={i} style={h4Style}>{parseInlineFormatting(line.slice(5), sources, onSourceClick)}</h4>);
      continue;
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} style={h2Style}>{parseInlineFormatting(line.slice(3), sources, onSourceClick)}</h2>);
      continue;
    }

    // Bullet Lists
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <ul key={i} style={ulStyle}>
          <li style={liStyle}>{parseInlineFormatting(line.slice(2), sources, onSourceClick)}</li>
        </ul>
      );
      continue;
    }

    // Empty space
    if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: "8px" }} />);
      continue;
    }

    // Default Paragraph line
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
  // Simple bold parser **bold**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.flatMap((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return [<strong key={`bold-${idx}`} style={{ color: "#fff" }}>{part.slice(2, -2)}</strong>];
    }
    // Inline code fallback `code`
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.flatMap((subPart, sIdx) => {
      if (subPart.startsWith("`") && subPart.endsWith("`")) {
        return [<code key={`code-${idx}-${sIdx}`} style={inlineCodeStyle}>{subPart.slice(1, -1)}</code>];
      }
      
      // Split by source citation pattern: [Source X: ...] or [Source X]
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

export default function ChatPage() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

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

      if (!res.ok) {
        throw new Error("API error");
      }

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
          text: "⚠ **Error**: Could not reach the tutoring agent swarm. Make sure the backend server is running.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle} className="animate-fade-in">
      {/* Header */}
      <div>
        <h1 style={titleStyle}>AI Tutor Space</h1>
        <p style={subtitleStyle}>
          Resolve doubts, review core principles, and query your vector knowledge base.
        </p>
      </div>

      {/* Subject Pills Selection */}
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
        {/* Chat box */}
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
                {/* Tutor Avatar */}
                {msg.sender === "ai" && (
                  <div style={avatarStyle}>👨‍🏫</div>
                )}

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
                      msg.sender === "user"
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
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

                  {/* Sources display */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={sourcesContainerStyle}>
                      <p style={sourcesTitleStyle}>📚 Referenced Knowledge Chunks:</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {msg.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            style={{ ...sourceItemStyle, cursor: "pointer" }}
                            onClick={() => setSelectedSource(src)}
                            title="Click to view full content"
                          >
                            <span style={sourceBadgeStyle}>{src.subject || "Reference"}</span>
                            <span style={sourceDocStyle}>{src.filename} (Page {src.page})</span>
                            <div style={sourcePreviewStyle}>{src.preview}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Meta Info */}
                  <div style={metaContainerStyle}>
                    {msg.model && <span style={modelBadgeStyle}>{msg.model}</span>}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {/* User Avatar */}
                {msg.sender === "user" && (
                  <div style={avatarStyle}>🎓</div>
                )}
              </div>
            ))}

            {/* Thinking / Typing indicator */}
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

          {/* Form input */}
          <form onSubmit={handleSend} style={formStyle}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                activeSubject === "All Subjects"
                  ? "Ask about any concept (e.g. 'What is packet routing?')..."
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

        {/* Sidebar Info Panels */}
        <div style={sidebarStyle}>
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={panelHeadingStyle}>🦾 Active Swarm Node</h3>
            <p style={panelBodyStyle}>
              Your request is routed directly to the **Concept Tutor Agent**, which queries ChromaDB vector store page-by-page.
            </p>
            <div style={agentStatusStyle}>
              <span style={indicatorStyle} />
              <span style={{ fontSize: "12px", color: "var(--success)" }}>Tutor Swarm Connected</span>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={panelHeadingStyle}>💡 Helpful Prompts</h3>
            <div style={promptsListStyle}>
              <button
                onClick={() => setInput("Explain TCP congestion control using a water pipe analogy.")}
                style={promptBtnStyle}
              >
                Explain TCP congestion control
              </button>
              <button
                onClick={() => setInput("What is the time complexity of QuickSort vs MergeSort in worst case?")}
                style={promptBtnStyle}
              >
                QuickSort vs MergeSort complexity
              </button>
              <button
                onClick={() => setInput("Explain dynamic programming in 3 simple rules.")}
                style={promptBtnStyle}
              >
                Dynamic programming rules
              </button>
            </div>
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
    </div>
  );
}

// ── Markdown styles ────────────────────────────────────────────────────────
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

// ── Layout styles ──────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  maxWidth: "1100px",
  margin: "0 auto",
  height: "calc(100vh - 120px)",
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

const pillContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  paddingBottom: "6px",
  scrollBehavior: "smooth",
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

const sourcesContainerStyle: React.CSSProperties = {
  marginTop: "14px",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  paddingTop: "12px",
};

const sourcesTitleStyle: React.CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 600,
  color: "#34D399",
  marginBottom: "8px",
};

const sourceItemStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.04)",
  borderRadius: "6px",
  padding: "8px 12px",
};

const sourceBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  background: "rgba(99,102,241,0.15)",
  color: "var(--accent)",
  border: "1px solid rgba(99,102,241,0.25)",
  borderRadius: "10px",
  padding: "1px 6px",
  marginRight: "8px",
};

const sourceDocStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--text-primary)",
};

const sourcePreviewStyle: React.CSSProperties = {
  fontSize: "11.5px",
  color: "var(--text-secondary)",
  marginTop: "4px",
  fontStyle: "italic",
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
