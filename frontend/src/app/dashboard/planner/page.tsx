"use client";

import React, { useState } from "react";

const AVAILABLE_SUBJECTS = [
  "Computer Networks",
  "Algorithms",
  "Database Systems",
  "System Design",
  "Operating Systems",
  "Machine Learning",
  "Data Structures",
  "Mathematics",
];

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

// Custom Markdown renderer for rendering the plan beautifully
function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Table parsing
    if (line.startsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      // Parse row
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Skip divider row |---|---|
      if (!cells.every((cell) => /^[-:]+$/.test(cell))) {
        tableRows.push(cells);
      }
      continue;
    } else {
      if (inTable) {
        // Output accumulated table
        elements.push(
          <div key={`table-${i}`} style={{ overflowX: "auto", margin: "16px 0" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {tableRows[0]?.map((cell, idx) => (
                    <th key={idx} style={thStyle}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.slice(1).map((row, rIdx) => (
                  <tr key={rIdx} style={trStyle}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={tdStyle}>{parseInlineFormatting(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        inTable = false;
      }
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} style={h3Style}>{parseInlineFormatting(line.slice(4))}</h3>);
      continue;
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} style={h2Style}>{parseInlineFormatting(line.slice(3))}</h2>);
      continue;
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} style={h1Style}>{parseInlineFormatting(line.slice(2))}</h1>);
      continue;
    }

    // Bullet points
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <ul key={i} style={ulStyle}>
          <li style={liStyle}>{parseInlineFormatting(line.slice(2))}</li>
        </ul>
      );
      continue;
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, "");
      elements.push(
        <ol key={i} style={olStyle}>
          <li style={liStyle}>{parseInlineFormatting(content)}</li>
        </ol>
      );
      continue;
    }

    // Paragraph
    if (line === "") {
      elements.push(<div key={i} style={{ height: "10px" }} />);
      continue;
    }

    elements.push(
      <p key={i} style={pStyle}>
        {parseInlineFormatting(line)}
      </p>
    );
  }

  // Handle table if it was at the end of the text
  if (inTable && tableRows.length > 0) {
    elements.push(
      <div key="table-end" style={{ overflowX: "auto", margin: "16px 0" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {tableRows[0]?.map((cell, idx) => (
                <th key={idx} style={thStyle}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, rIdx) => (
              <tr key={rIdx} style={trStyle}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} style={tdStyle}>{parseInlineFormatting(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div>{elements}</div>;
}

function parseInlineFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} style={{ color: "#fff" }}>{part.slice(2, -2)}</strong>;
    }
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.map((subPart, sIdx) => {
      if (subPart.startsWith("`") && subPart.endsWith("`")) {
        return <code key={`${idx}-${sIdx}`} style={inlineCodeStyle}>{subPart.slice(1, -1)}</code>;
      }
      return subPart;
    });
  });
}

export default function PlannerPage() {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [studyHours, setStudyHours] = useState(3);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string>("");
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSubjects.length === 0) {
      alert("Please select at least one subject.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/study-plan", {
        method: "POST",
        body: JSON.stringify({
          subjects: selectedSubjects,
          exam_date: examDate || null,
          study_hours_per_day: studyHours,
        }),
      });

      if (!res.ok) throw new Error("Plan generation failed");
      const data = await res.json();
      setPlan(data.plan);
      setDaysRemaining(data.days_until_exam);
    } catch {
      alert("Failed to build study plan. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle} className="animate-fade-in">
      {/* Header */}
      <div>
        <h1 style={titleStyle}>Study Planner</h1>
        <p style={subtitleStyle}>
          Design adaptive, priority-routed learning roadmaps integrated with your performance history.
        </p>
      </div>

      <div style={gridStyle}>
        {/* Left Column: Form Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="glass-panel" style={cardStyle}>
            <h2 style={sectionTitleStyle}>🗓️ Planner Settings</h2>
            <form onSubmit={handleGeneratePlan} style={formStyle}>
              {/* Subjects Checklist */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>Subjects to Include</label>
                <div style={subjectGridStyle}>
                  {AVAILABLE_SUBJECTS.map((sub) => {
                    const isSelected = selectedSubjects.includes(sub);
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => toggleSubject(sub)}
                        style={{
                          ...subjectBtnStyle,
                          background: isSelected
                            ? "rgba(99, 102, 241, 0.15)"
                            : "rgba(255, 255, 255, 0.02)",
                          borderColor: isSelected
                            ? "var(--accent)"
                            : "var(--border-glass)",
                          color: isSelected ? "#fff" : "var(--text-secondary)",
                          boxShadow: isSelected
                            ? "0 0 12px var(--accent-glow)"
                            : "none",
                        }}
                      >
                        {isSelected ? "✓ " : ""} {sub}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Date Picker */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>Target Exam Date (Optional)</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Study Hours Slider */}
              <div style={formGroupStyle}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label style={labelStyle}>Study Hours Available Per Day</label>
                  <span style={hoursValueStyle}>{studyHours} hrs/day</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={studyHours}
                  onChange={(e) => setStudyHours(Number(e.target.value))}
                  style={sliderStyle}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || selectedSubjects.length === 0}
                style={{
                  ...submitBtnStyle,
                  opacity: loading || selectedSubjects.length === 0 ? 0.6 : 1,
                  cursor: loading || selectedSubjects.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Constructing Spaced Timelines..." : "Build Study Plan ➔"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Plan Output Display */}
        <div style={{ minHeight: "450px" }}>
          {loading ? (
            <div className="glass-panel" style={loaderContainerStyle}>
              <div style={spinnerStyle} />
              <p style={{ marginTop: "16px", fontWeight: 600 }}>Analyzing Quiz History & Materials...</p>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>
                Structuring revision schedules using adaptive intervals.
              </p>
            </div>
          ) : plan ? (
            <div className="glass-panel animate-fade-in" style={planPanelStyle}>
              {daysRemaining !== null && daysRemaining > 0 && (
                <div style={badgeContainerStyle}>
                  <div style={daysBadgeStyle}>
                    ⚡ {daysRemaining} Days Until Exam
                  </div>
                </div>
              )}
              <MarkdownRenderer text={plan} />
            </div>
          ) : (
            <div className="glass-panel" style={emptyStateStyle}>
              <span style={{ fontSize: "48px" }}>📅</span>
              <h3 style={{ fontSize: "16px", fontWeight: 600, marginTop: "14px" }}>
                No active plan found
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "6px", maxWidth: "300px" }}>
                Configure your subject selection and exam schedule on the left to build your AI-guided study path.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline Markdown Styles ──────────────────────────────────────────────────
const h1Style: React.CSSProperties = { fontSize: "20px", fontWeight: 700, margin: "16px 0 10px 0", color: "#fff", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "6px" };
const h2Style: React.CSSProperties = { fontSize: "16px", fontWeight: 600, margin: "14px 0 8px 0", color: "#f8fafc" };
const h3Style: React.CSSProperties = { fontSize: "14.5px", fontWeight: 600, margin: "10px 0 6px 0", color: "#f1f5f9" };
const pStyle: React.CSSProperties = { fontSize: "14.5px", lineHeight: 1.6, margin: "4px 0 8px 0", color: "rgba(255,255,255,0.85)" };
const ulStyle: React.CSSProperties = { paddingLeft: "18px", margin: "4px 0 8px 0" };
const olStyle: React.CSSProperties = { paddingLeft: "18px", margin: "4px 0 8px 0" };
const liStyle: React.CSSProperties = { fontSize: "14px", lineHeight: 1.5, color: "rgba(255,255,255,0.8)", marginBottom: "4px" };
const inlineCodeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "4px",
  padding: "2px 5px",
  fontSize: "13px",
  fontFamily: "monospace",
  color: "#A7F3D0",
};

// ── Table Styles ────────────────────────────────────────────────────────────
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13.5px",
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  background: "rgba(255, 255, 255, 0.04)",
  color: "var(--text-secondary)",
  fontWeight: 600,
  borderBottom: "2px solid rgba(255,255,255,0.1)",
};
const trStyle: React.CSSProperties = {
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "rgba(255,255,255,0.85)",
};

// ── Layout Styles ──────────────────────────────────────────────────────────
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
  gridTemplateColumns: "380px 1fr",
  gap: "24px",
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  padding: "28px 30px",
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

const subjectGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px",
};

const subjectBtnStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "12.5px",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  padding: "12px 14px",
  fontSize: "14px",
  outline: "none",
};

const hoursValueStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--accent)",
};

const sliderStyle: React.CSSProperties = {
  width: "100%",
  cursor: "pointer",
  accentColor: "var(--accent)",
};

const submitBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "14px",
  fontSize: "14px",
  fontWeight: 600,
  boxShadow: "0 0 16px rgba(99,102,241,0.3)",
};

const planPanelStyle: React.CSSProperties = {
  padding: "32px 36px",
  minHeight: "450px",
};

const badgeContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "16px",
};

const daysBadgeStyle: React.CSSProperties = {
  background: "rgba(236,72,153,0.12)",
  border: "1px solid rgba(236,72,153,0.3)",
  color: "#EC4899",
  fontSize: "12.5px",
  fontWeight: 600,
  padding: "4px 12px",
  borderRadius: "20px",
  boxShadow: "0 0 10px rgba(236,72,153,0.15)",
};

const emptyStateStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
  textAlign: "center",
  background: "rgba(13, 17, 23, 0.15)",
};

const loaderContainerStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
  textAlign: "center",
};

const spinnerStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  border: "3px solid rgba(255,255,255,0.08)",
  borderTop: "3px solid var(--accent)",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};
