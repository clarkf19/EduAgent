"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface MindMapNode {
  id: string;
  label: string;
  type: "root" | "subject" | "concept";
  x: number;
  y: number;
  color: string;
  subject?: string;
  description: string;
  icon?: string;
}

interface MindMapLink {
  source: string;
  target: string;
  color: string;
}

const INITIAL_NODES: MindMapNode[] = [
  {
    id: "root",
    label: "My Knowledge",
    type: "root",
    x: 600,
    y: 375,
    color: "#6366f1",
    description: "The core hub representing all concepts studied and materials uploaded to EduAgent.",
    icon: "🧠"
  },
  
  // Subjects
  {
    id: "networks",
    label: "Computer Networks",
    type: "subject",
    x: 600 + 220 * Math.cos(0),
    y: 375 + 220 * Math.sin(0),
    color: "#3b82f6",
    subject: "Computer Networks",
    description: "Study of networks, transport layers, IP routing, packet loss, and connection handshakes.",
    icon: "🌐"
  },
  {
    id: "algorithms",
    label: "Algorithms",
    type: "subject",
    x: 600 + 220 * Math.cos((72 * Math.PI) / 180),
    y: 375 + 220 * Math.sin((72 * Math.PI) / 180),
    color: "#ec4899",
    subject: "Algorithms",
    description: "Algorithmic paradigms, time complexities, sorting algorithms, and space optimizations.",
    icon: "⚡"
  },
  {
    id: "databases",
    label: "Database Systems",
    type: "subject",
    x: 600 + 220 * Math.cos((144 * Math.PI) / 180),
    y: 375 + 220 * Math.sin((144 * Math.PI) / 180),
    color: "#10b981",
    subject: "Database Systems",
    description: "Relational database management systems, ACID constraints, normalization, and SQL joins.",
    icon: "💾"
  },
  {
    id: "os",
    label: "Operating Systems",
    type: "subject",
    x: 600 + 220 * Math.cos((216 * Math.PI) / 180),
    y: 375 + 220 * Math.sin((216 * Math.PI) / 180),
    color: "#f59e0b",
    subject: "Operating Systems",
    description: "CPU scheduling, memory paging, deadlocks, process threads, and fork system calls.",
    icon: "⚙️"
  },
  {
    id: "ml",
    label: "Machine Learning",
    type: "subject",
    x: 600 + 220 * Math.cos((288 * Math.PI) / 180),
    y: 375 + 220 * Math.sin((288 * Math.PI) / 180),
    color: "#8b5cf6",
    subject: "Machine Learning",
    description: "Supervised and unsupervised models, activation functions, gradients, and cross-validation.",
    icon: "🤖"
  },

  // Concepts under Computer Networks
  {
    id: "tcp",
    label: "TCP Handshake",
    type: "concept",
    x: 600 + 380 * Math.cos((-15 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((-15 * Math.PI) / 180),
    color: "#60a5fa",
    subject: "Computer Networks",
    description: "The 3-way handshake protocol (SYN -> SYN-ACK -> ACK) that establishes reliable connections between client and server.",
    icon: "🤝"
  },
  {
    id: "dns",
    label: "DNS Resolution",
    type: "concept",
    x: 600 + 380 * Math.cos((15 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((15 * Math.PI) / 180),
    color: "#60a5fa",
    subject: "Computer Networks",
    description: "The mechanism that translates human-readable domain names (e.g. google.com) into logical IP addresses.",
    icon: "🔍"
  },

  // Concepts under Algorithms
  {
    id: "mergesort",
    label: "Merge Sort",
    type: "concept",
    x: 600 + 380 * Math.cos((57 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((57 * Math.PI) / 180),
    color: "#f472b6",
    subject: "Algorithms",
    description: "A stable, divide-and-conquer sorting algorithm with a guaranteed O(n log n) time complexity, requiring O(n) auxiliary space.",
    icon: "🥞"
  },
  {
    id: "quicksort",
    label: "Quick Sort",
    type: "concept",
    x: 600 + 380 * Math.cos((87 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((87 * Math.PI) / 180),
    color: "#f472b6",
    subject: "Algorithms",
    description: "An in-place, divide-and-conquer sorting algorithm with average O(n log n) complexity, partition-based pivot splits, and worst-case O(n²).",
    icon: "🏹"
  },

  // Concepts under Databases
  {
    id: "acid",
    label: "ACID Transactions",
    type: "concept",
    x: 600 + 380 * Math.cos((129 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((129 * Math.PI) / 180),
    color: "#34d399",
    subject: "Database Systems",
    description: "Atomicity, Consistency, Isolation, and Durability properties guaranteeing database integrity during operations.",
    icon: "💎"
  },
  {
    id: "normal",
    label: "Normalization",
    type: "concept",
    x: 600 + 380 * Math.cos((159 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((159 * Math.PI) / 180),
    color: "#34d399",
    subject: "Database Systems",
    description: "The systematic optimization of tables (1NF, 2NF, 3NF, BCNF) to reduce data redundancy and dependency anomalies.",
    icon: "📊"
  },

  // Concepts under OS
  {
    id: "deadlock",
    label: "Deadlocks",
    type: "concept",
    x: 600 + 380 * Math.cos((201 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((201 * Math.PI) / 180),
    color: "#fbbf24",
    subject: "Operating Systems",
    description: "A situation where two or more processes are blocked indefinitely, each waiting for resources held by the other.",
    icon: "🔒"
  },
  {
    id: "vm",
    label: "Virtual Memory",
    type: "concept",
    x: 600 + 380 * Math.cos((231 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((231 * Math.PI) / 180),
    color: "#fbbf24",
    subject: "Operating Systems",
    description: "An OS memory management strategy abstracting physical RAM into page-mapped virtual address space backed by storage.",
    icon: "🧠"
  },

  // Concepts under ML
  {
    id: "supervised",
    label: "Supervised Learning",
    type: "concept",
    x: 600 + 380 * Math.cos((273 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((273 * Math.PI) / 180),
    color: "#a78bfa",
    subject: "Machine Learning",
    description: "Machine learning models trained on labeled datasets, learning mapping functions from input variables to target outputs.",
    icon: "📈"
  },
  {
    id: "nn",
    label: "Neural Networks",
    type: "concept",
    x: 600 + 380 * Math.cos((303 * Math.PI) / 180),
    y: 375 + 380 * Math.sin((303 * Math.PI) / 180),
    color: "#a78bfa",
    subject: "Machine Learning",
    description: "Computational graphs composed of layers of interconnected nodes modeling human brain activation patterns.",
    icon: "🕸"
  }
];

const LINKS: MindMapLink[] = [
  // Subject connects
  { source: "root", target: "networks", color: "rgba(59, 130, 246, 0.5)" },
  { source: "root", target: "algorithms", color: "rgba(236, 72, 153, 0.5)" },
  { source: "root", target: "databases", color: "rgba(16, 185, 129, 0.5)" },
  { source: "root", target: "os", color: "rgba(245, 158, 11, 0.5)" },
  { source: "root", target: "ml", color: "rgba(139, 92, 246, 0.5)" },

  // Concept connects
  { source: "networks", target: "tcp", color: "rgba(96, 165, 250, 0.4)" },
  { source: "networks", target: "dns", color: "rgba(96, 165, 250, 0.4)" },
  
  { source: "algorithms", target: "mergesort", color: "rgba(244, 114, 182, 0.4)" },
  { source: "algorithms", target: "quicksort", color: "rgba(244, 114, 182, 0.4)" },

  { source: "databases", target: "acid", color: "rgba(52, 211, 153, 0.4)" },
  { source: "databases", target: "normal", color: "rgba(52, 211, 153, 0.4)" },

  { source: "os", target: "deadlock", color: "rgba(251, 191, 36, 0.4)" },
  { source: "os", target: "vm", color: "rgba(251, 191, 36, 0.4)" },

  { source: "ml", target: "supervised", color: "rgba(167, 139, 250, 0.4)" },
  { source: "ml", target: "nn", color: "rgba(167, 139, 250, 0.4)" }
];

const FILTER_SUBJECTS = [
  "All Subjects",
  "Computer Networks",
  "Algorithms",
  "Database Systems",
  "Operating Systems",
  "Machine Learning"
];

export default function MindMapPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);

  const [nodes, setNodes] = useState<MindMapNode[]>(INITIAL_NODES);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState("All Subjects");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAskTutor = (label: string) => {
    if (typeof window !== "undefined") {
      router.push(`/dashboard/chat?question=Explain ${encodeURIComponent(label)} in detail, including formulas and practical applications.`);
    }
  };

  const handlePracticeQuiz = (subject: string) => {
    if (typeof window !== "undefined") {
      router.push(`/dashboard/quiz?trigger=true&subject=${encodeURIComponent(subject)}&mode=mcq`);
    }
  };

  // Node Dragging Handlers
  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setSelectedNode(node);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNodeId || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    
    // Scale local client coords back to the 1200x750 viewBox coordinates
    const viewBoxX = ((e.clientX - rect.left) / rect.width) * 1200;
    const viewBoxY = ((e.clientY - rect.top) / rect.height) * 750;

    // Apply viewport bounds so nodes don't fly off canvas
    const x = Math.min(Math.max(viewBoxX, 20), 1180);
    const y = Math.min(Math.max(viewBoxY, 20), 730);

    setNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x, y } : n));
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  // Filter & Search queries checks
  const isNodeVisible = (node: MindMapNode) => {
    // Subject filter matching
    const matchesFilter = 
      activeFilter === "All Subjects" ||
      node.type === "root" ||
      node.subject === activeFilter;

    // Search query matching
    const matchesSearch = 
      !searchQuery.trim() ||
      node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  };

  const isLinkVisible = (link: MindMapLink) => {
    const srcNode = nodes.find(n => n.id === link.source);
    const tgtNode = nodes.find(n => n.id === link.target);
    if (!srcNode || !tgtNode) return false;

    if (activeFilter === "All Subjects") return true;

    // Active branches connect root -> subject -> concept
    const matchesSrc = srcNode.type === "root" || srcNode.subject === activeFilter;
    const matchesTgt = tgtNode.subject === activeFilter;
    return matchesSrc && matchesTgt;
  };

  // Helper to generate premium smooth Cubic Bezier paths from parent node to child node
  const calculatePath = (src: MindMapNode, tgt: MindMapNode) => {
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    
    // Control points to draw nice organic curves
    const cx1 = src.x + dx * 0.5;
    const cy1 = src.y;
    const cx2 = src.x + dx * 0.5;
    const cy2 = tgt.y;

    return `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tgt.x} ${tgt.y}`;
  };

  return (
    <div style={containerStyle}>
      <style>{`
        .map-node {
          cursor: grab;
          transition: filter 0.25s ease;
        }
        .map-node:active {
          cursor: grabbing;
        }
        .link-path {
          fill: none;
          stroke-dasharray: 4 4;
          animation: strokeFlow 30s linear infinite;
        }
        @keyframes strokeFlow {
          to { stroke-dashoffset: -300; }
        }
        .filter-pill {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .filter-pill:hover {
          background: rgba(255, 255, 255, 0.08) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
        }
        .canvas-scroll-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .canvas-scroll-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .canvas-scroll-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 4px;
        }
        .canvas-scroll-container::-webkit-scrollbar-thumb:hover {
          background: var(--accent);
        }
      `}</style>

      {/* Header with Search and Filter bar */}
      <div style={headerFlexStyle}>
        <div>
          <h1 style={titleStyle}>Interactive Knowledge Space</h1>
          <p style={subtitleStyle}>Visualize dependencies and concepts. Drag nodes to customize your learning map layout.</p>
        </div>
        
        {/* Search bar */}
        <div style={searchContainerStyle}>
          <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>🔍</span>
          <input
            type="text"
            placeholder="Search concepts or subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={clearSearchBtnStyle}>✕</button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={pillRowStyle}>
        {FILTER_SUBJECTS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              ...filterPillStyle,
              background: activeFilter === filter ? "var(--accent)" : "rgba(255, 255, 255, 0.03)",
              borderColor: activeFilter === filter ? "var(--accent)" : "var(--border-glass)",
              color: activeFilter === filter ? "#fff" : "var(--text-secondary)",
              boxShadow: activeFilter === filter ? "0 0 12px var(--accent-glow)" : "none",
            }}
            className="filter-pill"
          >
            {filter}
          </button>
        ))}
      </div>

      <div style={viewGridStyle}>
        {/* SVG Visualization Canvas */}
        <div style={canvasContainerStyle} className="glass-panel canvas-scroll-container">
          <svg
            ref={svgRef}
            width="1200"
            height="750"
            viewBox="0 0 1200 750"
            style={{ background: "#06090f" }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              {/* Glowing effect for selected / active items */}
              <filter id="premiumGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Connecting lines */}
            {LINKS.map((link, idx) => {
              const srcNode = nodes.find(n => n.id === link.source);
              const tgtNode = nodes.find(n => n.id === link.target);
              if (!srcNode || !tgtNode) return null;
              
              const isVisible = isLinkVisible(link);
              const isHighlighted = hoveredNodeId === srcNode.id || hoveredNodeId === tgtNode.id;

              const pathString = calculatePath(srcNode, tgtNode);

              return (
                <g key={`link-group-${idx}`} style={{ opacity: isVisible ? 1 : 0.1, transition: "opacity 0.3s ease" }}>
                  {/* Outer glow line on hover */}
                  {isHighlighted && (
                    <path
                      d={pathString}
                      fill="none"
                      stroke={tgtNode.color}
                      strokeWidth="6"
                      style={{ opacity: 0.25 }}
                    />
                  )}
                  {/* Main path line */}
                  <path
                    id={`link-path-${idx}`}
                    d={pathString}
                    stroke={isHighlighted ? tgtNode.color : link.color}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    className="link-path"
                    style={{
                      transition: "stroke 0.2s ease, stroke-width 0.2s ease",
                    }}
                  />
                  {/* Moving Flow Particle */}
                  {isVisible && (
                    <circle r="3" fill="#fff">
                      <animateMotion dur={isHighlighted ? "3s" : "6s"} repeatCount="indefinite">
                        <mpath href={`#link-path-${idx}`} />
                      </animateMotion>
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isVisible = isNodeVisible(node);

              const isRoot = node.type === "root";
              const isSubject = node.type === "subject";
              
              let radius = 14;
              if (isRoot) radius = 24;
              else if (isSubject) radius = 18;

              return (
                <g
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{
                    opacity: isVisible ? 1 : 0.15,
                    transition: "opacity 0.3s ease, transform 0.1s ease",
                  }}
                  className="map-node"
                >
                  {/* Ripple Ring Effect (Only for hovered/selected subject/root nodes) */}
                  {(isSelected || isHovered) && (
                    <circle
                      r={radius + 8}
                      fill="transparent"
                      stroke={node.color}
                      strokeWidth="1.5"
                      style={{ opacity: 0.4 }}
                    />
                  )}

                  {/* Main Circle representing the concept */}
                  <circle
                    r={radius}
                    fill={node.color}
                    style={{
                      filter: isSelected || isHovered ? "url(#premiumGlow)" : "none",
                      stroke: isSelected ? "#fff" : "rgba(255,255,255,0.15)",
                      strokeWidth: isSelected ? 3 : 1,
                      transition: "all 0.2s ease",
                    }}
                  />

                  {/* Node Icon/Badge label inside root/subject nodes */}
                  {node.icon && (
                    <text
                      textAnchor="middle"
                      dy="4"
                      style={{
                        fontSize: isRoot ? "16px" : "12px",
                        pointerEvents: "none",
                        userSelect: "none"
                      }}
                    >
                      {node.icon}
                    </text>
                  )}

                  {/* Text Label Below Node */}
                  <text
                    y={radius + 18}
                    textAnchor="middle"
                    fill={isSelected ? "#fff" : isHovered ? "#e2e8f0" : "var(--text-secondary)"}
                    style={{
                      fontSize: isRoot ? "13px" : isSubject ? "12px" : "11px",
                      fontWeight: isRoot || isSubject ? 700 : 500,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Info Drawer Panel */}
        <div style={infoDrawerPanelStyle} className="glass-panel">
          {selectedNode ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px" }}>
                <span style={typeBadgeStyle(selectedNode.type)}>{selectedNode.type}</span>
                {selectedNode.subject && <span style={subjBadgeStyle}>{selectedNode.subject}</span>}
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "12px" }}>
                {selectedNode.label}
              </h2>
              <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", lineHeight: 1.6, flex: 1 }}>
                {selectedNode.description}
              </p>

              <div style={drawerActionsStyle}>
                <button
                  onClick={() => handleAskTutor(selectedNode.label)}
                  style={primaryActionBtnStyle}
                >
                  💬 Ask AI Tutor about this
                </button>
                {selectedNode.subject && (
                  <button
                    onClick={() => handlePracticeQuiz(selectedNode.subject!)}
                    style={secondaryActionBtnStyle}
                  >
                    📝 Launch Practice Quiz
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={emptyDrawerStyle}>
              <span style={{ fontSize: "36px" }}>🕸</span>
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginTop: "12px" }}>Interactive Graph Hub</p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                Click or drag any subject node to inspect details, ask AI custom doubts, or jump straight to practice tests.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  maxWidth: "1100px",
  margin: "0 auto",
  height: "100%",
};

const headerFlexStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  flexWrap: "wrap"
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

const searchContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid var(--border-glass)",
  borderRadius: "var(--border-radius)",
  padding: "6px 12px",
  width: "280px",
  gap: "8px"
};

const searchInputStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  width: "100%"
};

const clearSearchBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "11px",
  padding: "2px"
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginBottom: "4px"
};

const filterPillStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  border: "1px solid var(--border-glass)",
  borderRadius: "20px",
  padding: "6px 16px",
  cursor: "pointer"
};

const viewGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 340px",
  gap: "24px",
  flex: 1,
  minHeight: 0,
};

const canvasContainerStyle: React.CSSProperties = {
  borderRadius: "var(--border-radius-lg)",
  overflow: "auto",
  height: "500px",
  border: "1px solid var(--border-glass)",
};

const infoDrawerPanelStyle: React.CSSProperties = {
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  height: "500px",
};

const typeBadgeStyle = (type: "root" | "subject" | "concept"): React.CSSProperties => {
  const bg = type === "root" ? "rgba(99, 102, 241, 0.15)" : type === "subject" ? "rgba(236, 72, 153, 0.15)" : "rgba(16, 185, 129, 0.15)";
  const color = type === "root" ? "#818cf8" : type === "subject" ? "#f472b6" : "#34d399";
  return {
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase",
    background: bg,
    color: color,
    border: `1px solid ${color}30`,
    borderRadius: "6px",
    padding: "2px 8px",
    letterSpacing: "0.5px"
  };
};

const subjBadgeStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  background: "rgba(255,255,255,0.04)",
  color: "var(--text-secondary)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "6px",
  padding: "2px 8px"
};

const emptyDrawerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  textAlign: "center",
  padding: "20px"
};

const drawerActionsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  marginTop: "20px",
  borderTop: "1px solid var(--border-glass)",
  paddingTop: "16px"
};

const primaryActionBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "linear-gradient(135deg, var(--accent), #818CF8)",
  border: "none",
  borderRadius: "var(--border-radius)",
  color: "#fff",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 0 12px rgba(99,102,241,0.25)",
};

const secondaryActionBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--border-glass)",
  borderRadius: "var(--border-radius)",
  color: "var(--text-secondary)",
  padding: "10px 14px",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};
