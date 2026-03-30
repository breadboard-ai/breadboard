---
name: editorial-designer
title: Editorial Digest Design
description:
  Magazine-style layout principles for curated editorial digests. Defines
  layout sections, visual anti-patterns, and narrative prioritization rules.
  Pairs with ui-generator for technical constraints.
---

# Editorial Digest Design Skill

You are designing an **editorial digest** — a curated, magazine-style React
application that presents the user's active work as a narrative experience.
This skill defines the **visual language and layout rules**. Technical
constraints (design tokens, responsive mechanics, output format) come from the
`ui-generator` skill.

## Narrative Framing

Curate the digest in terms of the **user's life and goals**, not in terms of
apps and features. Interpret app updates as reflections of their current focus
and priorities. Present information seamlessly — never expose backend mechanics
(no "ticket", "effort", or raw IDs like "722d6941").

## Anti-Patterns — NEVER DO THESE

1. **NO GRID OF CARDS.** Never render apps as same-sized cards in a CSS grid or
   flexbox wrap. This is a briefing, not a dashboard.
2. **NO UNIFORM COMPONENTS.** Urgent items, feature items, and quiet items MUST
   use fundamentally different visual treatments.
3. **NO CARD BORDERS OR SHADOWS.** Content should float on the page, separated
   by whitespace and typography, not boxes.
4. **NO LEFT-BORDER ACCENTS** for status.
5. **NO DARK GRADIENT OVERLAYS** on images.
6. **NO IMAGES.** Do everything with clever use of layout and typography.

## Editorial Design Techniques

Use **at least 4** of these in every layout:

- **Pull Quotes**: Massive decorative quotes (50pt+ thin serif italic) for
  urgent or emotional lines.
- **Asymmetric Columns**: Offset columns of different widths (e.g., narrow
  attention column beside a wide feature column).
- **Oversized Typography**: Massive type (80pt condensed caps) for section
  transitions.
- **Layering**: Elements intentionally overlap to create depth.
- **Whitespace as Design**: Generous gaps (80px+) between sections.
- **Mixed Typography**: `var(--cg-font-serif)` for headlines and quotes,
  `var(--cg-font-sans)` for body text.

## Layout Sections & Prioritization

### Stability

While content updates, the overall hierarchy must remain recognizable. Do not
radically reinvent the page layout on every update.

### Fight Recency Bias

A massive, ongoing project from yesterday carries much more narrative weight
than a trivial task completed 5 minutes ago. Reserve the prominence of the
Feature Spread for major projects, REGARDLESS of when they were started or last
updated. Never displace or hide major ongoing work just because a new minor task
arrived.

### Retain All Active Work

You MUST summarize and include every single project or task that is still active
from the previous digest. Do not drop items just because they were not mentioned
in the most recent context update.

### Organize by Narrative Importance

| Section            | Purpose                                                            | Treatment                                    |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------- |
| **Attention Line** | 3–4 items requiring immediate input or short-term focus            | Inline rich text (flowing sentences, NOT cards). Prioritize blocked/critical tasks over trivial updates. |
| **Feature Spread** | ONE item gets the cinematic full-bleed cover story                 | Highest-scope project, even older ones.      |
| **Progress Ticker**| Compact horizontal strip of ALL other active items                 | Concise, scannable.                          |
| **Quiet Corner**   | Completed or idle items                                            | De-emphasized using muted typography.        |

## Content Integrity

1. **No branding.** Do not brand the UI with product names or agent names. This
   is the user's personal space.
2. **No hallucinated features.** Do not invent buttons, links, or features
   (like "Build Progress Tracker") that do not exist.
3. **Real CTAs only.** If a context update mentions `navigateTo('id')`, create a
   real CTA button that calls
   `if (window.opalSDK) window.opalSDK.navigateTo('id')`. Never invent fake
   navigation targets.
