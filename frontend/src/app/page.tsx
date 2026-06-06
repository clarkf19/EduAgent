import Link from "next/link";
import React from "react";

export default function Home() {
  return (
    <div style={containerStyle}>
      {/* Header / Navbar */}
      <header style={headerStyle}>
        <div style={logoStyle}>
          <span style={logoDotStyle}></span> EduAgent
        </div>
        <nav style={navStyle}>
          <Link href="/auth" style={navLinkStyle}>Sign In</Link>
          <Link href="/auth" style={navBtnStyle}>Get Started</Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main style={mainStyle}>
        <section style={heroSectionStyle} className="animate-slide-up">
          <div style={glowBgStyle}></div>
          <h1 style={titleStyle}>
            Supercharge Your Learning with <span style={highlightStyle}>Cooperative AI Agents</span>
          </h1>
          <p style={subtitleStyle}>
            Upload your lecture slides, notes, and textbook PDFs. Our swarm of specialized AI agents works in harmony to explain concepts, solve doubts, generate adaptive quizzes, and construct personalized study plans.
          </p>
          <div style={ctaContainerStyle}>
            <Link href="/auth" style={primaryCtaStyle} className="glass-btn glass-btn-primary">
              Initialize Assistant
            </Link>
            <a href="#features" style={secondaryCtaStyle} className="glass-btn glass-btn-secondary">
              Meet the Swarm
            </a>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" style={featuresSectionStyle} className="animate-fade-in">
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Specialized Intelligence at Your Service</h2>
            <p style={sectionSubStyle}>Four autonomous AI agents coordinating to optimize your academic performance.</p>
          </div>
          
          <div style={gridStyle}>
            <div style={cardStyle} className="glass-panel">
              <div style={cardIconStyle("var(--accent)")}>👨‍🏫</div>
              <h3 style={cardTitleStyle}>Teacher Agent</h3>
              <p style={cardDescStyle}>
                Breaks down dense academic textbooks into structured concepts, real-world examples, and concise summaries.
              </p>
            </div>
            
            <div style={cardStyle} className="glass-panel">
              <div style={cardIconStyle("#EC4899")}>💬</div>
              <h3 style={cardTitleStyle}>Doubt Solver</h3>
              <p style={cardDescStyle}>
                Retrieves references from your knowledge base to answer follow-up queries with exact source citations.
              </p>
            </div>
            
            <div style={cardStyle} className="glass-panel">
              <div style={cardIconStyle("var(--success)")}>📝</div>
              <h3 style={cardTitleStyle}>Quiz Generator</h3>
              <p style={cardDescStyle}>
                Builds customized multiple-choice and subjective quizzes, adapting difficulty based on your history.
              </p>
            </div>
            
            <div style={cardStyle} className="glass-panel">
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

// Inline Styles to avoid package bloat, combined with global CSS tokens
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "var(--bg-primary)",
  position: "relative",
  overflow: "hidden",
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

const navBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "var(--border-radius)",
  backgroundColor: "rgba(255, 255, 255, 0.03)",
  border: "1px solid var(--border-glass)",
  fontSize: "14px",
  fontWeight: 600,
  transition: "all var(--transition-smooth)",
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
  marginTop: "80px",
  marginBottom: "120px",
  position: "relative",
  zIndex: 1,
};

const glowBgStyle: React.CSSProperties = {
  position: "absolute",
  width: "350px",
  height: "350px",
  background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0) 70%)",
  top: "-100px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: -1,
  pointerEvents: "none",
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
  marginBottom: "40px",
};

const ctaContainerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: "16px",
};

const primaryCtaStyle: React.CSSProperties = {
  boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
};

const secondaryCtaStyle: React.CSSProperties = {
  border: "1px solid var(--border-glass)",
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
