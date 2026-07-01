"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";

const AGENT_STEPS = [
  {
    icon: "📥",
    agent: "System Gateway",
    action: "Parsing document: max_bipartite_matching.pdf...",
    detail: "Extracted 4 pages, 1,250 words. Generating vector embeddings...",
    color: "#6366F1",
    activeNode: "root",
  },
  {
    icon: "👨‍🏫",
    agent: "Teacher Agent",
    action: "Concept extraction & explanation compiling...",
    detail: "Defined 'Augmenting Paths', 'Ford-Fulkerson connection', and 'Residual Graphs'.",
    color: "#a78bfa",
    activeNode: "matching",
  },
  {
    icon: "🕸",
    agent: "Mindmap Architect",
    action: "Synthesizing relational dependency tree...",
    detail: "Linked 'Max Bipartite Matching' -> 'Network Flow' -> 'Hungarian Method'.",
    color: "#ec4899",
    activeNode: "flow",
  },
  {
    icon: "📝",
    agent: "Quiz Master",
    action: "Compiling 5 subject-matter practice questions...",
    detail: "Generated 3 Beginner MCQs, 2 Advanced algorithm-trace questions.",
    color: "#10b981",
    activeNode: "quiz",
  },
];

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % AGENT_STEPS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={containerStyle}>
      <style>{`
        /* Futuristic Background Grid */
        .hero-grid {
          background-size: 40px 40px;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          mask-image: radial-gradient(ellipse at center, black, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at center, black, transparent 75%);
        }

        .no-underline {
          text-decoration: none !important;
        }

        .pulse-dot {
          animation: pulseGlow 2s infinite;
        }

        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }

        /* Float animation for the mockup window */
        .float-window {
          animation: floatAnim 6s ease-in-out infinite;
        }

        @keyframes floatAnim {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        /* Hover glows on cards */
        .feature-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .feature-card:hover {
          border-color: rgba(99, 102, 241, 0.25) !important;
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.08);
          transform: translateY(-2px);
        }
      `}</style>

      {/* Decorative Grid & Glow Backgrounds */}
      <div className="hero-grid" style={gridBgStyle} />
      <div style={topGlowStyle} />

      {/* Header / Navbar */}
      <header style={headerStyle}>
        <div style={logoStyle}>
          <span style={logoDotStyle}></span> EduAgent
        </div>
        <nav style={navStyle}>
          <Link href="/auth" style={navLinkStyle} className="no-underline">Sign In</Link>
          <Link href="/auth" className="glass-btn glass-btn-primary no-underline" style={{ padding: "8px 18px", fontSize: "14px", height: "auto" }}>
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main style={mainStyle}>
        <section style={heroSectionStyle} className="animate-slide-up">
          <h1 style={titleStyle}>
            Supercharge Your Learning with <span style={highlightStyle}>Cooperative AI Agents</span>
          </h1>
          <p style={subtitleStyle}>
            Upload lecture notes, slides, and textbook PDFs. Our team of specialized AI agents coordinates to analyze material, build interactive mind maps, compile adaptive practice quizzes, and design your master study plan.
          </p>
          <div style={ctaContainerStyle}>
            <Link href="/auth" style={primaryCtaStyle} className="glass-btn glass-btn-primary no-underline">
              Get Started for Free
            </Link>
          </div>
        </section>

        {/* Live Swarm Simulator Mockup */}
        <section className="float-window" style={mockupSectionStyle}>
          <div className="glass-panel" style={mockupWindowStyle}>
            {/* Window Title Bar */}
            <div style={windowHeaderStyle}>
              <div style={dotsContainerStyle}>
                <span style={{ ...dotStyle, backgroundColor: "#EF4444" }} />
                <span style={{ ...dotStyle, backgroundColor: "#F59E0B" }} />
                <span style={{ ...dotStyle, backgroundColor: "#10B981" }} />
              </div>
              <div style={windowTitleStyle}>
                <span className="pulse-dot" style={activeStatusDotStyle} />
                Cooperative Swarm Workspace: Active Simulation
              </div>
              <div style={{ width: "50px" }} />
            </div>

            {/* Mock Dashboard Layout */}
            <div style={mockDashboardGridStyle}>
              {/* Left Column: Live Agent Logs Console */}
              <div style={consolePanelStyle}>
                <div style={consoleHeaderStyle}>
                  💻 AGENT LOGS MONITOR
                </div>
                <div style={consoleBodyStyle}>
                  {AGENT_STEPS.map((step, idx) => {
                    const isPassed = idx < activeStep;
                    const isActive = idx === activeStep;
                    return (
                      <div 
                        key={idx} 
                        style={{ 
                          ...consoleLogItemStyle,
                          borderLeft: `2.5px solid ${isActive ? step.color : isPassed ? "var(--success)" : "transparent"}`,
                          opacity: isActive ? 1 : isPassed ? 0.7 : 0.35,
                          background: isActive ? "rgba(255,255,255,0.02)" : "transparent",
                          transition: "all 0.4s ease",
                        }}
                      >
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
                          <span>{step.icon}</span>
                          <span style={{ color: isActive ? step.color : "#fff", fontWeight: 700, fontSize: "12px" }}>
                            {step.agent}
                          </span>
                          {isActive && <span style={typingIndicatorStyle}>ACTIVE RUN</span>}
                          {isPassed && <span style={successIndicatorStyle}>✓ COMPLETED</span>}
                        </div>
                        <div style={{ fontSize: "12.5px", color: "var(--text-primary)", fontWeight: 500 }}>
                          {step.action}
                        </div>
                        {isActive && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.4 }}>
                            {step.detail}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Dynamic Concept Map Visualizer */}
              <div style={mapVisualizerStyle}>
                <svg width="100%" height="100%" viewBox="0 0 400 300" style={{ background: "#06090f" }}>
                  {/* Paths */}
                  <path 
                    d="M 200 150 C 200 90, 110 90, 110 90" 
                    fill="none" 
                    stroke={activeStep >= 1 ? "var(--accent)" : "rgba(255,255,255,0.05)"} 
                    strokeWidth="1.5" 
                    style={{ transition: "stroke 0.4s" }} 
                  />
                  <path 
                    d="M 200 150 C 200 90, 290 90, 290 90" 
                    fill="none" 
                    stroke={activeStep >= 2 ? "#ec4899" : "rgba(255,255,255,0.05)"} 
                    strokeWidth="1.5" 
                    style={{ transition: "stroke 0.4s" }} 
                  />
                  <path 
                    d="M 200 150 C 200 210, 200 210, 200 210" 
                    fill="none" 
                    stroke={activeStep >= 3 ? "#10b981" : "rgba(255,255,255,0.05)"} 
                    strokeWidth="1.5" 
                    style={{ transition: "stroke 0.4s" }} 
                  />

                  {/* Core Root Node */}
                  <g transform="translate(200, 150)">
                    <circle 
                      r="16" 
                      fill="var(--accent)" 
                      style={{ 
                        opacity: activeStep === 0 ? 1 : 0.8,
                        filter: activeStep === 0 ? "drop-shadow(0 0 10px var(--accent))" : "none",
                        transition: "all 0.4s"
                      }} 
                    />
                    <text textAnchor="middle" dy="4" style={{ fontSize: "11px", pointerEvents: "none" }}>🧠</text>
                  </g>

                  {/* Teacher Concept Node */}
                  <g transform="translate(110, 90)">
                    <circle 
                      r="14" 
                      fill={activeStep >= 1 ? "#a78bfa" : "#1f2937"} 
                      style={{ 
                        opacity: activeStep === 1 ? 1 : 0.7,
                        filter: activeStep === 1 ? "drop-shadow(0 0 10px #a78bfa)" : "none",
                        transition: "all 0.4s"
                      }} 
                    />
                    <text textAnchor="middle" dy="4" style={{ fontSize: "10px", pointerEvents: "none" }}>📚</text>
                    <text textAnchor="middle" y="24" fill={activeStep >= 1 ? "#fff" : "var(--text-muted)"} style={{ fontSize: "9px", fontWeight: 600 }}>Concepts</text>
                  </g>

                  {/* Mindmap Relational Node */}
                  <g transform="translate(290, 90)">
                    <circle 
                      r="14" 
                      fill={activeStep >= 2 ? "#ec4899" : "#1f2937"} 
                      style={{ 
                        opacity: activeStep === 2 ? 1 : 0.7,
                        filter: activeStep === 2 ? "drop-shadow(0 0 10px #ec4899)" : "none",
                        transition: "all 0.4s"
                      }} 
                    />
                    <text textAnchor="middle" dy="4" style={{ fontSize: "10px", pointerEvents: "none" }}>🕸</text>
                    <text textAnchor="middle" y="24" fill={activeStep >= 2 ? "#fff" : "var(--text-muted)"} style={{ fontSize: "9px", fontWeight: 600 }}>Mind Map</text>
                  </g>

                  {/* Quiz Node */}
                  <g transform="translate(200, 210)">
                    <circle 
                      r="14" 
                      fill={activeStep >= 3 ? "#10b981" : "#1f2937"} 
                      style={{ 
                        opacity: activeStep === 3 ? 1 : 0.7,
                        filter: activeStep === 3 ? "drop-shadow(0 0 10px #10b981)" : "none",
                        transition: "all 0.4s"
                      }} 
                    />
                    <text textAnchor="middle" dy="4" style={{ fontSize: "10px", pointerEvents: "none" }}>📝</text>
                    <text textAnchor="middle" y="24" fill={activeStep >= 3 ? "#fff" : "var(--text-muted)"} style={{ fontSize: "9px", fontWeight: 600 }}>Quizzes</text>
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" style={featuresSectionStyle} className="animate-fade-in">
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Specialized Intelligence at Your Service</h2>
            <p style={sectionSubStyle}>Four autonomous AI agents coordinating to optimize your academic performance.</p>
          </div>
          
          <div style={gridStyle}>
            <div style={cardStyle} className="glass-panel feature-card">
              <div style={cardIconStyle("var(--accent)")}>👨‍🏫</div>
              <h3 style={cardTitleStyle}>Teacher Agent</h3>
              <p style={cardDescStyle}>
                Breaks down dense academic textbooks into structured concepts, real-world examples, and concise summaries.
              </p>
            </div>
            
            <div style={cardStyle} className="glass-panel feature-card">
              <div style={cardIconStyle("#EC4899")}>💬</div>
              <h3 style={cardTitleStyle}>Doubt Solver</h3>
              <p style={cardDescStyle}>
                Retrieves references from your knowledge base to answer follow-up queries with exact source citations.
              </p>
            </div>
            
            <div style={cardStyle} className="glass-panel feature-card">
              <div style={cardIconStyle("var(--success)")}>📝</div>
              <h3 style={cardTitleStyle}>Quiz Generator</h3>
              <p style={cardDescStyle}>
                Builds customized multiple-choice and subjective quizzes, adapting difficulty based on your history.
              </p>
            </div>
            
            <div style={cardStyle} className="glass-panel feature-card">
              <div style={cardIconStyle("#F59E0B")}>📅</div>
              <h3 style={cardTitleStyle}>Study Planner</h3>
              <p style={cardDescStyle}>
                Organizes a day-by-day study syllabus, tracking weak topics and mapping milestones to your exam date.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={footerStyle}>
        <p style={footerTextStyle}>© {new Date().getFullYear()} EduAgent. Premium Multi-Agent Learning Suite.</p>
      </footer>
    </div>
  );
}

// Styles
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "var(--bg-primary)",
  position: "relative",
  overflow: "hidden",
};

const gridBgStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "700px",
  pointerEvents: "none",
  zIndex: 0,
};

const topGlowStyle: React.CSSProperties = {
  position: "absolute",
  width: "600px",
  height: "400px",
  background: "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99, 102, 241, 0) 70%)",
  top: "-150px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 0,
  pointerEvents: "none",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "24px 8%",
  position: "relative",
  zIndex: 10,
};

const logoStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  letterSpacing: "-0.5px",
};

const logoDotStyle: React.CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  backgroundColor: "var(--accent)",
  boxShadow: "0 0 10px var(--accent)",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "24px",
};

const navLinkStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "14px",
  fontWeight: 500,
  transition: "color var(--transition-smooth)",
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "0 8%",
};

const heroSectionStyle: React.CSSProperties = {
  textAlign: "center",
  maxWidth: "800px",
  marginTop: "70px",
  marginBottom: "50px",
  position: "relative",
  zIndex: 1,
};

const titleStyle: React.CSSProperties = {
  fontSize: "56px",
  fontWeight: 800,
  lineHeight: 1.15,
  letterSpacing: "-1.5px",
  marginBottom: "24px",
};

const highlightStyle: React.CSSProperties = {
  color: "var(--accent)",
  textShadow: "0 0 20px rgba(99, 102, 241, 0.2)",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "18px",
  color: "var(--text-secondary)",
  lineHeight: 1.6,
  marginBottom: "36px",
};

const ctaContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "16px",
};

const primaryCtaStyle: React.CSSProperties = {
  boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
};

/* Mockup Window Styling */
const mockupSectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "960px",
  marginBottom: "110px",
  zIndex: 2,
};

const mockupWindowStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "16px",
  overflow: "hidden",
  background: "rgba(10, 15, 30, 0.6)",
  border: "1px solid var(--border-glass)",
  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
};

const windowHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 20px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  background: "rgba(255, 255, 255, 0.02)",
};

const dotsContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
};

const dotStyle: React.CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
};

const windowTitleStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-secondary)",
  fontWeight: 600,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const activeStatusDotStyle: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  backgroundColor: "#10B981",
  boxShadow: "0 0 8px #10B981",
};

const mockDashboardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  height: "300px",
  background: "#06090f",
};

const consolePanelStyle: React.CSSProperties = {
  borderRight: "1px solid rgba(255, 255, 255, 0.05)",
  display: "flex",
  flexDirection: "column",
  height: "100%",
};

const consoleHeaderStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "10px",
  fontWeight: 700,
  color: "var(--text-muted)",
  letterSpacing: "1px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
};

const consoleBodyStyle: React.CSSProperties = {
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  overflowY: "hidden",
  flex: 1,
};

const consoleBodyItemWrapperStyle = (isActive: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: "6px",
  transition: "all 0.4s ease",
});

const consoleLogItemStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "6px",
};

const typingIndicatorStyle: React.CSSProperties = {
  fontSize: "9px",
  background: "rgba(99, 102, 241, 0.15)",
  color: "var(--accent)",
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: "4px",
  marginLeft: "auto",
};

const successIndicatorStyle: React.CSSProperties = {
  fontSize: "9px",
  background: "rgba(16, 185, 129, 0.15)",
  color: "#10B981",
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: "4px",
  marginLeft: "auto",
};

const mapVisualizerStyle: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#06090f",
};

const featuresSectionStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1100px",
  marginBottom: "100px",
};

const sectionHeaderStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "60px",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 700,
  marginBottom: "12px",
  letterSpacing: "-0.5px",
};

const sectionSubStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: "16px",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "24px",
  width: "100%",
};

const cardStyle: React.CSSProperties = {
  padding: "32px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  textAlign: "left",
};

const cardIconStyle = (color: string): React.CSSProperties => ({
  fontSize: "28px",
  padding: "12px",
  borderRadius: "10px",
  background: `rgba(${color === 'var(--accent)' ? '99,102,241' : color === '#EC4899' ? '236,72,153' : color === 'var(--success)' ? '16,185,129' : '245,158,11'}, 0.1)`,
  border: `1px solid rgba(${color === 'var(--accent)' ? '99,102,241' : color === '#EC4899' ? '236,72,153' : color === 'var(--success)' ? '16,185,129' : '245,158,11'}, 0.15)`,
  marginBottom: "20px",
});

const cardTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  marginBottom: "12px",
};

const cardDescStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text-secondary)",
  lineHeight: 1.5,
};

const footerStyle: React.CSSProperties = {
  padding: "40px 8%",
  borderTop: "1px solid var(--border-glass)",
  textAlign: "center",
  backgroundColor: "rgba(13, 17, 23, 0.3)",
};

const footerTextStyle: React.CSSProperties = {
  color: "var(--text-muted)",
  fontSize: "13px",
};
