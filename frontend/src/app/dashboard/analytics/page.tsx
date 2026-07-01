"use client";

import React, { useState, useEffect, useCallback } from "react";

interface SubjectMastery {
  subject: string;
  quiz_score_avg: number;
  study_hours: number;
  mastery_pct: number;
  quiz_count: number;
}

interface MasteryData {
  subjects: SubjectMastery[];
  overall_mastery: number;
  weaknesses: string[];
  ai_recommendations: string;
  model: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function AnalyticsPage() {
  const [data, setData] = useState<MasteryData | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch mastery analytics
      const resMastery = await fetch(`${API_BASE}/api/analytics/mastery`, { headers });
      if (resMastery.ok) {
        const masteryJson = await resMastery.json();
        setData(masteryJson);
      }

      // Fetch dashboard heatmap/stats
      const resDashboard = await fetch(`${API_BASE}/api/analytics/dashboard`, { headers });
      if (resDashboard.ok) {
        const dashboardJson = await resDashboard.json();
        setDashboardData(dashboardJson);
      }
    } catch (e) {
      console.error("Failed to fetch analytics data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Extract 7-day study trajectory points for the custom SVG chart
  const getTrajectoryData = () => {
    if (!dashboardData || !dashboardData.heatmap) {
      return Array.from({ length: 7 }, (_, i) => ({ day: `Day ${7-i}`, hours: 0 }));
    }
    
    // Get last 7 days and reverse to chronological order
    const last7 = dashboardData.heatmap.slice(0, 7).reverse();
    return last7.map((item: any) => {
      const dateObj = new Date(item.date);
      const dayLabel = dateObj.toLocaleDateString([], { weekday: "short" });
      return {
        day: dayLabel,
        hours: item.hours
      };
    });
  };

  const trajectory = getTrajectoryData();
  const maxHours = Math.max(...trajectory.map((t: any) => t.hours), 1.0); // scale chart

  // SVG Chart Layout math
  const padding = 40;
  const chartWidth = 600;
  const chartHeight = 180;
  const plotWidth = chartWidth - padding * 2;
  const plotHeight = chartHeight - padding * 2;

  // Generate SVG coordinate points
  const points = trajectory.map((item: any, idx: number) => {
    const x = padding + (idx * plotWidth) / (trajectory.length - 1);
    const y = chartHeight - padding - (item.hours / maxHours) * plotHeight;
    return { x, y, ...item };
  });

  const polylinePointsStr = points.map((p: any) => `${p.x},${p.y}`).join(" ");

  // Color mappings
  const colorMap: Record<string, string> = {
    "Computer Networks": "#3b82f6",
    "Algorithms": "#ec4899",
    "Database Systems": "#10b981",
    "System Design": "#f59e0b",
    "Operating Systems": "#3b82f6",
    "Machine Learning": "#8b5cf6",
    "Mathematics": "#ef4444"
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div>
        <h1 style={titleStyle}>AI Study Analytics & Mastery</h1>
        <p style={subtitleStyle}>In-depth skill breakdowns, activity logs, and personal recommendations from your study coach.</p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", padding: "80px", color: "var(--text-secondary)" }}>Loading profile metrics...</p>
      ) : (
        <div style={gridStyle}>
          {/* Main metrics display */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Subject Mastery meters */}
            <div style={panelStyle} className="glass-panel">
              <h3 style={panelTitleStyle}>🎯 Skill Mastery Matrix</h3>
              <div style={masteryMetersGridStyle}>
                {data?.subjects.map((subj) => {
                  const circleColor = colorMap[subj.subject] || "#6366f1";
                  const radius = 36;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (subj.mastery_pct / 100) * circumference;

                  return (
                    <div key={subj.subject} style={masteryCardStyle}>
                      <svg width="90" height="90" style={{ transform: "rotate(-90deg)" }}>
                        {/* Background track circle */}
                        <circle
                          cx="45"
                          cy="45"
                          r={radius}
                          stroke="rgba(255, 255, 255, 0.04)"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        {/* Progress circle */}
                        <circle
                          cx="45"
                          cy="45"
                          r={radius}
                          stroke={circleColor}
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          style={{
                            transition: "stroke-dashoffset 0.8s ease-out",
                            filter: "drop-shadow(0px 0px 4px rgba(99, 102, 241, 0.3))"
                          }}
                        />
                      </svg>
                      {/* Percent text over ring */}
                      <div style={masteryPercentTextStyle}>
                        {subj.mastery_pct}%
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginTop: "12px", textAlign: "center" }}>
                        {subj.subject}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", textAlign: "center" }}>
                        {subj.study_hours.toFixed(1)} hrs · {subj.quiz_count} Quizzes
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Study Trajectory Chart */}
            <div style={panelStyle} className="glass-panel">
              <h3 style={panelTitleStyle}>📈 Study Trajectory (Last 7 Days)</h3>
              <div style={{ display: "flex", justifyContent: "center", margin: "16px 0 8px" }}>
                <svg width={chartWidth} height={chartHeight} style={{ background: "transparent" }}>
                  {/* Grid Lines */}
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const yVal = padding + (idx * plotHeight) / 3;
                    const val = ((3 - idx) * maxHours) / 3;
                    return (
                      <g key={idx}>
                        <line
                          x1={padding}
                          y1={yVal}
                          x2={chartWidth - padding}
                          y2={yVal}
                          stroke="rgba(255, 255, 255, 0.05)"
                          strokeWidth="1"
                        />
                        <text
                          x={padding - 10}
                          y={yVal + 4}
                          textAnchor="end"
                          fill="var(--text-muted)"
                          style={{ fontSize: "9px" }}
                        >
                          {val.toFixed(1)}h
                        </text>
                      </g>
                    );
                  })}

                  {/* Polyline path */}
                  <polyline
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="3.5"
                    points={polylinePointsStr}
                    style={{ strokeLinejoin: "round", strokeLinecap: "round" }}
                  />

                  {/* Gradient Area under curve */}
                  <defs>
                    <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M ${points[0]?.x} ${chartHeight - padding} L ${polylinePointsStr} L ${points[points.length - 1]?.x} ${chartHeight - padding} Z`}
                    fill="url(#chartGrad)"
                  />

                  {/* Data Points */}
                  {points.map((p: any, idx: number) => (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="5"
                        fill="var(--bg-primary)"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                        style={{ cursor: "pointer" }}
                      />
                      {/* X Axis Labels */}
                      <text
                        x={p.x}
                        y={chartHeight - padding + 18}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        style={{ fontSize: "10px", fontWeight: 500 }}
                      >
                        {p.day}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </div>

          </div>

          {/* AI Coach Insights Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Weaknesses card */}
            <div style={{ ...panelStyle, background: "rgba(239, 68, 68, 0.03)", borderColor: "rgba(239, 68, 68, 0.15)" }} className="glass-panel">
              <h3 style={{ ...panelTitleStyle, color: "#EF4444" }}>⚠️ Identified Weaknesses</h3>
              {data?.weaknesses && data.weaknesses.length > 0 ? (
                <ul style={weaknessListStyle}>
                  {data.weaknesses.map((w) => (
                    <li key={w} style={weaknessItemStyle}>
                      <span>🔴</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>{w}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Quiz average under 70% or unassessed.</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "8px 0 0" }}>
                  🎉 No significant weaknesses identified! Keep it up.
                </p>
              )}
            </div>

            {/* AI Coach Insights */}
            <div style={panelStyle} className="glass-panel">
              <h3 style={panelTitleStyle}>🦾 AI Coach Insights</h3>
              <div style={coachBodyStyle}>
                {data?.ai_recommendations ? (
                  <div style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
                    {/* Render recommendations with clean breaks */}
                    {data.ai_recommendations.split("\n").map((line, idx) => (
                      <p key={idx} style={{ margin: "6px 0" }}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No coach insights generated yet.</p>
                )}
                {data?.model && (
                  <div style={modelBadgeStyle}>
                    Insight Engine: {data.model}
                  </div>
                )}
              </div>
            </div>

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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: "24px",
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  padding: "24px",
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#fff",
  marginBottom: "16px",
};

const masteryMetersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: "16px",
};

const masteryCardStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.04)",
  borderRadius: "12px",
  padding: "20px 12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  position: "relative",
};

const masteryPercentTextStyle: React.CSSProperties = {
  position: "absolute",
  top: "52px",
  fontSize: "15px",
  fontWeight: 700,
  color: "#fff",
};

const weaknessListStyle: React.CSSProperties = {
  listStyleType: "none",
  padding: 0,
  margin: "12px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const weaknessItemStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  background: "rgba(255, 255, 255, 0.015)",
  border: "1px solid rgba(255, 255, 255, 0.03)",
  borderRadius: "8px",
  padding: "10px 12px",
};

const coachBodyStyle: React.CSSProperties = {
  marginTop: "8px",
};

const modelBadgeStyle: React.CSSProperties = {
  marginTop: "16px",
  paddingTop: "10px",
  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
  fontSize: "10.5px",
  color: "var(--text-muted)",
};
