"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Hook to check screen width dynamically
function useWindowWidth() {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return width;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AuthPage() {
  const router = useRouter();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth > 0 && windowWidth < 900;

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleQuickFill = () => {
    setEmail("verify@test.com");
    setPassword("Test1234!");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        // Login API Call
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Authentication failed");
        }

        // Store token in localStorage
        localStorage.setItem("token", data.access_token);
        
        // Setup simple cookie for middleware/session checks
        document.cookie = `token=${data.access_token}; path=/; max-age=7200; SameSite=Lax`;

        // Redirect to dashboard
        router.push("/dashboard");
      } else {
        // Register API Call
        const response = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Registration failed");
        }

        // After successful registration, auto-login
        const loginFormData = new URLSearchParams();
        loginFormData.append("username", email);
        loginFormData.append("password", password);

        const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: loginFormData.toString(),
        });

        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
          setIsLogin(true);
          setLoading(false);
          return;
        }

        localStorage.setItem("token", loginData.access_token);
        document.cookie = `token=${loginData.access_token}; path=/; max-age=7200; SameSite=Lax`;
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      {/* LEFT SIDE: Features Showcase Hero (Hidden on Mobile) */}
      {!isMobile && (
        <div style={leftHeroStyle}>
          {/* Subtle Grid and Glow backgrounds */}
          <div style={gridPatternStyle} />
          <div style={radialGlowStyle} />

          <div style={heroContentStyle}>
            {/* Top Logo */}
            <div style={heroLogoWrapperStyle}>
              <Link href="/" style={logoStyle}>
                <span style={logoDotStyle}></span> EduAgent
              </Link>
            </div>

            <div style={heroTextWrapperStyle}>
              <h1 style={heroTitleStyle}>
                Empower Your Study Workflow with <span style={highlightTextStyle}>AI Swarms</span>
              </h1>
              <p style={heroSubtitleStyle}>
                EduAgent coordinates specialized artificial intelligence agents to analyze notes, generate targeted computations, and guide your academic progress.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div style={featureCardsContainerStyle}>
              <div style={featureCardStyle}>
                <span style={featureIconStyle}>🤖</span>
                <div>
                  <h4 style={featureTitleStyle}>Collaborative Multi-Agent Brain</h4>
                  <p style={featureDescStyle}>Explainer, Quiz, and Planner agents work together to break down complex syllabi.</p>
                </div>
              </div>

              <div style={featureCardStyle}>
                <span style={featureIconStyle}>📈</span>
                <div>
                  <h4 style={featureTitleStyle}>ML Performance Forecasting</h4>
                  <p style={featureDescStyle}>A Random Forest telemetry model predicts your grade and details target weaknesses.</p>
                </div>
              </div>

              <div style={featureCardStyle}>
                <span style={featureIconStyle}>📁</span>
                <div>
                  <h4 style={featureTitleStyle}>Direct PDF RAG Workspace</h4>
                  <p style={featureDescStyle}>Upload course slides and papers to ground the AI swarm directly in your notes.</p>
                </div>
              </div>
            </div>

            {/* Mini visual element mimicking dashboard stats */}
            <div style={dashboardTeaserStyle} className="glass-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>TELEMETRY STATUS</span>
                <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>● ALL SYSTEMS ACTIVE</span>
              </div>
              <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
                <div>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0 }}>88.4%</p>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>Expected Score</p>
                </div>
                <div style={{ borderLeft: "1px solid var(--border-glass)", paddingLeft: "16px" }}>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent)", margin: 0 }}>4.5 hrs</p>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>Weekly Study</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT SIDE: Authentication Form */}
      <div style={rightFormStyle(isMobile)}>
        {/* Background glow for mobile */}
        {isMobile && <div style={glowRightStyle}></div>}

        {/* Small top logo for mobile only */}
        {isMobile && (
          <div style={mobileLogoWrapperStyle}>
            <Link href="/" style={logoStyle}>
              <span style={logoDotStyle}></span> EduAgent
            </Link>
          </div>
        )}

        <div style={cardWrapperStyle} className="glass-panel animate-slide-up">
          <h2 style={formTitleStyle}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
          <p style={formSubtitleStyle}>
            {isLogin
              ? "Access your dashboard to interact with your agents"
              : "Register to initialize your personalized workspace"}
          </p>

          {/* DEMO ACCOUNT PRE-FILL BADGE */}
          <div 
            onClick={handleQuickFill}
            style={demoBadgeStyle}
            title="Click to instantly auto-fill with credentials"
          >
            <span style={{ marginRight: "6px" }}>⚡</span>
            <span><strong>Quick Demo Account:</strong> Click to auto-fill details</span>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                placeholder="name@university.edu"
                className="glass-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={inputStyle}
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="glass-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              className="glass-btn glass-btn-primary"
              style={submitBtnStyle}
              disabled={loading}
            >
              {loading ? "Initializing Workspace..." : isLogin ? "Sign In & Access Swarm" : "Create Account"}
            </button>
          </form>

          <div style={toggleContainerStyle}>
            <p style={toggleTextStyle}>
              {isLogin ? "New to EduAgent?" : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                style={toggleBtnStyle}
              >
                {isLogin ? "Sign Up Free" : "Sign In Here"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  width: "100vw",
  backgroundColor: "var(--bg-primary)",
  position: "relative",
  overflow: "hidden",
};

// Left Hero Section
const leftHeroStyle: React.CSSProperties = {
  flex: 1.1,
  backgroundColor: "#080c16",
  borderRight: "1px solid var(--border-glass)",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "80px 60px",
};

const gridPatternStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: `
    linear-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px)
  `,
  backgroundSize: "40px 40px",
  maskImage: "radial-gradient(circle at center, black 40%, transparent 90%)",
  pointerEvents: "none",
};

const radialGlowStyle: React.CSSProperties = {
  position: "absolute",
  width: "500px",
  height: "500px",
  background: "radial-gradient(circle, rgba(99, 102, 241, 0.07) 0%, rgba(0, 0, 0, 0) 70%)",
  top: "20%",
  left: "20%",
  pointerEvents: "none",
};

const heroContentStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  gap: "40px",
  maxWidth: "580px",
  margin: "0 auto",
};

const heroLogoWrapperStyle: React.CSSProperties = {
  marginBottom: "10px",
};

const logoStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  letterSpacing: "-0.5px",
  color: "#ffffff",
  textDecoration: "none",
};

const logoDotStyle: React.CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  backgroundColor: "var(--accent)",
  boxShadow: "0 0 10px var(--accent)",
};

const heroTextWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const heroTitleStyle: React.CSSProperties = {
  fontSize: "40px",
  fontWeight: 800,
  lineHeight: 1.15,
  color: "#ffffff",
  letterSpacing: "-1px",
};

const highlightTextStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--accent), #EC4899)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const heroSubtitleStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "var(--text-secondary)",
  lineHeight: 1.6,
};

const featureCardsContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const featureCardStyle: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  padding: "16px",
  borderRadius: "12px",
  backgroundColor: "rgba(255, 255, 255, 0.015)",
  border: "1px solid rgba(255, 255, 255, 0.03)",
};

const featureIconStyle: React.CSSProperties = {
  fontSize: "20px",
  height: "40px",
  width: "40px",
  borderRadius: "8px",
  backgroundColor: "rgba(99, 102, 241, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const featureTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#ffffff",
  margin: "0 0 4px 0",
};

const featureDescStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-secondary)",
  margin: 0,
  lineHeight: 1.4,
};

const dashboardTeaserStyle: React.CSSProperties = {
  padding: "20px",
  backgroundColor: "rgba(13, 17, 23, 0.5)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  borderRadius: "12px",
  marginTop: "10px",
};

// Right Form Section
const rightFormStyle = (isMobile: boolean): React.CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 24px",
  position: "relative",
  backgroundColor: isMobile ? "var(--bg-primary)" : "transparent",
});

const mobileLogoWrapperStyle: React.CSSProperties = {
  position: "absolute",
  top: "40px",
  left: "24px",
};

const glowRightStyle: React.CSSProperties = {
  position: "absolute",
  width: "350px",
  height: "350px",
  background: "radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, rgba(0, 0, 0, 0) 70%)",
  bottom: "-10%",
  right: "-10%",
  pointerEvents: "none",
};

const cardWrapperStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "400px",
  padding: "40px 32px",
  backgroundColor: "rgba(13, 17, 23, 0.45)",
  backdropFilter: "blur(24px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  zIndex: 2,
  transition: "border-color 0.3s ease",
};

const formTitleStyle: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 700,
  marginBottom: "8px",
  textAlign: "center",
  letterSpacing: "-0.5px",
  color: "#ffffff",
};

const formSubtitleStyle: React.CSSProperties = {
  fontSize: "13.5px",
  color: "var(--text-secondary)",
  marginBottom: "20px",
  textAlign: "center",
  lineHeight: 1.5,
};

// Pre-fill demo access badge
const demoBadgeStyle: React.CSSProperties = {
  backgroundColor: "rgba(99, 102, 241, 0.08)",
  border: "1px dashed rgba(99, 102, 241, 0.35)",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "12px",
  color: "#a5b4fc",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "24px",
  transition: "all 0.2s ease",
};

const errorStyle: React.CSSProperties = {
  backgroundColor: "rgba(239, 68, 68, 0.08)",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  color: "#f87171",
  padding: "12px",
  borderRadius: "8px",
  fontSize: "13px",
  marginBottom: "20px",
  textAlign: "center",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12.5px",
  fontWeight: 600,
  color: "var(--text-secondary)",
};

const inputStyle: React.CSSProperties = {
  transition: "border-color var(--transition-smooth), box-shadow var(--transition-smooth)",
  backgroundColor: "rgba(0, 0, 0, 0.2)",
};

const submitBtnStyle: React.CSSProperties = {
  marginTop: "10px",
  width: "100%",
  height: "46px",
  background: "linear-gradient(135deg, var(--accent), #5356e3)",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const toggleContainerStyle: React.CSSProperties = {
  marginTop: "24px",
  textAlign: "center",
};

const toggleTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--text-secondary)",
};

const toggleBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  fontFamily: "inherit",
  marginLeft: "4px",
  textDecoration: "underline",
};
