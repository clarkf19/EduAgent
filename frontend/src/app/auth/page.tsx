"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

        const response = await fetch("http://localhost:8000/api/auth/login", {
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
        const response = await fetch("http://localhost:8000/api/auth/register", {
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

        const loginResponse = await fetch("http://localhost:8000/api/auth/login", {
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
      {/* Background Glows */}
      <div style={glowLeftStyle}></div>
      <div style={glowRightStyle}></div>

      {/* Header Logo */}
      <div style={logoWrapperStyle}>
        <Link href="/" style={logoStyle}>
          <span style={logoDotStyle}></span> EduAgent
        </Link>
      </div>

      {/* Form Card */}
      <div style={cardWrapperStyle} className="glass-panel animate-slide-up">
        <h2 style={titleStyle}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
        <p style={subtitleStyle}>
          {isLogin
            ? "Enter your credentials to access your agents"
            : "Sign up to begin collaborative learning"}
        </p>

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
            />
          </div>

          <button
            type="submit"
            className="glass-btn glass-btn-primary"
            style={btnStyle}
            disabled={loading}
          >
            {loading ? "Processing..." : isLogin ? "Access Dashboard" : "Create Account"}
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
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// Inline styling supporting dark-theme design
const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  width: "100%",
  backgroundColor: "var(--bg-primary)",
  position: "relative",
  padding: "20px",
  overflow: "hidden",
};

const logoWrapperStyle: React.CSSProperties = {
  position: "absolute",
  top: "40px",
};

const logoStyle: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  letterSpacing: "-0.5px",
  color: "var(--text-primary)",
  textDecoration: "none",
};

const logoDotStyle: React.CSSProperties = {
  width: "12px",
  height: "12px",
  borderRadius: "50%",
  backgroundColor: "var(--accent)",
  boxShadow: "0 0 10px var(--accent)",
};

const glowLeftStyle: React.CSSProperties = {
  position: "absolute",
  width: "400px",
  height: "400px",
  background: "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(99, 102, 241, 0) 70%)",
  top: "10%",
  left: "-10%",
  zIndex: 0,
  pointerEvents: "none",
};

const glowRightStyle: React.CSSProperties = {
  position: "absolute",
  width: "450px",
  height: "450px",
  background: "radial-gradient(circle, rgba(236, 72, 153, 0.05) 0%, rgba(236, 72, 153, 0) 70%)",
  bottom: "10%",
  right: "-10%",
  zIndex: 0,
  pointerEvents: "none",
};

const cardWrapperStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  padding: "40px 32px",
  zIndex: 1,
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
  marginBottom: "8px",
  textAlign: "center",
  letterSpacing: "-0.5px",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "var(--text-secondary)",
  marginBottom: "32px",
  textAlign: "center",
};

const errorStyle: React.CSSProperties = {
  backgroundColor: "rgba(239, 68, 68, 0.1)",
  border: "1px solid var(--danger)",
  color: "#EF4444",
  padding: "12px",
  borderRadius: "var(--border-radius)",
  fontSize: "13px",
  marginBottom: "24px",
  textAlign: "center",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const inputGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--text-secondary)",
};

const btnStyle: React.CSSProperties = {
  marginTop: "12px",
  width: "100%",
  height: "46px",
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
};
