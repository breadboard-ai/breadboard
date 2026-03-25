---
name: UI Generator
description:
  Generate multi-file React component bundles with --sys- design tokens
  from natural language descriptions. Supports both single-view components
  and multi-view journey segments driven by XState machines.
---

# UI Generator

You are now acquiring the skill of generating React UI components. After reading
this document, you will know how to produce high-quality, multi-file React
component bundles from natural language descriptions.

## Hard Rules

1. **All colours, spacing, typography, and radii MUST use `--sys-` design
   tokens.** No hex colours, no `rgb()`, no named colours, no raw pixel values.
   Hardcoded values like `#8B6F47` or `color: olive` break the live theme
   system. This is a build error, not a suggestion.
2. **Your output renders inside a host application.** Don't create app names,
   brand headers, splash screens, or taglines. Start with the actual task UI.
   The host provides the chrome.

## What You're Building

A **multi-file React component bundle** rendered in a sandboxed iframe. The
bundle consists of:

- `App.jsx` — the root component that accepts configuration props
- `components/*.jsx` — reusable sub-components
- `styles.css` — shared styles using CSS custom properties

Components use **inline styles** with CSS custom properties from the `--sys-`
design token system. Import resolution between files is handled automatically
by the build pipeline.

## Output Format

Save files as JSX and return all of them as the outcome.

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
   every JSX file. Import sub-components with relative paths (e.g.,
   `import Header from "./components/Header"`).
5. **CSS imports work.** Use `import "./styles.css"` in App.jsx for shared
   styles.
6. **Export default.** Each component file must `export default` its component
   function.

## Configuration Props

When creating a component, think about what data the _caller_ would want to
customise. These become props on `App`:

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

**Reminder: this is a hard rule.** Every visual value — colours, spacing, type,
radii, shadows — MUST use `--sys-` tokens. No exceptions.

### Token Rules

| Category      | Use                                                     | Never                                   |
| ------------- | ------------------------------------------------------- | --------------------------------------- |
| Colours       | `var(--sys-color-...)`                                  | `#hex`, `rgb()`, named colours          |
| Spacing       | `var(--sys-spacing-...)`                                | Raw pixel values for padding/margin/gap |
| Font sizes    | `var(--sys-typescale-...-size)`                          | `14px`, `1rem`                          |
| Border radius | `var(--sys-shape-corner-...)`                           | `12px`, `24px`                          |
| Shadows       | `var(--sys-elevation-...)`                              | Raw `box-shadow` values                 |
| Font family   | `var(--sys-typescale-body-font)` or `mono-font`         | `'Arial'`, `sans-serif`                 |

### Available Tokens

**Colours:** 
* Primary: `--sys-color-primary`, `--sys-color-on-primary`, `--sys-color-primary-container`, `--sys-color-on-primary-container`
* Secondary: `--sys-color-secondary`, `--sys-color-on-secondary`, `--sys-color-secondary-container`, `--sys-color-on-secondary-container`
* Tertiary: `--sys-color-tertiary`, `--sys-color-on-tertiary`, `--sys-color-tertiary-container`, `--sys-color-on-tertiary-container`
* Status: `--sys-color-error`, `--sys-color-on-error`, `--sys-color-background`, `--sys-color-surface`, `--sys-color-surface-variant`, `--sys-color-outline`

**Typography:**
* Font: `--sys-typescale-body-font`, `--sys-typescale-mono-font`
* Body Large: `--sys-typescale-body-large-size`, `-weight`, `-line-height`
* Title Large: `--sys-typescale-title-large-size`, `-weight`, `-line-height`
* Headline Large: `--sys-typescale-headline-large-size`, `-weight`, `-line-height`
* Display Large: `--sys-typescale-display-large-size`, `-weight`, `-line-height`

**Shape:**
`--sys-shape-corner-none` (0px), `...-extra-small` (4px), `...-small` (8px), `...-medium` (12px), `...-large` (16px), `...-extra-large` (28px), `...-full`

**Elevation:** 
`--sys-elevation-level0` to `--sys-elevation-level5`

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

## Multi-View Apps (Segment Mode)

When building UI for an app segment, you are building a **multi-view mini-app**
— one React component per state in the segment's XState machine.

### You're a Segment, Not a Standalone App

Your mini-app is **one segment** of a wider orchestrated app. Between segments,
an LLM orchestrator examines the user's data and decides what comes next:

- **Don't brand it.** No app names, no splash screens, no taglines. The host
  application provides the chrome. Start with the task UI.
- **Emit your data.** The last view in your segment MUST call `opalApi.emit()` to
  hand collected data back to the orchestrator. Without this, the app stalls.
- **Receive context.** Your segment may receive data from prior segments as
  props. Use it to personalise the experience.

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

**Within** the segment, views navigate using `window.opalApi.navigateTo`. At the
**boundary** (the segment's final view), use `window.opalApi.emit` to send data
back to the orchestrator.

The **Opal SDK** is available as `window.opalApi`. It has exactly three methods:

```jsx
// Navigate to another view WITHIN this segment.
window.opalApi.navigateTo("select_models", { teamProfile });

// Send data BACK TO THE ORCHESTRATOR (segment boundary).
// Use on the final view's CTA — this connects segments.
window.opalApi.emit("app:result", { decision, comparisonSet });

// Get an asset URL by reference name.
window.opalApi.asset("logo"); // → "blob:..."
```

**Do not call any other methods on `window.opalApi`.** There is no `onNavigation`,
`subscribe`, or event listener API. Navigation state is managed internally by
your App component (e.g., `useState` + switch statement), not by the SDK.

### View Contract

Each view component receives two props:

- `data` — the context relevant to this state
- `onTransition` — callback for state transitions (wired to opalApi.navigateTo)

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
   `window.opalApi.emit("app:result", data)`.

## 🧪 Self-Verification

Before finalizing your outcome, you have the authority to trigger isolated compilation passes to guarantee your code renders correctly.

1. **Call Isolation Script**: Invoke `system_run_sandboxed_script("ui-generator/bundler.mjs", files={"input.json": "..."})`.
    Construct `input.json` contents as a stringified JSON matching layout:
    ```json
    {
      "files": { "App.jsx": "...", "styles.css": "..." },
      "assets": {}
    }
    ```
2. **Audit Outputs**: The tool returns compiler `stderr` and bundle outputs. Inspect responses and adjust code inside your thought iteration turns to fix missing tags or import bugs safely benchmarks appropriately accurately.

## Available Globals

`React`, `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`,
`useContext`, `useReducer`, `useLayoutEffect`, `memo`, `forwardRef`,
`createContext`, `Fragment`

Generate realistic, plausible sample data — no "Lorem ipsum". Be creative and
visually impressive.
