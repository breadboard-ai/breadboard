---
name: UI Generation
description:
  Technical infrastructure for generating multi-file React component bundles.
  Defines output format, available globals, design tokens, and constraints.
  Aesthetic direction comes from the app skill, not this file.
---

# UI Generation Skill

You are generating a multi-file React component bundle. This skill defines the
**technical rules** — what's available, how to output files, and what constraints
to respect. The visual direction and aesthetic come separately from the app skill.

## Hard Rules

1. **All colors, spacing, typography, and radii MUST use `--cg-` design
   tokens.** No hex colors, no `rgb()`, no named colors, no raw pixel values.
   The design tokens are themeable — hardcoded values break theme switching.
   This is a build error, not a suggestion.
2. **Your output renders inside a host application.** Don't create app names,
   brand headers, splash screens, or taglines. Start with the actual content.
   The host provides the chrome.
3. **Use provided data exactly.** Do not invent additional data items. Do not
   fabricate user names, preferences, budgets, locations, lifestyles, or any
   other personal details. If the personal context is empty, the user is
   anonymous and you know NOTHING about them.
4. **Be discreet.** Never expose reasoning as UI. No sections titled "Agent
   Analysis", "Priority Assessment", "Based on your activity", or
   "Non-Negotiables". Show your understanding through what you include and
   how you rank it, not through meta-commentary.
5. **Responsive by default.** Must work from 320px to 1200px+. Use `clamp()`
   for font sizes, `flex-wrap` or `auto-fit/minmax` for multi-column layouts.
   Test your mental model at 375px, 768px, and 1200px.

## Visual Anti-Patterns

These CSS patterns make generated UI look generic and templated. Avoid all:

- **No left-border accents.** Do not use `border-left: 3px solid ...` on
  callouts or commentary sections. This is the most overused AI pattern.
  Use subtle background tints or `var(--cg-card-bg)` with extra padding.
- **No blockquote callout boxes.** Don't wrap editorial text in bordered
  containers. Inline it naturally into the layout.
- **No uppercase section labels.** Don't use `text-transform: uppercase;
  letter-spacing: 2px` for section headers. Use normal sentence-case
  `var(--cg-text-label-md-size)` labels.
- **No dark gradient overlays on images.** Don't place text on images
  using `linear-gradient(rgba(0,0,0,...))` overlays.
- **No Material Design-style chips as the primary pattern.** Small
  pill-shaped badges are fine for tags, but don't build the entire UI
  out of chips.
- **Use the full palette.** Don't produce a page that is entirely
  grey/beige. Use accent colours to create visual rhythm:
  - **Secondary**: `--cg-color-secondary` / `--cg-color-secondary-container`
    — badges, highlights, attention-drawing elements.
  - **Tertiary**: `--cg-color-tertiary` / `--cg-color-tertiary-container`
    — progress bars, indicators, complementary accents.

## Constraints

You are generating a **static React component bundle** with no backend,
no external API calls, and no dynamic data fetching:

- **No external APIs in your code.** No `fetch()`, no `XMLHttpRequest`.
  The iframe is sandboxed.
- **No routing or navigation.** You're building a single view, not an app
  with pages.
- **Static data.** All data is embedded in the component from the prompt.
- **XState is available** via `require("xstate")` for interactive state
  management if you want expand/collapse, detail views, etc.

## Image Helper

A global `imageUrl(prompt)` function is available at runtime. It returns a
URL string pointing to an image generation endpoint. **Call it as a JavaScript
expression, not a string literal.**

```jsx
// ✓ CORRECT — function call in a JSX expression
const heroSrc = imageUrl("A sunny windowsill with houseplants");
<img src={heroSrc} alt="..." />

// ✓ ALSO CORRECT — inline
<img src={imageUrl("A sunny windowsill with houseplants")} alt="..." />

// ✗ WRONG — literal string in src attribute (will NOT work)
<img src="imageUrl('A sunny windowsill')" alt="..." />
```

Use data `imagePrompt` values exactly as provided. If the data includes
static image paths (e.g. `/images/photo.png`), use those directly instead.

## Available Design Tokens

**Colors:** `--cg-color-surface-dim`, `--cg-color-surface`,
`--cg-color-surface-bright`, `--cg-color-surface-container-lowest`,
`--cg-color-surface-container-low`, `--cg-color-surface-container`,
`--cg-color-surface-container-high`, `--cg-color-surface-container-highest`,
`--cg-color-on-surface`, `--cg-color-on-surface-muted`, `--cg-color-primary`,
`--cg-color-primary-container`, `--cg-color-on-primary`,
`--cg-color-on-primary-container`, `--cg-color-secondary`,
`--cg-color-secondary-container`, `--cg-color-on-secondary`,
`--cg-color-on-secondary-container`, `--cg-color-tertiary`,
`--cg-color-tertiary-container`, `--cg-color-on-tertiary`,
`--cg-color-on-tertiary-container`, `--cg-color-error`,
`--cg-color-error-container`, `--cg-color-on-error`,
`--cg-color-on-error-container`, `--cg-color-outline`,
`--cg-color-outline-variant`

**Typography:** `--cg-font-sans`, `--cg-font-serif`, `--cg-font-mono`,
`--cg-text-display-{lg,md,sm}-{size,line-height,weight}`,
`--cg-text-headline-{lg,md,sm}-{size,line-height,weight}`,
`--cg-text-title-{lg,md,sm}-{size,line-height,weight}`,
`--cg-text-body-{lg,md,sm}-{size,line-height,weight}`,
`--cg-text-label-{lg,md,sm}-{size,line-height,weight}`

**Spacing (4px grid):** `--cg-sp-0` through `--cg-sp-16`

**Radius:** `--cg-radius-{xs,sm,md,lg,xl,full}`

**Elevation:** `--cg-elevation-{1,2,3}`

**Motion:** `--cg-motion-duration-{short,medium,long}`,
`--cg-motion-easing-{standard,decel,accel}`

**Component tokens:** Card: `--cg-card-{bg,radius,padding,shadow}`, Button:
`--cg-button-{radius,padding,bg,color,font-size,font-weight}`, Input:
`--cg-input-{bg,border,radius,padding,color,placeholder}`, Badge:
`--cg-badge-{bg,color,radius,padding,font-size}`, Divider:
`--cg-divider-{color,thickness,style}`

**Expressive:** `--cg-border-{style,width}`,
`--cg-heading-{transform,letter-spacing,font-style}`,
`--cg-img-{radius,border,shadow,filter}`,
`--cg-hover-{scale,brightness,shadow}`

> **Token Discipline:** Every visual property that has a `--cg-*` token MUST
> use that token. Never hardcode hex colors, font families, border-radius
> values, box-shadows, or spacing. Use `var(--cg-font-serif)` for serif
> type, not `"Georgia"`. Use `var(--cg-text-display-lg-size)` for large
> type, not `clamp(4rem, ...)`. This is non-negotiable — hardcoded values
> break theme switching.

## Available Globals

`React`, `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`,
`useContext`, `useReducer`, `useLayoutEffect`, `memo`, `forwardRef`,
`createContext`, `Fragment`, `imageUrl`

Google Material Symbols Outlined is available:

```jsx
<span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
  search
</span>
```

## Output Format

Before writing code, output a brief `<thinking>` block (max 3–4 sentences)
explaining your approach: what layout you'll use, which items you'll
highlight, and how the personal context informed your choices.

Then return each file in a fenced code block with the filename as the
language identifier:

    ```App.jsx
    // ... code ...
    ```

    ```styles.css
    /* ... styles ... */
    ```

    ```sections/FeatureSection.jsx
    // ... code ...
    ```

### Rules

1. **App.jsx is the entry point.** Named exactly `App.jsx`, function `App`.
2. **All data embedded as defaults.** The component renders standalone.
3. **Sub-components live in `sections/`.** One per layout section.
4. **Every file imports React.** Include `import React from "react"`.
5. **CSS imports work.** Use `import "./styles.css"` in App.jsx.
6. **Export default.** Each file exports its component.

## Component Design

### Decomposition

- **Compose, don't monolith.** Break the UI into focused sub-components.
- **Each component renders standalone** with realistic defaults.
- **The top-level App composes everything** into a cohesive layout.

### Interactivity

Components should be interactive where appropriate. Use `useState`, `useEffect`
with cleanup. Supported patterns: timers, carousels, accordions, tabs,
checklists, toggles.

### Stable Defaults

Never use `Date.now()`, `Math.random()`, or `new Date()` in default parameters.
Compute once at module level or use `useState(() => ...)`.
