---
name: ui-generator
title: UI Component Generation
description:
  Generate multi-file React component bundles with design tokens from natural
  language descriptions.
---

# UI Component Generation Skill

You are now acquiring the skill of generating React UI components. After reading
this document, you will know how to produce high-quality, multi-file React
component bundles from natural language descriptions.

## Hard Rules

1. **All colors, spacing, typography, and radii MUST use `--cg-` design
   tokens.** No hex colors, no `rgb()`, no named colors, no raw pixel values.
   Hardcoded values like `#8B6F47` or `color: olive` break the live theme
   switcher. This is a build error, not a suggestion.
2. **Your output renders inside a host application.** Don't create app names,
   brand headers, splash screens, or taglines. Start with the actual task UI.
   The host provides the chrome.
3. **No client storage APIs.** Do not use `localStorage`, `sessionStorage`,
   `IndexedDB`, or any Web Storage APIs. The iframe environment may not have
   storage access due to origin restrictions. All state lives in React component
   state or is passed via props and the SDK.

## What You're Building

A **multi-file React component bundle** rendered in a sandboxed iframe. The
bundle consists of:

- `App.jsx` — the root component that accepts configuration props
- `components/*.jsx` — reusable sub-components
- `styles.css` — shared styles using CSS custom properties

Components use **inline styles** with CSS custom properties from a design token
system. Import resolution between files is handled automatically by the build
pipeline.

## Output Format

You MUST save all generated files to the real filesystem in your working directory (`$HOME`) by using the `execute_bash` tool. **Do NOT use `system_write_file`**, because it writes to a virtual filesystem that the bundler cannot access.

Use bash heredocs to write files. Example:
```bash
cat << 'EOF' > App.jsx
import React from "react";
export default function App() { ... }
EOF
```

After safely writing all files using `execute_bash`, you MUST build the bundle by running the following command via `execute_bash`: 
`node $HOME/skills/ui-generator/tools/bundler.mjs`

Once bundling is successful, simply return a short text confirmation
acknowledging that the UI was generated and bundled. **Do NOT output raw source
code in your response.**

## Component Library

Before generating sub-components, check `/mnt/library/` for existing components
from previous runs. Each subdirectory is a previous run, containing its
`App.jsx` and `components/*.jsx`.

**Reuse workflow:**

1. Use `system_read_text_from_file` to list `/mnt/library/` and browse available
   components.
2. If a component matches what you need (e.g., a `PieChart`, `Header`), **just
   import it** — `import PieChart from "./components/PieChart"`. You do NOT need
   to save the file; the build pipeline resolves library components
   automatically.
3. Only generate a new component from scratch when nothing in the library fits.
4. You may adapt a library component by reading it, modifying it, and saving the
   modified version to your output.

When you reuse a component, include a comment at the top:
`// Reused from: library/<run-id>/<filename>`

### Rules

1. **App.jsx is the entry point.** It must be named exactly `App.jsx` and
   contain a function called `App`.
2. **App carries the configuration.** All data that should be configurable by
   the caller (location, users, items, dates, etc.) appears as props on `App`
   with realistic defaults.
3. **Sub-components are reusable.** Each component in `components/` should
   render standalone with sensible defaults. Document all props with `@prop`
   JSDoc.
4. **Every file imports what it uses.** Include `import React from "react"` in
   every JSX file. Import sub-components with relative paths (e.g.
   `import Header from "./components/Header"`).
5. **CSS imports work.** Use `import "./styles.css"` in App.jsx for shared
   styles.
6. **Export default.** Each component file must `export default` its component
   function.

## Configuration Props

When creating a component, think about what data the _caller_ would want to
customize. These become props on `App`:

| UI Type             | Example Props                                              |
| ------------------- | ---------------------------------------------------------- |
| Weather dashboard   | `location`, `temperature`, `condition`, `forecast` (array) |
| User profile        | `name`, `avatar`, `bio`, `stats` (object)                  |
| Product card        | `title`, `price`, `image`, `rating`, `reviews`             |
| Task manager        | `tasks` (array), `categories`, `user`                      |
| Analytics dashboard | `metrics` (array), `timeRange`, `chartData`                |

All props MUST have realistic default values so the component renders standalone
with zero configuration.

## Design Token System

**Reminder: this is a hard rule (see above).** Every visual value — colors,
spacing, type, radii, shadows — MUST use `--cg-` tokens. No exceptions.

### Token Rules

| Category      | Use                                                  | Never                                   |
| ------------- | ---------------------------------------------------- | --------------------------------------- |
| Colors        | `var(--cg-color-...)`                                | `#hex`, `rgb()`, named colors           |
| Spacing       | `var(--cg-sp-...)`                                   | Raw pixel values for padding/margin/gap |
| Font sizes    | `var(--cg-text-...-size)`                            | `14px`, `1rem`                          |
| Border radius | `var(--cg-radius-...)` or `var(--cg-card-radius)`    | `12px`, `24px`                          |
| Shadows       | `var(--cg-elevation-...)` or `var(--cg-card-shadow)` | Raw `box-shadow` values                 |
| Font family   | `var(--cg-font-sans)` or `var(--cg-font-mono)`       | `'Arial'`, `sans-serif`                 |

### Available Tokens

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

**Typography:** `--cg-font-sans`, `--cg-font-mono`,
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
`--cg-heading-{transform,letter-spacing}`,
`--cg-img-{radius,border,shadow,filter}`, `--cg-hover-{scale,brightness,shadow}`

## Component Design

### Decomposition

- **Compose, don't monolith.** A dashboard should be built from `Header`,
  `MetricsGrid`, `ForecastCard`, etc.
- **Each component renders standalone** with realistic defaults.
- **The top-level App composes everything** into a cohesive layout.

### Icons

Google Material Symbols Outlined is available:

```jsx
<span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
  search
</span>
```

### Interactivity

Components should be interactive where appropriate. Use `useState`, `useEffect`
with cleanup. Supported patterns: timers, carousels, accordions, tabs,
checklists, toggles.

### Stable Defaults

Never use `Date.now()`, `Math.random()`, or `new Date()` in default parameters.
Compute once at module level or use `useState(() => ...)`.

## Multi-View Apps (Journey Mode)

When building UI for a journey segment, you are building a **multi-view
mini-app** — one React component per state in the segment's XState machine.

### Critical: You're a Segment, Not a Standalone App

Your mini-app is **one segment** of a wider orchestrated journey. Between
segments, an LLM orchestrator examines the user's data and decides what comes
next. This means:

- **Don't brand it.** No app names, no splash screens, no taglines. The host
  application provides the chrome and framing. Start with the task UI.
- **Emit your data.** The last view in your segment MUST call `ark.emit()` to
  hand collected data back to the orchestrator. Without this, the journey
  stalls.
- **Receive context.** Your segment may receive data from prior segments as
  props. Use it to personalize the experience.

### File Structure

Each state gets its own component file named after the state:

- `App.jsx` — shell that renders the initial state
- `views/InputRequirements.jsx` — one view per state
- `views/SelectModels.jsx`
- `views/DetailedComparison.jsx`
- `views/DecisionReport.jsx`
- `components/*.jsx` — shared sub-components (reusable across views)
- `styles.css` — shared styles

### Navigation

**Within** the segment, views navigate using `window.opalSDK.navigateTo`. At the
**boundary** (the segment's final view), use `window.opalSDK.emit` to send data
back to the orchestrator.

The **SDK** is available as `window.opalSDK`. It has exactly three methods:

```jsx
// Navigate to another view WITHIN this segment.
window.opalSDK.navigateTo("select_models", { teamProfile });

// Send data BACK TO THE ORCHESTRATOR (segment boundary).
// Use on the final view's CTA — this is what connects segments.
window.opalSDK.emit("journey:result", { decision, comparisonSet });

// Get an asset URL by reference name.
window.opalSDK.asset("logo"); // → "blob:..."
```

**Do not call any other methods on `window.opalSDK`.** There is no
`onNavigation`, `subscribe`, or event listener API. Navigation state is managed
internally by your App component (e.g. `useState` + switch statement), not by
the SDK.

### View Contract

Each view component receives two props:

- `data` — the journey context relevant to this state
- `onTransition` — callback for state transitions (wired to
  `window.opalSDK.navigateTo`)

```jsx
export default function SelectModels({ data = {}, onTransition }) {
  const handleSelect = (item) => {
    onTransition("detailed_comparison", {
      ...data,
      shortlist: [...(data.shortlist || []), item],
    });
  };
  // ...
}
```

### Rules

1. **One view per state.** Don't merge states into a single component.
2. **Views are self-contained.** Each view renders standalone with defaults.
3. **Shared components go in `components/`.** Headers, cards, buttons used
   across multiple views should be extracted.
4. **Context flows forward.** Each transition carries the data the next view
   needs. Views never fetch — they receive.
5. **Final view emits.** The last view must include a CTA that calls
   `window.opalSDK.emit("journey:result", data)` with the data the orchestrator
   needs to decide what happens next.

## Building Your Output

- **You MUST ALWAYS write your source files (e.g. `App.jsx`, `styles.css`) to disk using `execute_bash` (e.g. `cat << 'EOF' > ...`) BEFORE running the bundler.**
- **You MUST ALWAYS build the bundle using the `execute_bash` tool** after writing your code to disk.
- Specifically, use the `execute_bash` tool with the `command` argument set to `node $HOME/skills/ui-generator/tools/bundler.mjs`. This generates an optimized `bundle.js` and `bundle.css` in your working directory, ready for the iframe to render.
- Do NOT use hallucinated tools like `generate_and_execute_code` or `system_write_file`. Ensure all operations happen on the real filesystem via `execute_bash`.

## Available Globals

`React`, `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`,
`useContext`, `useReducer`, `useLayoutEffect`, `memo`, `forwardRef`,
`createContext`, `Fragment`

Be creative and visually impressive.
