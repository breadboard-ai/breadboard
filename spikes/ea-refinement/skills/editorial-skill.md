---
name: Editorial Briefing
description:
  Art direction for presenting user data as a personal morning briefing.
  Defines editorial techniques, layout sections, anti-patterns, and tone.
  Technical infrastructure comes from the UI Skill, not this file.
---

# Editorial Briefing Skill

Present the user's active playbooks as a personal morning briefing — an
**editorial layout** with high-end magazine art direction — warm, confident,
unhurried.

## CRITICAL Anti-Patterns — NEVER DO THESE

These are the patterns that make outputs look generic and boring.
**Violating any of these is a failure.**

1. **NO GRID OF CARDS.** Never render all playbooks as same-sized cards in a
   CSS grid or flexbox wrap. This is a dashboard, not a briefing. Each item
   must receive treatment proportional to its urgency and narrative weight.

2. **NO UNIFORM COMPONENTS.** You must NOT render all playbooks using the
   same component at different sizes. Urgent items, feature items, progress
   items, and quiet items MUST use fundamentally different visual treatments.

3. **NO CARD BORDERS OR SHADOWS.** Do not put cards in rounded-rectangle
   containers with shadows. Content should float on the page, separated by
   whitespace and typography, not boxes.

4. **NO LEFT-BORDER ACCENTS.** No `border-left: 3px solid ...` for status.

5. **NO DARK GRADIENT OVERLAYS.** Don't slap a black gradient on images.

## Editorial Design Techniques — USE THESE

These are the techniques that make the output feel designed, not generated.
**Use at least 4 of these in every layout.**

### Overlapping Text on Images
Place bold white or light text directly ON TOP of full-bleed images using
`position: absolute` or negative margins. The text starts on the image and
flows below it. This creates depth and editorial confidence.

### Pull Quotes
Massive decorative quotes (50pt+ thin serif italic) that bleed off one edge
of the layout or cut across content sections. Use them for the most urgent
or emotionally resonant line from a playbook.

### Full-Bleed Images
At least one image goes completely edge-to-edge — no padding, no border
radius, no margins. It should feel cinematic.

### Asymmetric Columns
Content flows in offset columns of different widths. A narrow attention
column beside a wide feature column. Columns are NOT aligned to a grid.

### Oversized Typography
Section transitions use deliberately massive type (display-lg tokens or
larger via custom `font-size`). The type itself IS the design element.
"WEDNESDAY" in 80pt condensed caps over a hero image.

### Layering
Elements intentionally overlap: a chip sits half on a photo, a summary
block straddles the boundary between an image and the content below,
a vertical label runs sideways along the margin.

### Whitespace as Design
Generous gaps between sections (80px+). Sparse areas feel intentional,
like a luxury brand. Don't fill every pixel.

### Mixed Typography Families
Use `var(--cg-font-serif)` for headlines, pull quotes, and editorial
commentary. Use `var(--cg-font-sans)` for body text, labels, and action
items. The contrast creates editorial sophistication.

### Vertical/Rotated Text
Section labels or category names running vertically along the left margin
using `writing-mode: vertical-rl` or `transform: rotate(-90deg)`.

## Layout Sections

Organize the playbooks into these semantic sections. Different urgency
demands fundamentally different rendering:

### Attention Line
3-4 urgent items rendered as **inline rich text** — flowing sentences with
embedded action chips. NOT cards. "The address change deadline is Friday —
DMV and two utility companies still pending." Each item is a paragraph
with a small pill button at the end.

### Feature Spread
ONE item gets the cinematic treatment: full-bleed image with overlapping
headline, editorial paragraph, generous breathing room. This is the
"cover story" of the briefing.

### Progress Ticker
Compact horizontal strip of items that are running or progressing well.
Could be a single line of monospaced text: "health ↑ · hawk #47 ·
sourdough timer saved" — like a stock ticker or news crawl.

### Quiet Corner
Completed or idle items as minimal gray text. A simple list, small type,
checkmarks. No visual weight. These are footnotes.

## Tone

Think like a confident art director presenting to a creative brief.
This isn't a wireframe or a prototype. This is a finished,
polished editorial layout that happens to be generated. It should
look like it belongs in a design portfolio.
