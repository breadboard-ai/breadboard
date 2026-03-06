"""Artifact templates for simulated UI generation runs.

Each template is a dict mapping relative file paths to their content.
The `generate_artifacts` function picks a template based on the objective
and customizes it with the run's objective and ID.
"""

import hashlib
from pathlib import Path

TEMPLATES: list[dict[str, str]] = [
    # ── Template 0: Dashboard ──────────────────────────────────
    {
        "App.jsx": """\
import React from "react";
import Header from "./components/Header";
import MetricsGrid from "./components/MetricsGrid";
import ActivityFeed from "./components/ActivityFeed";
import "./styles.css";

export default function App() {{
  return (
    <div className="dashboard">
      <Header title="{objective}" />
      <main className="dashboard-body">
        <MetricsGrid />
        <ActivityFeed />
      </main>
    </div>
  );
}}
""",
        "components/Header.jsx": """\
import React from "react";
import logo from "../assets/logo.svg";

export default function Header({{ title }}) {{
  return (
    <header className="header">
      <img src={{logo}} alt="Logo" className="header-logo" />
      <h1>{{title}}</h1>
      <nav className="header-nav">
        <a href="#overview">Overview</a>
        <a href="#reports">Reports</a>
        <a href="#settings">Settings</a>
      </nav>
    </header>
  );
}}
""",
        "components/MetricsGrid.jsx": """\
import React from "react";

const metrics = [
  {{ label: "Active Users", value: "1,284", trend: "+12%" }},
  {{ label: "Revenue", value: "$42.5k", trend: "+8%" }},
  {{ label: "Conversion", value: "3.2%", trend: "-0.4%" }},
  {{ label: "Avg Session", value: "4m 12s", trend: "+1m" }},
];

export default function MetricsGrid() {{
  return (
    <section className="metrics-grid">
      {{metrics.map((m) => (
        <div key={{m.label}} className="metric-card">
          <span className="metric-label">{{m.label}}</span>
          <span className="metric-value">{{m.value}}</span>
          <span className="metric-trend">{{m.trend}}</span>
        </div>
      ))}}
    </section>
  );
}}
""",
        "components/ActivityFeed.jsx": """\
import React from "react";

export default function ActivityFeed() {{
  const items = [
    "User signed up",
    "Payment received — $29.99",
    "Report generated",
    "New comment on Dashboard",
  ];
  return (
    <section className="activity-feed">
      <h2>Recent Activity</h2>
      <ul>
        {{items.map((item, i) => <li key={{i}}>{{item}}</li>)}}
      </ul>
    </section>
  );
}}
""",
        "styles.css": """\
:root {{
  --primary: #4f46e5;
  --surface: #f8fafc;
  --text: #1e293b;
  --border: #e2e8f0;
}}

body {{ margin: 0; font-family: system-ui, sans-serif; color: var(--text); }}

.dashboard {{ min-height: 100vh; background: var(--surface); }}

.header {{
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem 2rem; background: white; border-bottom: 1px solid var(--border);
}}
.header-logo {{ width: 32px; height: 32px; }}
.header h1 {{ flex: 1; font-size: 1.25rem; }}
.header-nav {{ display: flex; gap: 1rem; }}
.header-nav a {{ text-decoration: none; color: var(--primary); }}

.dashboard-body {{ padding: 2rem; }}

.metrics-grid {{
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem; margin-bottom: 2rem;
}}
.metric-card {{
  background: white; border-radius: 8px; padding: 1.25rem;
  border: 1px solid var(--border);
}}
.metric-label {{ display: block; font-size: 0.85rem; opacity: 0.6; }}
.metric-value {{ display: block; font-size: 1.5rem; font-weight: 700; margin: 0.25rem 0; }}
.metric-trend {{ font-size: 0.85rem; color: var(--primary); }}

.activity-feed h2 {{ font-size: 1.1rem; }}
.activity-feed ul {{ list-style: none; padding: 0; }}
.activity-feed li {{
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}}
""",
    },

    # ── Template 1: Landing Page ───────────────────────────────
    {
        "App.jsx": """\
import React from "react";
import Hero from "./components/Hero";
import Features from "./components/Features";
import CTA from "./components/CTA";
import "./styles.css";

export default function App() {{
  return (
    <div className="landing">
      <Hero headline="{objective}" />
      <Features />
      <CTA />
    </div>
  );
}}
""",
        "components/Hero.jsx": """\
import React from "react";
import heroImg from "../assets/hero.svg";

export default function Hero({{ headline }}) {{
  return (
    <section className="hero">
      <div className="hero-text">
        <h1>{{headline}}</h1>
        <p>Build something extraordinary with a single prompt.</p>
        <button className="cta-btn">Get Started</button>
      </div>
      <img src={{heroImg}} alt="Hero" className="hero-img" />
    </section>
  );
}}
""",
        "components/Features.jsx": """\
import React from "react";

const features = [
  {{ icon: "⚡", title: "Fast", desc: "Lightning-fast generation in seconds." }},
  {{ icon: "🎨", title: "Beautiful", desc: "Pixel-perfect designs out of the box." }},
  {{ icon: "🔧", title: "Customizable", desc: "Full control over every component." }},
];

export default function Features() {{
  return (
    <section className="features">
      {{features.map((f) => (
        <div key={{f.title}} className="feature-card">
          <span className="feature-icon">{{f.icon}}</span>
          <h3>{{f.title}}</h3>
          <p>{{f.desc}}</p>
        </div>
      ))}}
    </section>
  );
}}
""",
        "components/CTA.jsx": """\
import React from "react";

export default function CTA() {{
  return (
    <section className="cta-section">
      <h2>Ready to build?</h2>
      <p>Start creating your UI now — no design skills needed.</p>
      <button className="cta-btn">Launch Builder</button>
    </section>
  );
}}
""",
        "styles.css": """\
:root {{
  --primary: #7c3aed;
  --surface: #faf5ff;
  --text: #1e1b4b;
  --border: #e9d5ff;
}}

body {{ margin: 0; font-family: system-ui, sans-serif; color: var(--text); }}

.landing {{ min-height: 100vh; background: var(--surface); }}

.hero {{
  display: flex; align-items: center; justify-content: center;
  gap: 3rem; padding: 4rem 2rem; flex-wrap: wrap;
}}
.hero-text {{ max-width: 480px; }}
.hero-text h1 {{ font-size: 2.5rem; line-height: 1.2; }}
.hero-text p {{ font-size: 1.15rem; opacity: 0.8; margin: 1rem 0 1.5rem; }}
.hero-img {{ width: 320px; height: 240px; }}

.cta-btn {{
  background: var(--primary); color: white; border: none;
  padding: 0.75rem 2rem; border-radius: 8px; font-size: 1rem;
  cursor: pointer;
}}
.cta-btn:hover {{ opacity: 0.9; }}

.features {{
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem; padding: 3rem 2rem;
}}
.feature-card {{
  background: white; border: 1px solid var(--border);
  border-radius: 12px; padding: 1.5rem; text-align: center;
}}
.feature-icon {{ font-size: 2rem; }}
.feature-card h3 {{ margin: 0.5rem 0 0.25rem; }}

.cta-section {{
  text-align: center; padding: 4rem 2rem;
  background: var(--primary); color: white;
}}
.cta-section .cta-btn {{
  background: white; color: var(--primary);
}}
""",
    },

    # ── Template 2: Settings / Admin Panel ─────────────────────
    {
        "App.jsx": """\
import React from "react";
import Sidebar from "./components/Sidebar";
import SettingsForm from "./components/SettingsForm";
import "./styles.css";

export default function App() {{
  return (
    <div className="admin-panel">
      <Sidebar />
      <main className="admin-main">
        <h1>{objective}</h1>
        <SettingsForm />
      </main>
    </div>
  );
}}
""",
        "components/Sidebar.jsx": """\
import React from "react";
import icon from "../assets/icon.svg";

const links = ["General", "Profile", "Notifications", "Security", "Billing"];

export default function Sidebar() {{
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={{icon}} alt="Icon" />
        <span>Admin</span>
      </div>
      <nav>
        {{links.map((l) => (
          <a key={{l}} href={{"#" + l.toLowerCase()}} className="sidebar-link">
            {{l}}
          </a>
        ))}}
      </nav>
    </aside>
  );
}}
""",
        "components/SettingsForm.jsx": """\
import React from "react";

export default function SettingsForm() {{
  return (
    <form className="settings-form" onSubmit={{(e) => e.preventDefault()}}>
      <label>
        <span>Display Name</span>
        <input type="text" defaultValue="Alex" />
      </label>
      <label>
        <span>Email</span>
        <input type="email" defaultValue="alex@example.com" />
      </label>
      <label>
        <span>Theme</span>
        <select defaultValue="system">
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </label>
      <button type="submit" className="save-btn">Save Changes</button>
    </form>
  );
}}
""",
        "styles.css": """\
:root {{
  --primary: #0891b2;
  --surface: #f0fdfa;
  --text: #134e4a;
  --border: #99f6e4;
  --sidebar-bg: #0f766e;
}}

body {{ margin: 0; font-family: system-ui, sans-serif; color: var(--text); }}

.admin-panel {{
  display: grid; grid-template-columns: 220px 1fr;
  min-height: 100vh;
}}

.sidebar {{
  background: var(--sidebar-bg); color: white; padding: 1.5rem 1rem;
}}
.sidebar-brand {{
  display: flex; align-items: center; gap: 0.5rem;
  margin-bottom: 2rem; font-weight: 700; font-size: 1.1rem;
}}
.sidebar-brand img {{ width: 24px; height: 24px; filter: invert(1); }}
.sidebar-link {{
  display: block; padding: 0.5rem 0.75rem; border-radius: 6px;
  color: rgba(255,255,255,0.8); text-decoration: none; margin-bottom: 0.25rem;
}}
.sidebar-link:hover {{ background: rgba(255,255,255,0.1); color: white; }}

.admin-main {{ padding: 2rem; background: var(--surface); }}
.admin-main h1 {{ font-size: 1.5rem; margin-bottom: 1.5rem; }}

.settings-form {{
  display: flex; flex-direction: column; gap: 1.25rem;
  max-width: 420px;
}}
.settings-form label {{ display: flex; flex-direction: column; gap: 0.25rem; }}
.settings-form label span {{ font-size: 0.85rem; font-weight: 600; }}
.settings-form input, .settings-form select {{
  padding: 0.5rem; border: 1px solid var(--border);
  border-radius: 6px; font-size: 1rem;
}}
.save-btn {{
  background: var(--primary); color: white; border: none;
  padding: 0.6rem 1.5rem; border-radius: 6px; font-size: 1rem;
  cursor: pointer; align-self: flex-start;
}}
.save-btn:hover {{ opacity: 0.9; }}
""",
    },
]


def _make_svg(label: str, color: str) -> str:
    """Generate a minimal SVG placeholder image."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" '
        f'viewBox="0 0 200 150">'
        f'<rect width="200" height="150" fill="{color}" rx="8"/>'
        f'<text x="100" y="80" text-anchor="middle" fill="white" '
        f'font-family="system-ui" font-size="14">{label}</text>'
        f'</svg>'
    )


# Asset sets per template index — (filename, label, color).
_ASSET_SPECS: list[list[tuple[str, str, str]]] = [
    # Dashboard
    [("assets/logo.svg", "Logo", "#4f46e5")],
    # Landing
    [("assets/hero.svg", "Hero Image", "#7c3aed")],
    # Admin
    [("assets/icon.svg", "Icon", "#0891b2")],
]


def _make_skill_md(objective: str, files: list[str]) -> str:
    file_list = "\n".join(f"- `{f}`" for f in sorted(files))
    return f"""\
# Generated UI: {objective}

## Overview

This UI was generated for the objective: **{objective}**.

## Files

{file_list}

## Usage

1. Install dependencies: `npm install`
2. Import `App.jsx` as the root component.
3. Styles are in `styles.css` — edit CSS custom properties in `:root` to re-theme.
4. Asset placeholders are in `assets/` — replace with production artwork.

## Customization

- **Colors**: Edit the CSS custom properties in `:root`.
- **Content**: Component data is inline — extract to a data file or API as needed.
- **Layout**: Components use CSS Grid and Flexbox — responsive by default.
"""


def generate_artifacts(run_id: str, objective: str, out_root: Path):
    """Write generated UI artifacts to `out_root / run_id`."""
    idx = int(hashlib.md5(objective.encode()).hexdigest(), 16) % len(TEMPLATES)
    template = TEMPLATES[idx]
    run_dir = out_root / run_id

    all_files: list[str] = []

    # Write code/style files.
    for rel_path, content in template.items():
        text = content.format(objective=objective)
        dest = run_dir / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text)
        all_files.append(rel_path)

    # Write SVG asset placeholders.
    for filename, label, color in _ASSET_SPECS[idx]:
        dest = run_dir / filename
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(_make_svg(label, color))
        all_files.append(filename)

    # Write SKILL.md.
    skill_path = run_dir / "SKILL.md"
    skill_path.write_text(_make_skill_md(objective, all_files))
    all_files.append("SKILL.md")

    return all_files
