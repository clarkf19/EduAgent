"use client";

import React, { useState, useEffect, useCallback } from "react";

interface Flashcard {
  id: number;
  front: string;
  back: string;
  subject: string;
  leitner_box: number;
  next_review: string;
  created_at: string;
}

const SUBJECTS = [
  "Computer Networks",
  "Algorithms",
  "Database Systems",
  "System Design",
  "Operating Systems",
  "Machine Learning",
  "Data Structures",
  "Mathematics"
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Generation form states
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [topicInput, setTopicInput] = useState("");
  const [numCards, setNumCards] = useState(5);

  // Reviewing states
  const [reviewMode, setReviewMode] = useState(false);
  const [currentReviewIdx, setCurrentReviewIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);

  // Fetch helpers
  const getHeaders = () => {
    const token = localStorage.getItem("token");
    const groqKey = localStorage.getItem("groq_api_key");
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(groqKey ? { "X-Groq-Api-Key": groqKey } : {}),
    };
  };

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const resAll = await fetch(`${API_BASE}/api/flashcards`, { headers });
      if (resAll.ok) {
        const data = await resAll.json();
        setCards(data);
      }

      const resDue = await fetch(`${API_BASE}/api/flashcards/review`, { headers });
      if (resDue.ok) {
        const dataDue = await resDue.json();
        setDueCards(dataDue);
      }
    } catch (e) {
      console.error("Failed to fetch flashcards", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;
    setGenerating(true);
    try {
      const headers = getHeaders();
      const res = await fetch(`${API_BASE}/api/flashcards/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: selectedSubject,
          topic: topicInput || null,
          num_cards: numCards,
        }),
      });
      if (res.ok) {
        setTopicInput("");
        await fetchCards();
      } else {
        alert("Failed to generate flashcards. Please check your network/API key settings.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const submitReview = async (rating: "easy" | "medium" | "hard") => {
    if (dueCards.length === 0) return;
    const currentCard = dueCards[currentReviewIdx];
    try {
      const headers = getHeaders();
      const res = await fetch(`${API_BASE}/api/flashcards/${currentCard.id}/review`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating }),
      });
      if (res.ok) {
        // Trigger exit slide animation
        setAnimatingOut(true);
        setTimeout(() => {
          setIsFlipped(false);
          setAnimatingOut(false);
          if (currentReviewIdx < dueCards.length - 1) {
            setCurrentReviewIdx(prev => prev + 1);
          } else {
            // Finished reviewing all due cards!
            setReviewMode(false);
            setCurrentReviewIdx(0);
            fetchCards();
          }
        }, 300);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this flashcard?")) return;
    try {
      const headers = getHeaders();
      const res = await fetch(`${API_BASE}/api/flashcards/${id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        await fetchCards();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Compute metrics
  const cardsByBox = Array.from({ length: 5 }, (_, i) => cards.filter(c => c.leitner_box === i + 1).length);

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes slideOutLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-150px); opacity: 0; }
        }
        .card-exit {
          animation: slideOutLeft 0.3s forwards ease-in;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={titleStyle}>Spaced Repetition Flashcards</h1>
          <p style={subtitleStyle}>Master technical terminology using the science of the Leitner learning system.</p>
        </div>
        {dueCards.length > 0 && !reviewMode && (
          <button onClick={() => setReviewMode(true)} style={startReviewBtnStyle}>
            🔥 Review Due Cards ({dueCards.length})
          </button>
        )}
      </div>

      {reviewMode ? (
        /* Review Screen */
        <div style={reviewContainerStyle}>
          <div style={reviewHeaderStyle}>
            <button onClick={() => { setReviewMode(false); fetchCards(); }} style={backBtnStyle}>
              ⬅ Exit Review
            </button>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
              Card {currentReviewIdx + 1} of {dueCards.length}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "center", margin: "40px 0" }}>
            <div 
              style={{
                ...cardFlipWrapperStyle,
                perspective: "1000px"
              }}
              className={animatingOut ? "card-exit" : ""}
            >
              <div 
                style={{
                  ...cardFlipInnerStyle,
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front Side */}
                <div style={cardFrontStyle}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--accent)", letterSpacing: "1px", marginBottom: "16px" }}>
                    ❓ Question · {dueCards[currentReviewIdx]?.subject}
                  </div>
                  <div style={cardContentTextStyle}>
                    {dueCards[currentReviewIdx]?.front}
                  </div>
                  <div style={flipNoticeStyle}>
                    🔄 Click anywhere to flip
                  </div>
                </div>

                {/* Back Side */}
                <div style={cardBackStyle}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#10B981", letterSpacing: "1px", marginBottom: "16px" }}>
                    💡 Answer · Key Concept
                  </div>
                  <div style={cardContentTextStyle}>
                    {dueCards[currentReviewIdx]?.back}
                  </div>
                  <div style={flipNoticeStyle}>
                    🔄 Click anywhere to flip back
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Review Actions */}
          <div style={actionsContainerStyle}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px", textAlign: "center" }}>
              How well did you recall this concept?
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
              <button onClick={() => submitReview("hard")} style={ratingBtnStyle("#EF4444", "rgba(239, 68, 68, 0.1)")}>
                🔴 Hard (Back to Box 1)
              </button>
              <button onClick={() => submitReview("medium")} style={ratingBtnStyle("#F59E0B", "rgba(245, 158, 11, 0.1)")}>
                🟡 Medium (Keep Box)
              </button>
              <button onClick={() => submitReview("easy")} style={ratingBtnStyle("#10B981", "rgba(16, 185, 129, 0.1)")}>
                🟢 Easy (Advance Box)
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Standard Workspace Screen */
        <div style={gridStyle}>
          {/* Main workspace (Dashboard & list) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Box Stats Panel */}
            <div style={statsPanelStyle} className="glass-panel">
              <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px", color: "#fff" }}>Leitner Box Distribution</h3>
              <div style={statsGridStyle}>
                {cardsByBox.map((count, index) => (
                  <div key={index} style={boxStatItemStyle}>
                    <div style={boxNumberStyle(index + 1)}>{index + 1}</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "4px 0" }}>{count}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Box {index + 1}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Flashcard List Panel */}
            <div style={listPanelStyle} className="glass-panel">
              <h3 style={{ fontSize: "15px", fontWeight: 600, padding: "20px", borderBottom: "1px solid var(--border-glass)", color: "#fff" }}>
                My Knowledge Deck ({cards.length} Cards)
              </h3>
              <div style={listScrollStyle}>
                {loading ? (
                  <p style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Loading cards...</p>
                ) : cards.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <span style={{ fontSize: "36px" }}>🃏</span>
                    <p style={{ fontSize: "14px", fontWeight: 600, marginTop: "12px", color: "#fff" }}>Deck is empty</p>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                      Generate cards on the right side panel to get started.
                    </p>
                  </div>
                ) : (
                  cards.map((card) => (
                    <div key={card.id} style={cardListItemStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                          <span style={badgeStyle}>{card.subject}</span>
                          <span style={boxBadgeStyle(card.leitner_box)}>Box {card.leitner_box}</span>
                        </div>
                        <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#fff" }}>
                          Q: {card.front}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          A: {card.back}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(card.id)} style={deleteBtnStyle}>
                        🗑 Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Side generator panel */}
          <div className="glass-panel" style={generatorPanelStyle}>
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px", color: "#fff" }}>⚙ AI Generator Panel</h3>
            <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Subject Area</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  style={inputStyle}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s} style={{ backgroundColor: "#0D1117", color: "#F3F4F6" }}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Sub-Topic / Concept (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. merge sort, tcp handshake"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Number of Cards</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numCards}
                  onChange={(e) => setNumCards(parseInt(e.target.value) || 5)}
                  style={inputStyle}
                />
              </div>

              <button type="submit" disabled={generating} style={generateSubmitBtnStyle}>
                {generating ? "✨ Generating..." : "⚡ Generate Flashcards"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  maxWidth: "1100px",
  margin: "0 auto",
  height: "100%",
};

const titleStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 700,
  color: "#fff",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text-secondary)",
  marginTop: "4px",
};

const startReviewBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #EC4899)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 0 16px rgba(99,102,241,0.25)",
  transition: "transform 0.2s ease",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: "24px",
  alignItems: "start",
};

const statsPanelStyle: React.CSSProperties = {
  padding: "20px",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "12px",
};

const boxStatItemStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: "8px",
  padding: "16px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const boxNumberStyle = (box: number): React.CSSProperties => {
  const colors = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981"];
  return {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor: colors[box - 1] + "20",
    color: colors[box - 1],
    border: `1px solid ${colors[box - 1]}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "bold",
  };
};

const listPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxHeight: "550px",
};

const listScrollStyle: React.CSSProperties = {
  overflowY: "auto",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const cardListItemStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.04)",
  borderRadius: "10px",
  padding: "16px 20px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const badgeStyle: React.CSSProperties = {
  fontSize: "10px",
  background: "rgba(99, 102, 241, 0.15)",
  color: "#a5b4fc",
  border: "1px solid rgba(99, 102, 241, 0.25)",
  borderRadius: "6px",
  padding: "1px 6px",
  fontWeight: 600,
};

const boxBadgeStyle = (box: number): React.CSSProperties => {
  const colors = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6", "#10B981"];
  return {
    fontSize: "10px",
    background: colors[box - 1] + "15",
    color: colors[box - 1],
    border: `1px solid ${colors[box - 1]}30`,
    borderRadius: "6px",
    padding: "1px 6px",
    fontWeight: 600,
  };
};

const deleteBtnStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  borderRadius: "6px",
  color: "#f87171",
  fontSize: "12px",
  padding: "6px 12px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const emptyStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 20px",
  textAlign: "center",
};

const generatorPanelStyle: React.CSSProperties = {
  padding: "20px",
  display: "flex",
  flexDirection: "column",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: "6px",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "var(--border-radius)",
  color: "var(--text-primary)",
  padding: "10px 14px",
  fontSize: "13.5px",
  outline: "none",
};

const generateSubmitBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  border: "none",
  borderRadius: "var(--border-radius)",
  color: "#fff",
  padding: "12px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 0 16px rgba(99,102,241,0.25)",
  marginTop: "8px",
};

// --- Review Mode Styles ---

const reviewContainerStyle: React.CSSProperties = {
  background: "rgba(13, 17, 23, 0.35)",
  border: "1px solid var(--border-glass)",
  borderRadius: "var(--border-radius-lg)",
  padding: "24px",
};

const reviewHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const backBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  color: "var(--text-secondary)",
  padding: "8px 14px",
  borderRadius: "6px",
  fontSize: "13px",
  cursor: "pointer",
};

const cardFlipWrapperStyle: React.CSSProperties = {
  width: "480px",
  height: "280px",
  cursor: "pointer",
  position: "relative",
  transition: "transform 0.3s ease",
};

const cardFlipInnerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  position: "absolute",
  transformStyle: "preserve-3d",
  transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
};

const sideBaseStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  borderRadius: "16px",
  padding: "36px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const cardFrontStyle: React.CSSProperties = {
  ...sideBaseStyle,
  background: "linear-gradient(135deg, #1c2130, #131722)",
};

const cardBackStyle: React.CSSProperties = {
  ...sideBaseStyle,
  background: "linear-gradient(135deg, #112224, #0b1517)",
  transform: "rotateY(180deg)",
};

const cardContentTextStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  lineHeight: 1.5,
  color: "#fff",
  textAlign: "center",
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const flipNoticeStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted)",
  textAlign: "center",
  marginTop: "16px",
};

const actionsContainerStyle: React.CSSProperties = {
  borderTop: "1px solid var(--border-glass)",
  paddingTop: "20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const ratingBtnStyle = (color: string, bg: string): React.CSSProperties => ({
  background: bg,
  border: `1px solid ${color}35`,
  color: color,
  padding: "10px 18px",
  borderRadius: "8px",
  fontSize: "13.5px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
});
