"use client";

import React, { useState, useEffect, useCallback } from "react";

// ── Type Definitions ───────────────────────────────────────────────────────
interface SubjectProgress {
  subject: string;
  progress: number;
  color: string;
}

interface StatCard {
  title: string;
  value: string;
  trend: "up" | "down" | "neutral";
  percentage: string;
}

interface HeatmapDay {
  date: string;
  hours: number;
}

interface DashboardData {
  subjects_progress: SubjectProgress[];
  stats: StatCard[];
  predicted_score: number;
  prediction_confidence: string;
  heatmap: HeatmapDay[];
  has_data: boolean;
}

// ── Auth Helper (reads JWT from localStorage or cookie) ──────────────────
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  // Primary: localStorage key "token" (set by auth/page.tsx)
  const ls = localStorage.getItem("token");
  if (ls) return ls;
  // Fallback: cookie named "token"
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

// ── Dashboard Component ────────────────────────────────────────────────────
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [quizAttempts, setQuizAttempts] = useState<Array<{
    score: number; difficulty: string; timestamp: string;
  }>>([]);

  // Study Goals state
  const [goals, setGoals] = useState<any[]>([]);
  const [goalSubject, setGoalSubject] = useState("All Subjects");
  const [targetHours, setTargetHours] = useState("10");
  const [targetScore, setTargetScore] = useState("80");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await apiFetch("/api/goals");
      if (res.ok) setGoals(await res.json());
    } catch (e) {
      console.error("Goals fetch error:", e);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [dashRes, attemptsRes] = await Promise.all([
        apiFetch("/api/analytics/dashboard"),
        apiFetch("/api/quiz/attempts"),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (attemptsRes.ok) setQuizAttempts(await attemptsRes.json());
      await fetchGoals();
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [fetchGoals]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingGoal(true);
    try {
      const res = await apiFetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: goalSubject,
          target_hours: parseFloat(targetHours) || 0,
          target_score: parseFloat(targetScore) || 0,
          deadline: goalDeadline ? new Date(goalDeadline).toISOString() : null,
        }),
      });
      if (res.ok) {
        setGoalDeadline("");
        fetchGoals();
      }
    } catch (e) {
      console.error("Add goal error:", e);
    } finally {
      setAddingGoal(false);
    }
  };

  const handleDeleteGoal = async (id: number) => {
    try {
      const res = await apiFetch(`/api/goals/${id}`, { method: "DELETE" });
      if (res.ok) fetchGoals();
    } catch (e) {
      console.error("Delete goal error:", e);
    }
  };

  if (loading) return <DashboardSkeleton />;
  if (!data) return (
    <div style={{ textAlign: "center", padding: "60px", color: "var(--text-secondary)" }}>
      <p>⚠️ Could not load dashboard. Please ensure you are logged in and the backend is running.</p>
    </div>
  );

  // Compute derived analytics
  const avgScore = quizAttempts.length > 0
    ? quizAttempts.reduce((s, a) => s + a.score, 0) / quizAttempts.length
    : 0;

  const weakAreas = data.subjects_progress.filter(s => s.progress < 60);
  const strongAreas = data.subjects_progress.filter(s => s.progress >= 75);

  const confNum = parseFloat(data.prediction_confidence) || 0;

  return (
    <div style={containerStyle} className="animate-fade-in">
      {/* Header */}
      <div>
        <h1 style={titleStyle}>Learning Analytics</h1>
        <p style={subtitleStyle}>Real-time intelligence from your AI study swarm and performance model.</p>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div style={statsGridStyle}>
        {data.stats.map((stat, i) => (
          <div key={i} className="glass-panel" style={statCardStyle}>
            <span style={statTitleStyle}>{stat.title}</span>
            <div style={statValRowStyle}>
              <span style={statValueStyle}>{stat.value}</span>
              <span style={trendBadgeStyle(stat.trend)}>
                {stat.trend === "up" ? "↑" : stat.trend === "down" ? "↓" : "—"} {stat.percentage}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-col Grid / Onboarding ───────────────────────────────────── */}
      {data.has_data ? (
        <div style={mainGridStyle}>
          {/* Left: Subject Progress Bars */}
          <div className="glass-panel" style={cardStyle}>
            <h2 style={cardTitleStyle}>Knowledge Status</h2>
            <p style={cardSubTitleStyle}>Per-subject mastery across your uploaded knowledge base.</p>

            {/* SVG Ring Gauges */}
            <div style={ringsRowStyle}>
              {data.subjects_progress.map((sub, i) => {
                const r = 36;
                const circ = 2 * Math.PI * r;
                const offset = circ - (sub.progress / 100) * circ;
                return (
                  <div key={i} style={ringWrapStyle}>
                    <div style={svgWrapStyle}>
                      <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r={r} fill="none"
                          stroke={sub.color} strokeWidth="8"
                          strokeDasharray={circ} strokeDashoffset={offset}
                          strokeLinecap="round"
                          transform="rotate(-90 50 50)"
                          style={{ transition: "stroke-dashoffset 1.2s ease-in-out" }}
                        />
                      </svg>
                      <span style={ringPctStyle}>{sub.progress}%</span>
                    </div>
                    <span style={ringLabelStyle}>{sub.subject}</span>
                  </div>
                );
              })}
            </div>

            {/* Horizontal bar chart supplement */}
            <div style={{ marginTop: "28px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.subjects_progress.map((sub, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{sub.subject}</span>
                    <span style={{ color: sub.color, fontWeight: 600 }}>{sub.progress}%</span>
                  </div>
                  <div style={barBgStyle}>
                    <div style={{
                      height: "100%", width: `${sub.progress}%`,
                      background: sub.color,
                      borderRadius: "4px",
                      transition: "width 1.2s ease-in-out",
                      boxShadow: `0 0 8px ${sub.color}50`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right col: ML prediction + weak/strong areas */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* ML Exam Forecast Badge */}
            <div className="glass-panel" style={{ ...cardStyle, alignItems: "center", textAlign: "center" }}>
              <h2 style={cardTitleStyle}>ML Exam Forecast</h2>
              <p style={cardSubTitleStyle}>RandomForest model trained on your study behavior.</p>

              <div style={glowBadgeStyle}>
                <span style={badgeNumStyle}>{data.predicted_score}%</span>
                <span style={badgeLabelStyle}>Expected Score</span>
              </div>

              <div style={{ width: "100%", marginTop: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Model Confidence</span>
                  <span style={{ color: "var(--success)", fontWeight: 600 }}>{data.prediction_confidence}</span>
                </div>
                <div style={barBgStyle}>
                  <div style={{
                    height: "100%", width: data.prediction_confidence,
                    background: "linear-gradient(90deg, #10B981, #34D399)",
                    borderRadius: "4px",
                    transition: "width 1s ease",
                    boxShadow: "0 0 8px rgba(16,185,129,0.5)",
                  }} />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 6px var(--success-glow)" }} />
                <span style={{ fontSize: "12px", color: "var(--success)" }}>Random Forest Model Active</span>
              </div>
            </div>

            {/* Weak vs Strong Areas */}
            <div className="glass-panel" style={cardStyle}>
              <h2 style={{ ...cardTitleStyle, fontSize: "15px" }}>Strength Analysis</h2>
              {strongAreas.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <p style={analysisLabelStyle("var(--success)")}>✓ Strong Areas</p>
                  {strongAreas.map(s => (
                    <div key={s.subject} style={analysisRowStyle}>
                      <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{s.subject}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--success)" }}>{s.progress}%</span>
                    </div>
                  ))}
                </div>
              )}
              {weakAreas.length > 0 && (
                <div style={{ marginTop: "14px" }}>
                  <p style={analysisLabelStyle("#F59E0B")}>⚠ Areas Needing Attention</p>
                  {weakAreas.map(s => (
                    <div key={s.subject} style={analysisRowStyle}>
                      <span style={{ fontSize: "13px", color: "var(--text-primary)" }}>{s.subject}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#F59E0B" }}>{s.progress}%</span>
                    </div>
                  ))}
                </div>
              )}
              {weakAreas.length === 0 && strongAreas.length === 0 && (
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "12px" }}>
                  Take quizzes to generate strength analysis data.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel animate-fade-in" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#fff" }}>🚀 Welcome to EduAgent!</h2>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: "4px" }}>
              To unlock full learning analytics, predictive AI scores, and strength insights, start by uploading notes and trying out quizzes.
            </p>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            {/* Step 1 */}
            <div style={onboardingCardStyle}>
              <div style={onboardingBadgeStyle}>1</div>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>Upload Study Material</h3>
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Add PDFs (lecture slides, text-books, or personal study notes) to your knowledge base.
              </p>
              <a href="/dashboard/upload" className="onboarding-button-hover" style={onboardingButtonStyle}>
                📁 Go to Ingest Notes
              </a>
            </div>

            {/* Step 2 */}
            <div style={onboardingCardStyle}>
              <div style={onboardingBadgeStyle}>2</div>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>Test Your Knowledge</h3>
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Generate adaptive practice quizzes or study interactive concept explanations from your uploaded material.
              </p>
              <a href="/dashboard/quiz" className="onboarding-button-hover" style={onboardingButtonStyle}>
                ⚡ Go to Quizzes & Theory
              </a>
            </div>

            {/* Step 3 */}
            <div style={onboardingCardStyle}>
              <div style={onboardingBadgeStyle}>3</div>
              <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>Deep Dive with AI Swarm</h3>
              <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                Chat with the Explainer Agent. Click on highlighted citation citations to see the precise text chunks.
              </p>
              <a href="/dashboard/chat" className="onboarding-button-hover" style={onboardingButtonStyle}>
                💬 Ask Explainer Agent
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Study Goals Tracker ────────────────────────────────────────────── */}
      <div className="glass-panel" style={cardStyle}>
        <h2 style={cardTitleStyle}>Weekly Target Goals</h2>
        <p style={cardSubTitleStyle}>Define and monitor your target study velocity and quiz performance milestones.</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "28px", alignItems: "start" }}>
          {/* Create Goal Form */}
          <form onSubmit={handleAddGoal} style={{ display: "flex", flexDirection: "column", gap: "16px", background: "rgba(255, 255, 255, 0.02)", padding: "20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>Set New Study Milestone</h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Subject / Topic Area</label>
              <select
                value={goalSubject}
                onChange={(e) => setGoalSubject(e.target.value)}
                style={{ ...selectStyle, padding: "8px 12px", background: "rgba(0,0,0,0.2)" }}
              >
                <option value="All Subjects">🌐 All Subjects</option>
                <option value="Computer Networks">Computer Networks</option>
                <option value="Algorithms">Algorithms</option>
                <option value="Database Systems">Database Systems</option>
                <option value="System Design">System Design</option>
                <option value="Operating Systems">Operating Systems</option>
                <option value="Machine Learning">Machine Learning</option>
                <option value="Mathematics">Mathematics</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Target Hours</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={targetHours}
                  onChange={(e) => setTargetHours(e.target.value)}
                  style={{ ...inputStyle, padding: "8px 12px", background: "rgba(0,0,0,0.2)" }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Target Score %</label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  style={{ ...inputStyle, padding: "8px 12px", background: "rgba(0,0,0,0.2)" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Target Deadline (Optional)</label>
              <input
                type="date"
                value={goalDeadline}
                onChange={(e) => setGoalDeadline(e.target.value)}
                style={{ ...inputStyle, padding: "8px 12px", background: "rgba(0,0,0,0.2)" }}
              />
            </div>

            <button
              type="submit"
              disabled={addingGoal}
              style={{ ...submitBtnStyle, padding: "10px", marginTop: "8px", width: "100%", height: "40px" }}
            >
              {addingGoal ? "Setting Milestone..." : "⚡ Enable Goal"}
            </button>
          </form>

          {/* Active Goals list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>Active Goals & Targets</h3>
            {goals.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)", background: "rgba(255,255,255,0.01)", borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.04)", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span style={{ fontSize: "28px" }}>🎯</span>
                <p style={{ marginTop: "10px", fontSize: "13px" }}>No active learning milestones set yet. Configure one to start tracking!</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", alignContent: "start" }}>
                {goals.map((g) => {
                  const actualHours = parseFloat(data.stats.find(s => s.title === "Study Hours")?.value || "0");
                  
                  let actualScore = 0;
                  if (g.subject === "All Subjects") {
                    actualScore = avgScore;
                  } else {
                    const matchSub = data.subjects_progress.find(s => s.subject === g.subject);
                    actualScore = matchSub ? matchSub.progress : 0;
                  }

                  const hoursPct = Math.min((actualHours / g.target_hours) * 100, 100);
                  const scorePct = Math.min((actualScore / g.target_score) * 100, 100);

                  const hoursMet = actualHours >= g.target_hours;
                  const scoreMet = actualScore >= g.target_score;

                  return (
                    <div key={g.id} style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <strong style={{ fontSize: "13.5px", color: "#fff" }}>{g.subject}</strong>
                          {g.deadline && (
                            <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                              📅 By {new Date(g.deadline).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteGoal(g.id)}
                          style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", color: "#EF4444", borderRadius: "4px", padding: "2px 6px", fontSize: "10px", cursor: "pointer" }}
                          title="Complete / Delete Goal"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Study hours progress */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Study Time Target</span>
                          <span style={{ color: hoursMet ? "var(--success)" : "#fff", fontWeight: 600 }}>
                            {actualHours.toFixed(1)} / {g.target_hours.toFixed(0)} hrs
                          </span>
                        </div>
                        <div style={barBgStyle}>
                          <div style={{
                            height: "100%", width: `${hoursPct}%`,
                            background: hoursMet ? "var(--success)" : "var(--accent)",
                            borderRadius: "3px",
                            boxShadow: `0 0 6px ${hoursMet ? "var(--success-glow)" : "rgba(99,102,241,0.4)"}`,
                          }} />
                        </div>
                      </div>

                      {/* Quiz score progress */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Mastery Score Target</span>
                          <span style={{ color: scoreMet ? "var(--success)" : "#fff", fontWeight: 600 }}>
                            {actualScore.toFixed(0)}% / {g.target_score.toFixed(0)}%
                          </span>
                        </div>
                        <div style={barBgStyle}>
                          <div style={{
                            height: "100%", width: `${scorePct}%`,
                            background: scoreMet ? "var(--success)" : "#F59E0B",
                            borderRadius: "3px",
                            boxShadow: `0 0 6px ${scoreMet ? "var(--success-glow)" : "rgba(245,158,11,0.4)"}`,
                          }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quiz Score Trend Chart ─────────────────────────────────────────── */}
      {quizAttempts.length > 0 && (
        <div className="glass-panel" style={cardStyle}>
          <h2 style={cardTitleStyle}>Quiz Score Trend</h2>
          <p style={cardSubTitleStyle}>Performance trajectory across your quiz attempts (most recent first).</p>
          <div style={trendChartStyle}>
            {[...quizAttempts].reverse().slice(-10).map((att, i, arr) => {
              const maxH = 100;
              const barH = (att.score / 100) * maxH;
              const color = att.score >= 80 ? "#10B981" : att.score >= 60 ? "#F59E0B" : "#EF4444";
              return (
                <div key={i} style={trendBarWrapStyle} title={`Score: ${att.score}% (${att.difficulty})`}>
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    {att.score.toFixed(0)}%
                  </span>
                  <div style={{ ...trendBarStyle, height: `${barH}px`, background: color, boxShadow: `0 0 8px ${color}60` }} />
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {att.difficulty.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)", marginTop: "12px" }}>
            <span>Average: <strong style={{ color: "#fff" }}>{avgScore.toFixed(0)}%</strong></span>
            <span>Total Attempts: <strong style={{ color: "#fff" }}>{quizAttempts.length}</strong></span>
            <div style={{ display: "flex", gap: "12px" }}>
              <span style={{ color: "#10B981" }}>■ ≥80% (Strong)</span>
              <span style={{ color: "#F59E0B" }}>■ 60–79% (Good)</span>
              <span style={{ color: "#EF4444" }}>■ &lt;60% (Needs Work)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Study Consistency Heatmap ──────────────────────────────────────── */}
      <div className="glass-panel" style={cardStyle}>
        <h2 style={cardTitleStyle}>Study Consistency</h2>
        <p style={cardSubTitleStyle}>Daily activity heatmap over the past 30 days.</p>
        <div style={heatmapGridStyle}>
          {[...data.heatmap].reverse().map((day, i) => {
            const opacity = Math.min(day.hours / 5, 1);
            const bg = opacity > 0
              ? `rgba(99,102,241,${opacity * 0.7 + 0.2})`
              : "rgba(255,255,255,0.02)";
            const border = opacity > 0 ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.05)";
            return (
              <div
                key={i}
                style={{ width: "28px", height: "28px", borderRadius: "5px", background: bg, border: `1px solid ${border}`, cursor: "pointer", transition: "transform 150ms ease" }}
                title={`${day.date}: ${day.hours.toFixed(1)} hrs`}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "11px", color: "var(--text-secondary)" }}>
          <span>← 30 days ago</span>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {[0.02, 0.25, 0.5, 0.75, 1].map((o, i) => (
              <div key={i} style={{ width: "12px", height: "12px", borderRadius: "3px", background: o > 0.1 ? `rgba(99,102,241,${o})` : "rgba(255,255,255,0.02)" }} />
            ))}
          </div>
          <span>Today →</span>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton Loader ────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ height: "40px", width: "300px" }} className="skeleton" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "24px" }}>
        {[1,2,3,4].map(i => <div key={i} className="glass-panel skeleton" style={{ height: "100px" }} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        <div className="glass-panel skeleton" style={{ height: "340px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="glass-panel skeleton" style={{ height: "200px" }} />
          <div className="glass-panel skeleton" style={{ height: "140px" }} />
        </div>
      </div>
      <div className="glass-panel skeleton" style={{ height: "180px" }} />
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "28px" };

const onboardingCardStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: "12px",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  position: "relative",
};

const onboardingBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: "16px",
  right: "16px",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "rgba(99, 102, 241, 0.15)",
  color: "var(--accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  fontWeight: 700,
  border: "1px solid rgba(99, 102, 241, 0.3)",
};

const onboardingButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  color: "#fff",
  padding: "10px",
  fontSize: "12.5px",
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  transition: "all 0.2s ease",
  marginTop: "auto",
};
const titleStyle: React.CSSProperties = { fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px" };
const subtitleStyle: React.CSSProperties = { fontSize: "14px", color: "var(--text-secondary)", marginTop: "4px" };

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
};

const statCardStyle: React.CSSProperties = {
  padding: "22px 24px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const statTitleStyle: React.CSSProperties = { fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500 };
const statValRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline" };
const statValueStyle: React.CSSProperties = { fontSize: "30px", fontWeight: 800, color: "var(--text-primary)" };

const trendBadgeStyle = (trend: "up" | "down" | "neutral"): React.CSSProperties => ({
  fontSize: "12px",
  fontWeight: 600,
  color: trend === "up" ? "var(--success)" : trend === "down" ? "#EF4444" : "var(--text-secondary)",
  background: trend === "up" ? "rgba(16,185,129,0.1)" : trend === "down" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)",
  padding: "2px 8px",
  borderRadius: "12px",
  border: `1px solid ${trend === "up" ? "rgba(16,185,129,0.2)" : trend === "down" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"}`,
});

const mainGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" };

const cardStyle: React.CSSProperties = { padding: "28px", display: "flex", flexDirection: "column" };
const cardTitleStyle: React.CSSProperties = { fontSize: "18px", fontWeight: 600, marginBottom: "4px" };
const cardSubTitleStyle: React.CSSProperties = { fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" };

const ringsRowStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "16px", padding: "8px 0",
};

const ringWrapStyle: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" };
const svgWrapStyle: React.CSSProperties = {
  position: "relative", width: "100px", height: "100px",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const ringPctStyle: React.CSSProperties = { position: "absolute", fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" };
const ringLabelStyle: React.CSSProperties = { fontSize: "12px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "80px" };

const barBgStyle: React.CSSProperties = {
  width: "100%", height: "6px", background: "rgba(255,255,255,0.04)",
  borderRadius: "3px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)",
};

const glowBadgeStyle: React.CSSProperties = {
  width: "130px", height: "130px", borderRadius: "50%",
  background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.03) 80%)",
  border: "2px dashed rgba(99,102,241,0.5)",
  boxShadow: "0 0 40px rgba(99,102,241,0.25)",
  display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  marginTop: "4px",
};
const badgeNumStyle: React.CSSProperties = { fontSize: "34px", fontWeight: 800, color: "#fff", textShadow: "0 0 12px rgba(99,102,241,0.6)" };
const badgeLabelStyle: React.CSSProperties = { fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" };

const analysisLabelStyle = (color: string): React.CSSProperties => ({
  fontSize: "12px", fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px",
});

const analysisRowStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", padding: "7px 12px",
  background: "rgba(255,255,255,0.02)", borderRadius: "6px", marginBottom: "4px",
};

const trendChartStyle: React.CSSProperties = {
  display: "flex", gap: "10px", alignItems: "flex-end", height: "120px",
  padding: "4px 0", overflowX: "auto",
};

const trendBarWrapStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", minWidth: "44px",
};

const trendBarStyle: React.CSSProperties = {
  width: "32px", borderRadius: "4px 4px 0 0",
  transition: "height 0.8s ease",
};

const heatmapGridStyle: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: "6px", padding: "6px 0",
};

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  padding: "10px 14px",
  fontSize: "13px",
  width: "100%",
  cursor: "pointer",
  outline: "none",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "8px",
  color: "var(--text-primary)",
  padding: "10px 14px",
  fontSize: "13px",
  width: "100%",
  outline: "none",
};

const submitBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--border-radius)",
  padding: "12px 20px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 0 16px rgba(99,102,241,0.3)",
};
