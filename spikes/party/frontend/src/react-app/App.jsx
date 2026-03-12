// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * Party Planner — Multi-view React App with Theme Support
 *
 * Three views: Planning, Day-of, Recap.
 * Themes: shared state — when one user switches, everyone sees it.
 * Agent: circle-select a section via ea-ux gesture → Gemini adds items.
 *
 * Uses `data-section` attributes on cards so the parent-frame entry
 * layer can report their positions for gesture hit detection.
 * Section ID = context key = CRDT key. One name, three worlds.
 *
 * Knows NOTHING about Yjs, CRDTs, or collaboration.
 */

import React, { useState, useEffect } from "react";

/* ── Theme Definitions ────────────────────────────────────────────── */

const THEMES = {
  midnight: {
    label: "🌙 Midnight",
    bg: "#0f0f13", surface: "#1a1a24", surfaceAlt: "#22222e",
    border: "#2e2e3e", text: "#e8e8f0", textMuted: "#8888a0",
    accent: "#7c6cff", accentGlow: "rgba(124, 108, 255, 0.2)", success: "#34d399",
  },
  ocean: {
    label: "🌊 Ocean",
    bg: "#0a1628", surface: "#0f2240", surfaceAlt: "#152a4a",
    border: "#1e3a5f", text: "#e0f0ff", textMuted: "#7ba8d0",
    accent: "#38bdf8", accentGlow: "rgba(56, 189, 248, 0.2)", success: "#22d3ee",
  },
  neon: {
    label: "⚡ Neon",
    bg: "#0a0a0f", surface: "#12121f", surfaceAlt: "#1a1a2e",
    border: "#2a2a4a", text: "#f0f0ff", textMuted: "#9090b8",
    accent: "#ff2eaa", accentGlow: "rgba(255, 46, 170, 0.2)", success: "#00ff88",
  },
  forest: {
    label: "🌲 Forest",
    bg: "#0a120e", surface: "#121f18", surfaceAlt: "#1a2a22",
    border: "#2a3e32", text: "#e0f0e8", textMuted: "#7aaa8e",
    accent: "#10b981", accentGlow: "rgba(16, 185, 129, 0.2)", success: "#34d399",
  },
};

function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.midnight;
  const root = document.documentElement;
  Object.entries({
    "--color-bg": theme.bg, "--color-surface": theme.surface,
    "--color-surface-alt": theme.surfaceAlt, "--color-border": theme.border,
    "--color-text": theme.text, "--color-text-muted": theme.textMuted,
    "--color-accent": theme.accent, "--color-accent-glow": theme.accentGlow,
    "--color-success": theme.success,
  }).forEach(([k, v]) => root.style.setProperty(k, v));
}

/* ── Root App ─────────────────────────────────────────────────────── */

export default function App({ view = "planning", theme = "midnight",
                               guests = [], tasks = [], notes = "",
                               identity = {}, _agent = null }) {
  useEffect(() => applyTheme(theme), [theme]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <TopBar currentView={view} currentTheme={theme} />
      {_agent && <AgentBanner agent={_agent} />}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {view === "planning" && (
          <PlanningView guests={guests} tasks={tasks} notes={notes}
                        identity={identity} agentTarget={_agent?.target} />
        )}
        {view === "dayOf" && (
          <DayOfView tasks={tasks} identity={identity} agentTarget={_agent?.target} />
        )}
        {view === "recap" && (
          <RecapView guests={guests} tasks={tasks} notes={notes} />
        )}
      </div>
    </div>
  );
}

/* ── Agent Banner ─────────────────────────────────────────────────── */

function AgentBanner({ agent }) {
  const statusText = agent.status === "thinking"
    ? "🤖 Gemini is thinking…"
    : "🤖 Gemini is adding items…";

  return (
    <div style={{
      padding: "8px 16px",
      background: "linear-gradient(90deg, var(--color-accent)22, transparent)",
      borderBottom: "1px solid var(--color-border)",
      fontSize: 13, fontWeight: 500,
      color: "var(--color-accent)",
      display: "flex", alignItems: "center", gap: 8,
      animation: "pulse 1.5s ease-in-out infinite",
    }}>
      <span style={{
        display: "inline-block", width: 8, height: 8,
        borderRadius: "50%", background: "var(--color-accent)",
        animation: "pulse-dot 1s ease-in-out infinite",
      }} />
      {statusText}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes pulse-dot { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }
      `}</style>
    </div>
  );
}

/* ── Top Bar ──────────────────────────────────────────────────────── */

const VIEWS = [
  { id: "planning", label: "📋 Planning" },
  { id: "dayOf",    label: "🎉 Day-of" },
  { id: "recap",    label: "📊 Recap" },
];

function TopBar({ currentView, currentTheme }) {
  return (
    <nav style={{
      display: "flex", alignItems: "center",
      borderBottom: "1px solid var(--color-border)",
      background: "var(--color-surface)",
    }}>
      <div style={{ display: "flex", flex: 1 }}>
        {VIEWS.map((v) => (
          <button key={v.id}
            onClick={() => ark.mutate("view", "set", v.id)}
            style={{
              flex: 1, padding: "12px 16px",
              background: currentView === v.id ? "var(--color-accent)" : "transparent",
              color: currentView === v.id ? "white" : "var(--color-text-muted)",
              border: "none", borderRadius: 0,
              fontFamily: "var(--font)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div style={{
        display: "flex", gap: 4, padding: "0 12px",
        borderLeft: "1px solid var(--color-border)",
      }}>
        {Object.entries(THEMES).map(([id, t]) => (
          <button key={id}
            onClick={() => ark.mutate("theme", "set", id)}
            title={t.label}
            style={{
              width: 24, height: 24, padding: 0, borderRadius: "50%",
              background: t.accent,
              border: currentTheme === id ? "2px solid var(--color-text)" : "2px solid transparent",
              cursor: "pointer", transition: "border-color 0.15s",
              opacity: currentTheme === id ? 1 : 0.6,
            }}
          />
        ))}
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════
   VIEW 1: PLANNING
   ══════════════════════════════════════════════════════════════════ */

function PlanningView({ guests, tasks, notes, identity, agentTarget }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <GuestList guests={guests} identity={identity}
                 agentActive={agentTarget === "guests"} />
      <TaskList tasks={tasks} identity={identity}
                agentActive={agentTarget === "tasks"} />
      <Notes notes={notes} />
    </div>
  );
}

/* ── Guest List ──────────────────────────────────────────────────── */

function GuestList({ guests, identity, agentActive }) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const name = input.trim();
    if (!name) return;
    ark.mutate("guests", "push", { name, addedBy: identity.name || "?" });
    setInput("");
  };

  return (
    <div className="card" data-section="guests" data-label="Guest List"
         style={{
           borderColor: agentActive ? "var(--color-accent)" : undefined,
           transition: "border-color 0.3s",
         }}>
      <h2>Guest List</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a guest" style={{ flex: 1 }}
        />
        <button onClick={handleAdd}>Add</button>
      </div>
      {guests.length === 0 && (
        <Empty text="No guests yet — type a name or circle this card ✨" />
      )}
      <ul style={{ listStyle: "none" }}>
        {guests.map((g, i) => (
          <li key={i} style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "6px 0",
            borderBottom: "1px solid var(--color-border)",
            animation: g.addedBy === "🤖 Gemini" ? "fadeInSlide 0.4s ease-out" : undefined,
          }}>
            <span>{g.name}</span>
            <span className="attribution">added by {g.addedBy}</span>
          </li>
        ))}
      </ul>
      <style>{`
        @keyframes fadeInSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ── Task List ───────────────────────────────────────────────────── */

function TaskList({ tasks, identity, agentActive }) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const text = input.trim();
    if (!text) return;
    ark.mutate("tasks", "push", {
      text, done: false,
      addedBy: identity.name || "?", completedBy: "",
    });
    setInput("");
  };

  const handleToggle = (i) => {
    const done = !tasks[i].done;
    ark.mutate(`tasks.${i}.done`, "set", done);
    ark.mutate(`tasks.${i}.completedBy`, "set", done ? (identity.name || "?") : "");
  };

  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? (doneCount / tasks.length) * 100 : 0;

  return (
    <div className="card" data-section="tasks" data-label="Tasks"
         style={{
           borderColor: agentActive ? "var(--color-accent)" : undefined,
           transition: "border-color 0.3s",
         }}>
      <h2>Tasks</h2>
      <ProgressBar done={doneCount} total={tasks.length} progress={progress} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a task" style={{ flex: 1 }}
        />
        <button onClick={handleAdd}>Add</button>
      </div>
      {tasks.length === 0 && (
        <Empty text="No tasks yet — add some or circle this card ✨" />
      )}
      <TaskItems tasks={tasks} onToggle={handleToggle} />
    </div>
  );
}

/* ── Notes ────────────────────────────────────────────────────────── */

function Notes({ notes }) {
  return (
    <div className="card" data-section="notes" data-label="Shared Notes">
      <h2>Shared Notes</h2>
      <textarea value={notes}
        onChange={(e) => ark.mutate("notes", "set", e.target.value)}
        placeholder="Type here — everyone sees it live…"
      />
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
        Changes sync across all collaborators
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   VIEW 2: DAY-OF
   ══════════════════════════════════════════════════════════════════ */

function DayOfView({ tasks, identity, agentTarget }) {
  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length ? (doneCount / tasks.length) * 100 : 0;
  const allDone = tasks.length > 0 && doneCount === tasks.length;

  const handleToggle = (i) => {
    const done = !tasks[i].done;
    ark.mutate(`tasks.${i}.done`, "set", done);
    ark.mutate(`tasks.${i}.completedBy`, "set", done ? (identity.name || "?") : "");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{
        textAlign: "center", padding: "32px 0",
        background: "var(--color-surface)", borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
      }}>
        <div style={{
          fontSize: 64, fontWeight: 800,
          background: `linear-gradient(135deg, var(--color-accent), ${allDone ? "var(--color-success)" : "#ff6b9d"})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          {Math.round(progress)}%
        </div>
        <div style={{ color: "var(--color-text-muted)", fontSize: 14, marginTop: 4 }}>
          {allDone ? "🎉 All tasks complete!" : `${doneCount} of ${tasks.length} tasks done`}
        </div>
        <div style={{
          margin: "16px auto 0", width: "60%", height: 8,
          borderRadius: 4, background: "var(--color-surface-alt)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: allDone ? "var(--color-success)" : "var(--color-accent)",
            transition: "width 0.5s ease", borderRadius: 4,
          }} />
        </div>
      </div>

      <div className="card" data-section="tasks" data-label="Checklist"
           style={{
             borderColor: agentTarget === "tasks" ? "var(--color-accent)" : undefined,
           }}>
        <h2>Checklist</h2>
        {tasks.length === 0 && <Empty text="No tasks — go to Planning to add some" />}
        <TaskItems tasks={tasks} onToggle={handleToggle} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   VIEW 3: RECAP
   ══════════════════════════════════════════════════════════════════ */

function RecapView({ guests, tasks, notes }) {
  const doneCount = tasks.filter((t) => t.done).length;
  const contributors = {};
  for (const t of tasks) {
    if (t.done && t.completedBy) {
      contributors[t.completedBy] = (contributors[t.completedBy] || 0) + 1;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <StatCard label="Guests" value={guests.length} emoji="👥" />
        <StatCard label="Tasks Done" value={`${doneCount}/${tasks.length}`} emoji="✅" />
        <StatCard label="Contributors" value={Object.keys(contributors).length} emoji="🤝" />
      </div>
      {Object.keys(contributors).length > 0 && (
        <div className="card">
          <h2>Who Did What</h2>
          <ul style={{ listStyle: "none" }}>
            {Object.entries(contributors).sort(([,a],[,b]) => b - a).map(([name, count]) => (
              <li key={name} style={{
                display: "flex", justifyContent: "space-between",
                padding: "8px 0", borderBottom: "1px solid var(--color-border)",
              }}>
                <span>{name}</span>
                <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>
                  {count} task{count > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes && (
        <div className="card">
          <h2>Notes</h2>
          <div style={{
            padding: 12, background: "var(--color-surface-alt)",
            borderRadius: 6, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.6,
          }}>
            {notes}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared Components ────────────────────────────────────────────── */

function Empty({ text }) {
  return (
    <div style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "12px 0" }}>
      {text}
    </div>
  );
}

function ProgressBar({ done, total, progress }) {
  return (
    <>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}>
        {done} of {total} complete
      </div>
      <div style={{
        height: 4, borderRadius: 2, background: "var(--color-surface-alt)",
        marginBottom: 12, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: "var(--color-accent)", transition: "width 0.3s ease",
        }} />
      </div>
    </>
  );
}

function TaskItems({ tasks, onToggle }) {
  return (
    <ul style={{ listStyle: "none" }}>
      {tasks.map((t, i) => (
        <li key={i} style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "8px 0",
          borderBottom: "1px solid var(--color-border)",
          animation: t.addedBy === "🤖 Gemini" ? "fadeInSlide 0.4s ease-out" : undefined,
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={t.done} onChange={() => onToggle(i)}
              style={{ accentColor: "var(--color-accent)" }} />
            <span style={{
              textDecoration: t.done ? "line-through" : "none",
              opacity: t.done ? 0.6 : 1,
            }}>
              {t.text}
            </span>
          </label>
          <span className="attribution">
            {t.done ? `✓ ${t.completedBy}` : `by ${t.addedBy}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StatCard({ label, value, emoji }) {
  return (
    <div style={{
      background: "var(--color-surface)", border: "1px solid var(--color-border)",
      borderRadius: "var(--radius)", padding: 16, textAlign: "center",
    }}>
      <div style={{ fontSize: 28 }}>{emoji}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
