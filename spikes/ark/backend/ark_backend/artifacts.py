"""Artifact templates for simulated UI generation runs.

Each template is a dict mapping relative file paths to their content.
The `generate_artifacts` function picks a template based on the objective
and customizes it with the run's objective and ID.

Media assets (images, video, audio) are served by the frontend from a
well-known base path. Both backend templates and the frontend agree on
the path `/assets/media/`.
"""

from pathlib import Path

# The well-known base URL where the frontend serves shared media files.
# This path is relative to the frontend origin (Vite serves public/ at /).
MEDIA_BASE = "/assets/media"

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

export default function Header({{ title }}) {{
  return (
    <header className="header">
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

export default function Hero({{ headline }}) {{
  return (
    <section className="hero">
      <div className="hero-text">
        <h1>{{headline}}</h1>
        <p>Build something extraordinary with a single prompt.</p>
        <button className="cta-btn">Get Started</button>
      </div>
      <img src="{media_base}/exterior.jpg" alt="Hero" className="hero-img" />
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
.hero-img {{ width: 320px; height: 240px; border-radius: 12px; object-fit: cover; }}

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

const links = ["General", "Profile", "Notifications", "Security", "Billing"];

export default function Sidebar() {{
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
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

    # ── Template 3: House Hunter ───────────────────────────────
    {
        "App.jsx": """\
import React from "react";
import Header from "./components/Header";
import ListingGallery from "./components/ListingGallery";
import VirtualTour from "./components/VirtualTour";
import AgentVoiceover from "./components/AgentVoiceover";
import "./styles.css";

export default function App() {{
  return (
    <div className="house-hunter">
      <Header title="{objective}" />
      <main className="hh-body">
        <ListingGallery />
        <VirtualTour />
        <AgentVoiceover />
      </main>
    </div>
  );
}}
""",
        "components/Header.jsx": """\
import React from "react";

export default function Header({{ title }}) {{
  return (
    <header className="hh-header">
      <h1>{{title}}</h1>
      <nav className="hh-nav">
        <a href="#listings">Listings</a>
        <a href="#tour">Tour</a>
        <a href="#contact">Contact</a>
      </nav>
    </header>
  );
}}
""",
        "components/ListingGallery.jsx": """\
import React from "react";

const photos = [
  {{ src: "{media_base}/exterior.jpg", alt: "Exterior view", caption: "Front of property" }},
  {{ src: "{media_base}/interior.jpg", alt: "Interior view", caption: "Open-plan living area" }},
  {{ src: "{media_base}/backyard.jpg", alt: "Backyard", caption: "Landscaped garden" }},
];

export default function ListingGallery() {{
  return (
    <section className="gallery" id="listings">
      <h2>Property Photos</h2>
      <div className="gallery-grid">
        {{photos.map((p) => (
          <figure key={{p.alt}} className="gallery-item">
            <img src={{p.src}} alt={{p.alt}} />
            <figcaption>{{p.caption}}</figcaption>
          </figure>
        ))}}
      </div>
    </section>
  );
}}
""",
        "components/VirtualTour.jsx": """\
import React from "react";

export default function VirtualTour() {{
  return (
    <section className="virtual-tour" id="tour">
      <h2>Virtual Tour</h2>
      <video controls className="tour-video">
        <source src="{media_base}/tour.mp4" type="video/mp4" />
        Your browser does not support video playback.
      </video>
    </section>
  );
}}
""",
        "components/AgentVoiceover.jsx": """\
import React from "react";

export default function AgentVoiceover() {{
  return (
    <section className="voiceover">
      <h2>Agent's Walkthrough</h2>
      <p>Listen to your agent describe the key features of this property.</p>
      <audio controls className="voiceover-player">
        <source src="{media_base}/narration.mp3" type="audio/mpeg" />
        Your browser does not support audio playback.
      </audio>
    </section>
  );
}}
""",
        "styles.css": """\
:root {{
  --primary: #b45309;
  --surface: #fffbeb;
  --text: #451a03;
  --border: #fde68a;
  --accent: #d97706;
}}

body {{ margin: 0; font-family: system-ui, sans-serif; color: var(--text); }}

.house-hunter {{ min-height: 100vh; background: var(--surface); }}

.hh-header {{
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem 2rem; background: white; border-bottom: 1px solid var(--border);
}}
.hh-header h1 {{ flex: 1; font-size: 1.25rem; }}
.hh-nav {{ display: flex; gap: 1rem; }}
.hh-nav a {{ text-decoration: none; color: var(--primary); }}

.hh-body {{ padding: 2rem; max-width: 900px; margin: 0 auto; }}

.gallery h2 {{ font-size: 1.3rem; margin-bottom: 1rem; }}
.gallery-grid {{
  display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem; margin-bottom: 2rem;
}}
.gallery-item {{
  margin: 0; border-radius: 8px; overflow: hidden;
  border: 1px solid var(--border); background: white;
}}
.gallery-item img {{ width: 100%; height: 160px; object-fit: cover; }}
.gallery-item figcaption {{ padding: 0.5rem 0.75rem; font-size: 0.85rem; }}

.virtual-tour {{ margin-bottom: 2rem; }}
.virtual-tour h2 {{ font-size: 1.3rem; margin-bottom: 1rem; }}
.tour-video {{ width: 100%; border-radius: 8px; background: #000; }}

.voiceover {{ margin-bottom: 2rem; }}
.voiceover h2 {{ font-size: 1.3rem; margin-bottom: 0.5rem; }}
.voiceover p {{ font-size: 0.95rem; opacity: 0.7; margin-bottom: 0.75rem; }}
.voiceover-player {{ width: 100%; }}
""",
    },

    # ── Template 4: Personal Chef ──────────────────────────────
    {
        "App.jsx": """\
import React from "react";
import Header from "./components/Header";
import RecipeCard from "./components/RecipeCard";
import CookingVideo from "./components/CookingVideo";
import NarrationPlayer from "./components/NarrationPlayer";
import "./styles.css";

export default function App() {{
  return (
    <div className="personal-chef">
      <Header title="{objective}" />
      <main className="chef-body">
        <RecipeCard />
        <CookingVideo />
        <NarrationPlayer />
      </main>
    </div>
  );
}}
""",
        "components/Header.jsx": """\
import React from "react";

export default function Header({{ title }}) {{
  return (
    <header className="chef-header">
      <h1>{{title}}</h1>
      <nav className="chef-nav">
        <a href="#recipe">Recipe</a>
        <a href="#video">Video</a>
        <a href="#narration">Narration</a>
      </nav>
    </header>
  );
}}
""",
        "components/RecipeCard.jsx": """\
import React from "react";

export default function RecipeCard() {{
  return (
    <section className="recipe-card" id="recipe">
      <div className="recipe-hero">
        <img src="{media_base}/dish.jpg" alt="Finished dish" className="dish-photo" />
      </div>
      <div className="recipe-details">
        <h2>Pan-Seared Salmon with Lemon Dill</h2>
        <p className="recipe-meta">⏱ 25 min · 🍽 2 servings · ⭐ 4.8</p>
        <h3>Ingredients</h3>
        <img src="{media_base}/ingredients.jpg" alt="Ingredients" className="ingredients-img" />
        <ul className="ingredient-list">
          <li>2 salmon fillets (6 oz each)</li>
          <li>2 tbsp olive oil</li>
          <li>1 lemon, sliced</li>
          <li>Fresh dill sprigs</li>
          <li>Salt and pepper to taste</li>
        </ul>
      </div>
    </section>
  );
}}
""",
        "components/CookingVideo.jsx": """\
import React from "react";

export default function CookingVideo() {{
  return (
    <section className="cooking-video" id="video">
      <h2>Step-by-Step Video</h2>
      <video controls className="video-player">
        <source src="{media_base}/tour.mp4" type="video/mp4" />
        Your browser does not support video playback.
      </video>
    </section>
  );
}}
""",
        "components/NarrationPlayer.jsx": """\
import React from "react";

export default function NarrationPlayer() {{
  return (
    <section className="narration" id="narration">
      <h2>Chef's Commentary</h2>
      <p>Listen to the chef explain each technique as you cook along.</p>
      <audio controls className="narration-player">
        <source src="{media_base}/narration.mp3" type="audio/mpeg" />
        Your browser does not support audio playback.
      </audio>
    </section>
  );
}}
""",
        "styles.css": """\
:root {{
  --primary: #15803d;
  --surface: #f0fdf4;
  --text: #14532d;
  --border: #bbf7d0;
  --accent: #16a34a;
}}

body {{ margin: 0; font-family: system-ui, sans-serif; color: var(--text); }}

.personal-chef {{ min-height: 100vh; background: var(--surface); }}

.chef-header {{
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem 2rem; background: white; border-bottom: 1px solid var(--border);
}}
.chef-header h1 {{ flex: 1; font-size: 1.25rem; }}
.chef-nav {{ display: flex; gap: 1rem; }}
.chef-nav a {{ text-decoration: none; color: var(--primary); }}

.chef-body {{ padding: 2rem; max-width: 800px; margin: 0 auto; }}

.recipe-card {{ margin-bottom: 2rem; }}
.recipe-hero {{ margin-bottom: 1rem; }}
.dish-photo {{ width: 100%; height: 280px; object-fit: cover; border-radius: 12px; }}
.recipe-meta {{ font-size: 0.9rem; opacity: 0.7; margin: 0.5rem 0 1rem; }}
.ingredients-img {{ width: 100%; max-height: 120px; object-fit: cover; border-radius: 8px; margin: 0.5rem 0; }}
.ingredient-list {{ padding-left: 1.25rem; }}
.ingredient-list li {{ padding: 0.25rem 0; }}

.cooking-video {{ margin-bottom: 2rem; }}
.cooking-video h2 {{ font-size: 1.3rem; margin-bottom: 1rem; }}
.video-player {{ width: 100%; border-radius: 8px; background: #000; }}

.narration {{ margin-bottom: 2rem; }}
.narration h2 {{ font-size: 1.3rem; margin-bottom: 0.5rem; }}
.narration p {{ font-size: 0.95rem; opacity: 0.7; margin-bottom: 0.75rem; }}
.narration-player {{ width: 100%; }}
""",
    },
]


# ---------------------------------------------------------------------------
# Media file inventory — shared between backend and frontend
# ---------------------------------------------------------------------------

# Files the frontend serves from public/assets/media/.
# Referenced in templates via {media_base} and documented in SKILL.md.
MEDIA_FILES = [
    ("exterior.jpg",    "image/jpeg",  "Exterior property photo"),
    ("interior.jpg",    "image/jpeg",  "Interior property photo"),
    ("backyard.jpg",    "image/jpeg",  "Backyard / garden photo"),
    ("dish.jpg",        "image/jpeg",  "Finished dish photo"),
    ("ingredients.jpg", "image/jpeg",  "Ingredients layout photo"),
    ("tour.mp4",        "video/mp4",   "Virtual tour / demo video"),
    ("narration.mp3",   "audio/mpeg",  "Agent voiceover / narration audio"),
]

# Which media files each template references.
_TEMPLATE_MEDIA: list[list[str]] = [
    # 0: Dashboard — no media
    [],
    # 1: Landing — hero image
    ["exterior.jpg"],
    # 2: Admin — no media
    [],
    # 3: House Hunter — images + video + audio
    ["exterior.jpg", "interior.jpg", "backyard.jpg", "tour.mp4", "narration.mp3"],
    # 4: Personal Chef — images + video + audio
    ["dish.jpg", "ingredients.jpg", "tour.mp4", "narration.mp3"],
]


# ---------------------------------------------------------------------------
# SKILL.md generation
# ---------------------------------------------------------------------------


def _make_skill_md(objective: str, files: list[str], media_refs: list[str]) -> str:
    sections = []
    sections.append(f"# Generated UI: {objective}\n")
    sections.append(f"## Overview\n\nThis UI was generated for the objective: **{objective}**.\n")

    # Code files.
    sections.append("## Files\n")
    sections.append("\n".join(f"- `{f}`" for f in sorted(files)))
    sections.append("")

    # Media dependencies.
    if media_refs:
        media_lookup = {m[0]: m for m in MEDIA_FILES}
        sections.append("## Media Dependencies\n")
        sections.append(
            "These files are served by the frontend at the well-known path "
            f"`{MEDIA_BASE}/`. The JSX components reference them directly.\n"
        )
        for filename in media_refs:
            meta = media_lookup.get(filename)
            if meta:
                sections.append(f"- `{MEDIA_BASE}/{filename}` ({meta[1]}) — {meta[2]}")
        sections.append("")

    sections.append("""## Usage

1. Install dependencies: `npm install`
2. Import `App.jsx` as the root component.
3. Styles are in `styles.css` — edit CSS custom properties in `:root` to re-theme.
4. Media assets are served from `{media_base}` — see Media Dependencies above.

## Customization

- **Colors**: Edit the CSS custom properties in `:root`.
- **Content**: Component data is inline — extract to a data file or API as needed.
- **Layout**: Components use CSS Grid and Flexbox — responsive by default.
- **Media**: Replace referenced media files at the well-known paths.
""".format(media_base=MEDIA_BASE))
    return "\n".join(sections)


# ---------------------------------------------------------------------------
# Template selection
# ---------------------------------------------------------------------------

_next_template_idx = 0

# First-word → template index mapping (case-insensitive).
_KEYWORD_MAP: dict[str, int] = {
    "dashboard": 0,
    "landing": 1,
    "admin": 2,
    "settings": 2,
    "house": 3,
    "property": 3,
    "chef": 4,
    "recipe": 4,
    "cook": 4,
}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def generate_artifacts(run_id: str, objective: str, out_root: Path):
    """Write generated UI artifacts to `out_root / run_id`."""
    global _next_template_idx

    first_word = objective.strip().split()[0].lower() if objective.strip() else ""
    if first_word in _KEYWORD_MAP:
        idx = _KEYWORD_MAP[first_word]
    else:
        idx = _next_template_idx % len(TEMPLATES)
        _next_template_idx += 1

    template = TEMPLATES[idx]
    media_refs = _TEMPLATE_MEDIA[idx]
    run_dir = out_root / run_id

    all_files: list[str] = []

    # Write code/style files, substituting objective and media base URL.
    for rel_path, content in template.items():
        text = content.format(objective=objective, media_base=MEDIA_BASE)
        dest = run_dir / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(text)
        all_files.append(rel_path)

    # Write SKILL.md.
    skill_path = run_dir / "SKILL.md"
    skill_path.write_text(_make_skill_md(objective, all_files, media_refs))
    all_files.append("SKILL.md")

    return all_files
