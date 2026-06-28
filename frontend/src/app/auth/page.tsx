"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type AuthView = "login" | "register" | "forgot" | "reset";

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "var(--bg-primary)" }} />}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth > 0 && windowWidth < 900;

  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Registration extra fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [role, setRole] = useState("");

  // Reset password
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Check if URL has a reset token
  useEffect(() => {
    const token = searchParams?.get("token");
    if (token) {
      setResetToken(token);
      setView("reset");
    }
  }, [searchParams]);

  const handleQuickFill = () => {
    setEmail("verify@test.com");
    setPassword("Test1234!");
    setError("");
    setView("login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (view === "login") {
        const formData = new URLSearchParams();
        formData.append("username", email);
        formData.append("password", password);

        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Authentication failed");

        localStorage.setItem("token", data.access_token);
        document.cookie = `token=${data.access_token}; path=/; max-age=7200; SameSite=Lax`;
        router.push("/dashboard");

      } else if (view === "register") {
        if (!name.trim()) { setError("Please enter your full name."); setLoading(false); return; }
        if (!role) { setError("Please select your student type."); setLoading(false); return; }

        const response = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: name.trim(),
            age: age ? parseInt(age) : null,
            role,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Registration failed");

        // Auto-login after register
        const loginFormData = new URLSearchParams();
        loginFormData.append("username", email);
        loginFormData.append("password", password);

        const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: loginFormData.toString(),
        });

        const loginData = await loginResponse.json();
        if (!loginResponse.ok) { setView("login"); setLoading(false); return; }

        localStorage.setItem("token", loginData.access_token);
        document.cookie = `token=${loginData.access_token}; path=/; max-age=7200; SameSite=Lax`;
        router.push("/dashboard");

      } else if (view === "forgot") {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        await response.json();
        setSuccessMsg("If that email is registered, a password reset link has been sent to your inbox. Please check your email (including spam/junk folder).");
        setEmail("");

      } else if (view === "reset") {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, new_password: newPassword }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Reset failed");
        setSuccessMsg("Password updated! You can now sign in.");
        setTimeout(() => { setView("login"); setSuccessMsg(""); }, 3000);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const switchView = (v: AuthView) => {
    setView(v);
    setError("");
    setSuccessMsg("");
    setEmail("");
    setPassword("");
  };

  return (
    <div style={containerStyle}>
      {/* LEFT SIDE: Features Showcase */}
      {!isMobile && (
        <div style={leftHeroStyle}>
          <div style={gridPatternStyle} />
          <div style={radialGlowStyle} />

          <div style={heroContentStyle}>
            <div style={heroLogoWrapperStyle}>
              <Link href="/" style={logoStyle}>
                <span style={logoDotStyle}></span> EduAgent
              </Link>
            </div>

            <div style={heroTextWrapperStyle}>
              <h1 style={heroTitleStyle}>
                Empower Your Study Workflow with <span style={highlightTextStyle}>AI Agents</span>
              </h1>
              <p style={heroSubtitleStyle}>
                EduAgent coordinates specialized artificial intelligence agents to analyze notes, generate targeted computations, and guide your academic progress.
              </p>
            </div>

            {/* Feature Cards */}
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
                  <p style={featureDescStyle}>Upload course slides and papers to ground the AI agents directly in your notes.</p>
                </div>
              </div>
            </div>

            <div style={dashboardTeaserStyle} className="glass-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>TELEMETRY STATUS</span>
                <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>● ALL SYSTEMS ACTIVE</span>
              </div>
              <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>AGENTS</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>3</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>ML MODEL</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>RF</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>UPTIME</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--success)" }}>99.9%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT SIDE: Auth Forms */}
      <div style={rightFormStyle(isMobile)}>
        {isMobile && <div style={glowRightStyle}></div>}

        {isMobile && (
          <div style={mobileLogoWrapperStyle}>
            <Link href="/" style={logoStyle}>
              <span style={logoDotStyle}></span> EduAgent
            </Link>
          </div>
        )}

        <div style={cardWrapperStyle} className="glass-panel animate-slide-up">

          {/* ── Login Form ── */}
          {view === "login" && (
            <>
              <h2 style={formTitleStyle}>Welcome Back</h2>
              <p style={formSubtitleStyle}>Access your dashboard to interact with your agents</p>

              <div onClick={handleQuickFill} style={demoBadgeStyle} title="Click to instantly auto-fill">
                <span style={{ marginRight: "6px" }}>⚡</span>
                <span><strong>Quick Demo Account:</strong> Click to auto-fill details</span>
              </div>

              {error && <div style={errorStyle}>{error}</div>}
              {successMsg && <div style={successStyle}>{successMsg}</div>}

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
                  <div style={passwordWrapStyle}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="glass-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading}
                      style={{ ...inputStyle, paddingRight: "48px", width: "100%", boxSizing: "border-box" }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtnStyle} tabIndex={-1}>
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchView("forgot")}
                    style={forgotLinkStyle}
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" className="glass-btn glass-btn-primary" style={submitBtnStyle} disabled={loading}>
                  {loading ? "Signing In…" : "Sign In & Access Workspace"}
                </button>
              </form>

              <div style={toggleContainerStyle}>
                <p style={toggleTextStyle}>
                  New to EduAgent?{" "}
                  <button onClick={() => switchView("register")} style={toggleBtnStyle}>
                    Sign Up Free
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ── Register Form ── */}
          {view === "register" && (
            <>
              <h2 style={formTitleStyle}>Create Account</h2>
              <p style={formSubtitleStyle}>Register to initialize your personalized workspace</p>

              {error && <div style={errorStyle}>{error}</div>}

              <form onSubmit={handleSubmit} style={formStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Your full name"
                    className="glass-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ ...inputGroupStyle, flex: 1 }}>
                    <label style={labelStyle}>Age</label>
                    <input
                      type="number"
                      placeholder="Age"
                      className="glass-input"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      min={10}
                      max={100}
                      disabled={loading}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={inputGroupStyle}>
                  <label style={labelStyle}>I am a</label>
                  <div style={roleGroupStyle}>
                    {[
                      { value: "school student", label: "🏫 School Student" },
                      { value: "college student", label: "🎓 College Student" },
                      { value: "professional", label: "💼 Professional" },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRole(value)}
                        style={{
                          ...roleOptionStyle,
                          ...(role === value ? roleOptionActiveStyle : {}),
                        }}
                        disabled={loading}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

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
                  <div style={passwordWrapStyle}>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      className="glass-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading}
                      style={{ ...inputStyle, paddingRight: "48px", width: "100%", boxSizing: "border-box" }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeBtnStyle} tabIndex={-1}>
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <button type="submit" className="glass-btn glass-btn-primary" style={submitBtnStyle} disabled={loading}>
                  {loading ? "Creating Account…" : "Create Account"}
                </button>
              </form>

              <div style={toggleContainerStyle}>
                <p style={toggleTextStyle}>
                  Already have an account?{" "}
                  <button onClick={() => switchView("login")} style={toggleBtnStyle}>
                    Sign In Here
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ── Forgot Password Form ── */}
          {view === "forgot" && (
            <>
              <h2 style={formTitleStyle}>Forgot Password?</h2>
              <p style={formSubtitleStyle}>Enter your email and we'll send you a reset link</p>

              {error && <div style={errorStyle}>{error}</div>}
              {successMsg && <div style={successStyle}>{successMsg}</div>}

              {!successMsg && (
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

                  <button type="submit" className="glass-btn glass-btn-primary" style={submitBtnStyle} disabled={loading}>
                    {loading ? "Sending…" : "Send Reset Link"}
                  </button>
                </form>
              )}

              <div style={toggleContainerStyle}>
                <p style={toggleTextStyle}>
                  Remember your password?{" "}
                  <button onClick={() => switchView("login")} style={toggleBtnStyle}>
                    Back to Sign In
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ── Reset Password Form ── */}
          {view === "reset" && (
            <>
              <h2 style={formTitleStyle}>Reset Password</h2>
              <p style={formSubtitleStyle}>Enter your new password below</p>

              {error && <div style={errorStyle}>{error}</div>}
              {successMsg && <div style={successStyle}>{successMsg}</div>}

              {!successMsg && (
                <form onSubmit={handleSubmit} style={formStyle}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>New Password</label>
                    <div style={passwordWrapStyle}>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        className="glass-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={loading}
                        style={{ ...inputStyle, paddingRight: "48px", width: "100%", boxSizing: "border-box" }}
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={eyeBtnStyle} tabIndex={-1}>
                        {showNewPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="glass-btn glass-btn-primary" style={submitBtnStyle} disabled={loading}>
                    {loading ? "Updating…" : "Update Password"}
                  </button>
                </form>
              )}

              <div style={toggleContainerStyle}>
                <p style={toggleTextStyle}>
                  <button onClick={() => switchView("login")} style={toggleBtnStyle}>
                    Back to Sign In
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  width: "100vw",
  backgroundColor: "var(--bg-primary)",
  position: "relative",
  overflow: "hidden",
};

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

const heroLogoWrapperStyle: React.CSSProperties = { marginBottom: "10px" };

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

const rightFormStyle = (isMobile: boolean): React.CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 24px",
  position: "relative",
  backgroundColor: isMobile ? "var(--bg-primary)" : "transparent",
  overflowY: "auto",
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
  maxWidth: "420px",
  padding: "40px 32px",
  backgroundColor: "rgba(13, 17, 23, 0.45)",
  backdropFilter: "blur(24px)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  zIndex: 2,
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

const successStyle: React.CSSProperties = {
  backgroundColor: "rgba(16, 185, 129, 0.08)",
  border: "1px solid rgba(16, 185, 129, 0.25)",
  color: "#34d399",
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

const passwordWrapStyle: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const eyeBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: "12px",
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: "16px",
  color: "var(--text-secondary)",
  padding: "0",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  zIndex: 2,
};

const forgotLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  fontSize: "12px",
  cursor: "pointer",
  textAlign: "right",
  padding: 0,
  fontFamily: "inherit",
  alignSelf: "flex-end",
};

const roleGroupStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const roleOptionStyle: React.CSSProperties = {
  flex: 1,
  minWidth: "100px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "rgba(255,255,255,0.03)",
  color: "var(--text-secondary)",
  fontSize: "12px",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all 0.2s ease",
  textAlign: "center",
};

const roleOptionActiveStyle: React.CSSProperties = {
  border: "1px solid var(--accent)",
  backgroundColor: "rgba(99, 102, 241, 0.12)",
  color: "#a5b4fc",
  fontWeight: 600,
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
