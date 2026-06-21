"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface UserInfo {
  email: string;
}

// Custom hook for responsive sidebar behaviour
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth > 0 && windowWidth < 768;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [selectedSubject, setSelectedSubject] = useState("All Subjects");
  const [searchQuery, setSearchQuery] = useState("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [groqKey, setgroqKey] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Pomodoro / Study Session Tracker ────────────────────────────────────────
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionTopic, setSessionTopic] = useState("");
  const [sessionSubject, setSessionSubject] = useState("General Study");
  const [sessionElapsed, setSessionElapsed] = useState(0); // seconds
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [sessionStopped, setSessionStopped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-stop timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startStudySession = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/sessions/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topic_id: null }),
      });
      if (res.ok) {
        setSessionActive(true);
        setSessionStopped(false);
        setSessionElapsed(0);
        timerRef.current = setInterval(() => setSessionElapsed(prev => prev + 1), 1000);
      }
    } catch (e) { console.error("Failed to start session", e); }
  };

  const stopStudySession = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_BASE}/api/sessions/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessionActive(false);
      setSessionStopped(true);
    } catch (e) { console.error("Failed to stop session", e); }
  };

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "-0")}`;
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await fetch(`${API_BASE}/api/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      }
    } catch (e) {
      console.error("Failed to fetch analytics for heatmap", e);
    }
  };

  useEffect(() => {
    if (profileOpen) {
      fetchAnalytics();
    }
  }, [profileOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [profileOpen]);

  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedKey = localStorage.getItem("groq_api_key") || "";
      setgroqKey(storedKey);
    }
  }, []);

  const handleSaveKey = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("groq_api_key", groqKey.trim());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleClearKey = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("groq_api_key");
      setgroqKey("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  // Auto-collapse on mobile when switching pages
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [pathname, isMobile]);

  // Auto-collapse sidebar when window becomes narrow
  useEffect(() => {
    if (isMobile && !collapsed) setCollapsed(true);
    if (!isMobile && windowWidth >= 1024 && collapsed) setCollapsed(false);
  }, [isMobile, windowWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          localStorage.removeItem("token");
          router.push("/auth");
        }
      } catch {
        setUser({ email: "student@university.edu" });
      }
    };

    fetchProfile();
  }, [router]);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem("token");
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push("/");
  }, [router]);

  const menuItems = [
    { label: "Dashboard", icon: "📊", path: "/dashboard" },
    { label: "AI Tutor Chat", icon: "💬", path: "/dashboard/chat" },
    { label: "Practice Quizzes", icon: "📝", path: "/dashboard/quiz" },
    { label: "Study Planner", icon: "📅", path: "/dashboard/planner" },
  ];

  if (!user) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle}></div>
        <p style={{ marginTop: "16px", color: "var(--text-secondary)" }}>Configuring Swarm Workspace...</p>
      </div>
    );
  }

  // On mobile: sidebar is an overlay that slides in
  const sidebarVisible = isMobile ? mobileOpen : true;
  const effectiveCollapsed = isMobile ? false : collapsed;

  return (
    <div style={containerStyle}>
      {/* Mobile overlay backdrop */}
      {isMobile && mobileOpen && (
        <div
          style={mobileBackdropStyle}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          ...sidebarStyle(effectiveCollapsed),
          ...(isMobile ? mobileSidebarStyle(mobileOpen) : {}),
        }}
        className="glass-panel"
      >
        <div style={sidebarHeaderStyle}>
          {!effectiveCollapsed && (
            <div style={logoStyle}>
              <span style={logoDotStyle}></span> EduAgent
            </div>
          )}
          {/* Desktop collapse button / Mobile close button */}
          <button
            onClick={() => isMobile ? setMobileOpen(false) : setCollapsed(!collapsed)}
            style={collapseBtnStyle}
            aria-label={isMobile ? "Close menu" : (collapsed ? "Expand sidebar" : "Collapse sidebar")}
          >
            {isMobile ? "✕" : effectiveCollapsed ? "➡️" : "⬅️"}
          </button>
        </div>

        <nav style={navStyle}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                style={navItemStyle(isActive, effectiveCollapsed)}
                className="glass-btn"
              >
                <span style={iconStyle}>{item.icon}</span>
                {!effectiveCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* ── Pomodoro Study Session Tracker ─────────────────────────── */}
        {!effectiveCollapsed && (
          <div style={pomodoroContainerStyle}>
            <div
              onClick={() => setPomodoroOpen(!pomodoroOpen)}
              style={pomodoroHeaderStyle}
            >
              <span style={{ fontSize: "14px" }}>{sessionActive ? "🔴" : "⏱️"}</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: sessionActive ? "#34d399" : "var(--text-secondary)", flex: 1 }}>
                {sessionActive ? `${formatTimer(sessionElapsed)}` : "Study Timer"}
              </span>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{pomodoroOpen ? "▲" : "▼"}</span>
            </div>

            {pomodoroOpen && (
              <div style={pomodoroBodyStyle}>
                {!sessionActive && (
                  <>
                    <div style={{ marginBottom: "8px" }}>
                      <label style={pomodoroLabelStyle}>Subject</label>
                      <select
                        value={sessionSubject}
                        onChange={e => setSessionSubject(e.target.value)}
                        style={pomodoroSelectStyle}
                      >
                        {["General Study", "Computer Networks", "Algorithms", "Database Systems", "System Design", "Mathematics", "Machine Learning"].map(s => (
                          <option key={s} value={s} style={{ backgroundColor: "#0D1117", color: "#F3F4F6" }}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginBottom: "10px" }}>
                      <label style={pomodoroLabelStyle}>Topic (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Binary Trees"
                        value={sessionTopic}
                        onChange={e => setSessionTopic(e.target.value)}
                        style={pomodoroInputStyle}
                      />
                    </div>
                    <button onClick={startStudySession} style={pomodoroStartBtnStyle}>
                      ▶ Start Session
                    </button>
                  </>
                )}

                {sessionActive && (
                  <>
                    <div style={{ textAlign: "center", marginBottom: "10px" }}>
                      <div style={{ fontSize: "28px", fontWeight: 700, color: "#34d399", fontFamily: "monospace" }}>
                        {formatTimer(sessionElapsed)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        {sessionSubject}{sessionTopic ? ` · ${sessionTopic}` : ""}
                      </div>
                    </div>
                    <button onClick={stopStudySession} style={pomodoroStopBtnStyle}>
                      ⏹ Stop & Save
                    </button>
                  </>
                )}

                {sessionStopped && !sessionActive && (
                  <div style={{ fontSize: "11px", color: "#34d399", textAlign: "center", padding: "4px 0" }}>
                    ✓ Session saved! Heatmap updated.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={sidebarFooterStyle}>
          {!effectiveCollapsed && (
            <div style={userProfileStyle}>
              <div style={avatarStyle}>
                {user.email.substring(0, 2).toUpperCase()}
              </div>
              <div style={userDetailsStyle}>
                <span style={userEmailStyle} title={user.email}>{user.email.split("@")[0]}</span>
                <span style={userRoleStyle}>Student</span>
              </div>
            </div>
          )}
          <button onClick={handleSignOut} style={signOutBtnStyle(effectiveCollapsed)}>
            🚪 {!effectiveCollapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div style={mainContainerStyle}>
        {/* Topbar */}
        <header style={topbarStyle} className="glass-panel">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Hamburger menu button — shown on mobile */}
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                style={hamburgerBtnStyle}
                aria-label="Open navigation menu"
              >
                <span style={hamburgerLineStyle} />
                <span style={hamburgerLineStyle} />
                <span style={hamburgerLineStyle} />
              </button>
            )}
            <div style={searchWrapperStyle}>
              <span style={{ marginRight: "8px" }}>🔍</span>
              <input
                type="text"
                placeholder={isMobile ? "Search…" : "Search concepts, quizzes, topics..."}
                style={searchInputStyle}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={topbarActionsStyle}>
            {!isMobile && (
              <select
                style={subjectSelectorStyle}
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="All Subjects" style={{ backgroundColor: "#0D1117", color: "#F3F4F6" }}>All Subjects</option>
                <option value="Computer Networks" style={{ backgroundColor: "#0D1117", color: "#F3F4F6" }}>Computer Networks</option>
                <option value="Algorithms" style={{ backgroundColor: "#0D1117", color: "#F3F4F6" }}>Algorithms</option>
                <option value="Database Systems" style={{ backgroundColor: "#0D1117", color: "#F3F4F6" }}>Database Systems</option>
                <option value="System Design" style={{ backgroundColor: "#0D1117", color: "#F3F4F6" }}>System Design</option>
              </select>
            )}

            <div style={{ position: "relative" }} ref={dropdownRef}>
              <div
                onClick={() => setProfileOpen(!profileOpen)}
                style={{ ...avatarStyle, cursor: "pointer" }}
                role="button"
                aria-haspopup="true"
                aria-expanded={profileOpen}
              >
                {user.email.substring(0, 2).toUpperCase()}
              </div>

              {profileOpen && (
                <div style={profileDropdownStyle} className="glass-panel">
                  <div style={{ display: "flex", flexDirection: "column", borderBottom: "1px solid var(--border-glass)", paddingBottom: "10px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user.email}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                      Learning Swarm Active
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                      30-Day Activity Heatmap
                    </span>
                    {analyticsData ? (
                      <>
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(10, 14px)",
                          gap: "4px",
                          marginTop: "4px"
                        }}>
                          {[...(analyticsData.heatmap || [])].reverse().map((day: any, i: number) => (
                            <div
                              key={i}
                              style={{
                                width: "14px",
                                height: "14px",
                                borderRadius: "3px",
                                backgroundColor: getHeatmapColor(day.hours),
                                transition: "all 0.2s ease",
                              }}
                              title={`${day.date}: ${day.hours.toFixed(1)} hrs`}
                            />
                          ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                          <span>Less</span>
                          <div style={{ display: "flex", gap: "2px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "1px", backgroundColor: "rgba(255,255,255,0.06)" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "1px", backgroundColor: "#0e4429" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "1px", backgroundColor: "#006d32" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "1px", backgroundColor: "#26a641" }} />
                            <div style={{ width: "8px", height: "8px", borderRadius: "1px", backgroundColor: "#39d353" }} />
                          </div>
                          <span>More</span>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", padding: "4px 0" }}>
                        Loading heatmap...
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSignOut}
                    style={dropdownLogoutBtnStyle}
                    className="glass-btn"
                  >
                    🚪 Log Out / Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={contentStyle}>{children}</main>

        {/* GROQ Key Modal */}
        {isSettingsOpen && (
          <div style={modalOverlayStyle} onClick={() => setIsSettingsOpen(false)}>
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={closeModalBtnStyle}
              >
                ✕
              </button>
              <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                🔑 Groq API Settings
              </h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "14px", lineHeight: "1.5", marginBottom: "20px" }}>
                Provide a Google Groq API Key to enable the platform's multi-agent AI features, including generating custom quizzes on any topic using general knowledge, answering complex conceptual questions, and creating custom study planners.
              </p>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase" }}>
                  Groq API Key
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={groqKey}
                  onChange={(e) => setgroqKey(e.target.value)}
                  style={modalInputStyle}
                />
                <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "6px" }}>
                  Don't have a key? Get one for free at{" "}
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                  >
                    Google AI Studio
                  </a>.
                </span>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                {groqKey && (
                  <button
                    onClick={handleClearKey}
                    style={clearBtnStyle}
                  >
                    Clear Key
                  </button>
                )}
                <button
                  onClick={() => {
                    handleSaveKey();
                    setIsSettingsOpen(false);
                  }}
                  style={saveBtnStyle}
                >
                  Save Key
                </button>
              </div>

              {saveSuccess && (
                <div style={toastStyle}>
                  Changes saved successfully!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const loadingContainerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  width: "100%",
  backgroundColor: "var(--bg-primary)",
};

const spinnerStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "4px solid rgba(255, 255, 255, 0.05)",
  borderTop: "4px solid var(--accent)",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const containerStyle: React.CSSProperties = {
  display: "flex",
  height: "100vh",
  width: "100vw",
  backgroundColor: "var(--bg-primary)",
  overflow: "hidden",
  position: "relative",
};

const sidebarStyle = (collapsed: boolean): React.CSSProperties => ({
  width: collapsed ? "80px" : "260px",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  borderRadius: 0,
  borderTop: "none",
  borderBottom: "none",
  borderLeft: "none",
  padding: "24px 16px",
  transition: "width var(--transition-smooth)",
  zIndex: 200,
  flexShrink: 0,
});

// Mobile sidebar: fixed overlay sliding in from left
const mobileSidebarStyle = (open: boolean): React.CSSProperties => ({
  position: "fixed",
  top: 0,
  left: 0,
  width: "260px",
  height: "100%",
  transform: open ? "translateX(0)" : "translateX(-100%)",
  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  zIndex: 300,
  boxShadow: open ? "4px 0 32px rgba(0,0,0,0.5)" : "none",
  borderRight: "1px solid var(--border-glass)",
});

const mobileBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 299,
  background: "rgba(0,0,0,0.5)",
  backdropFilter: "blur(4px)",
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "36px",
  height: "40px",
};

const logoStyle: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "var(--text-primary)",
};

const logoDotStyle: React.CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  backgroundColor: "var(--accent)",
  boxShadow: "0 0 8px var(--accent)",
};

const collapseBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border-glass)",
  cursor: "pointer",
  fontSize: "16px",
  padding: "6px",
  borderRadius: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-secondary)",
  backgroundColor: "rgba(255,255,255,0.02)",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  flex: 1,
};

const navItemStyle = (isActive: boolean, collapsed: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 14px",
  width: "100%",
  borderRadius: "var(--border-radius)",
  backgroundColor: isActive ? "rgba(99, 102, 241, 0.1)" : "transparent",
  border: `1px solid ${isActive ? "rgba(99, 102, 241, 0.25)" : "transparent"}`,
  color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
  justifyContent: collapsed ? "center" : "flex-start",
  boxShadow: isActive ? "0 0 10px rgba(99, 102, 241, 0.1)" : "none",
  textAlign: "left",
  textDecoration: "none",
});

const iconStyle: React.CSSProperties = {
  fontSize: "18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const sidebarFooterStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  paddingTop: "24px",
  borderTop: "1px solid var(--border-glass)",
};

const userProfileStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const avatarStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, var(--accent), #EC4899)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  fontWeight: "bold",
  color: "#ffffff",
  border: "1px solid var(--border-glass)",
  flexShrink: 0,
};

const userDetailsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const userEmailStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const userRoleStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-muted)",
};

const signOutBtnStyle = (collapsed: boolean): React.CSSProperties => ({
  padding: "10px",
  borderRadius: "var(--border-radius)",
  background: "rgba(239, 68, 68, 0.05)",
  border: "1px solid rgba(239, 68, 68, 0.15)",
  color: "#EF4444",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  transition: "all var(--transition-smooth)",
});

const mainContainerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  height: "100%",
  overflow: "hidden",
  minWidth: 0,
};

const topbarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  height: "64px",
  padding: "0 24px",
  borderRadius: 0,
  borderTop: "none",
  borderRight: "none",
  borderLeft: "none",
  zIndex: 90,
  flexShrink: 0,
};

const searchWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  color: "var(--text-muted)",
};

const searchInputStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  outline: "none",
  color: "var(--text-primary)",
  fontSize: "14px",
  width: "220px",
};

const topbarActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const subjectSelectorStyle: React.CSSProperties = {
  padding: "8px 12px",
  background: "var(--bg-glass)",
  border: "1px solid var(--border-glass)",
  borderRadius: "var(--border-radius)",
  color: "var(--text-primary)",
  fontSize: "13px",
  fontWeight: 500,
  outline: "none",
  cursor: "pointer",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: "24px",
  overflowY: "auto",
};

// ── Hamburger button ──────────────────────────────────────────────────────────

const hamburgerBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border-glass)",
  borderRadius: "8px",
  padding: "8px 10px",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  alignItems: "center",
  justifyContent: "center",
};

const hamburgerLineStyle: React.CSSProperties = {
  display: "block",
  width: "18px",
  height: "2px",
  background: "var(--text-secondary)",
  borderRadius: "2px",
};

// ── GROQ Modal Styles ──────────────────────────────────────────────────────

const settingsBtnStyle = (hasKey: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  background: hasKey ? "rgba(16, 185, 129, 0.12)" : "rgba(251, 191, 36, 0.08)",
  border: hasKey ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(251, 191, 36, 0.3)",
  borderRadius: "var(--border-radius)",
  color: hasKey ? "#34d399" : "#fbbf24",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  transition: "all 0.2s ease",
});

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.6)",
  backdropFilter: "blur(12px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  width: "90%",
  maxWidth: "480px",
  background: "rgba(23, 23, 33, 0.95)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "16px",
  padding: "32px",
  color: "#fff",
  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5)",
  position: "relative",
};

const closeModalBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: "16px",
  right: "16px",
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  fontSize: "18px",
  cursor: "pointer",
  padding: "4px",
};

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  transition: "border-color 0.2s ease",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const clearBtnStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "none",
  border: "1px solid rgba(239, 68, 68, 0.4)",
  color: "#ef4444",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
};

const toastStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "16px",
  left: "50%",
  transform: "translateX(-50%)",
  background: "#10b981",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: 500,
  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
};

const profileDropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  width: "240px",
  backgroundColor: "rgba(13, 17, 23, 0.95)",
  backdropFilter: "blur(16px)",
  border: "1px solid var(--border-glass-hover)",
  borderRadius: "12px",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
  zIndex: 1000,
};

const dropdownLogoutBtnStyle: React.CSSProperties = {
  marginTop: "8px",
  padding: "8px",
  borderRadius: "8px",
  background: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.2)",
  color: "#EF4444",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  width: "100%",
  transition: "all var(--transition-smooth)",
};

const getHeatmapColor = (hours: number) => {
  if (hours === 0) return "rgba(255, 255, 255, 0.06)";
  if (hours <= 0.5) return "#0e4429";
  if (hours <= 1.5) return "#006d32";
  if (hours <= 3.0) return "#26a641";
  return "#39d353";
};

// ── Pomodoro Tracker Styles ──────────────────────────────────────────────────

const pomodoroContainerStyle: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid var(--border-glass)",
  overflow: "hidden",
  backgroundColor: "rgba(255,255,255,0.02)",
  marginTop: "8px",
};

const pomodoroHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 12px",
  cursor: "pointer",
  userSelect: "none",
};

const pomodoroBodyStyle: React.CSSProperties = {
  padding: "10px 12px 12px",
  borderTop: "1px solid var(--border-glass)",
};

const pomodoroLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "4px",
};

const pomodoroSelectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "rgba(0,0,0,0.25)",
  border: "1px solid var(--border-glass)",
  borderRadius: "6px",
  color: "var(--text-primary)",
  fontSize: "12px",
  outline: "none",
};

const pomodoroInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "rgba(0,0,0,0.25)",
  border: "1px solid var(--border-glass)",
  borderRadius: "6px",
  color: "var(--text-primary)",
  fontSize: "12px",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const pomodoroStartBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  background: "rgba(16, 185, 129, 0.15)",
  border: "1px solid rgba(16, 185, 129, 0.35)",
  borderRadius: "6px",
  color: "#34d399",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const pomodoroStopBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  background: "rgba(239, 68, 68, 0.1)",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  borderRadius: "6px",
  color: "#f87171",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
};



