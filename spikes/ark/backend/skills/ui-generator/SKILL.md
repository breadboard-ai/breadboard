---
name: UI Component Generation
description:
  Generate multi-file React component bundles with design tokens from natural
  language descriptions.
---

# UI Component Generation Skill

You are now acquiring the skill of generating React UI components. After reading
this document, you will know how to produce high-quality, multi-file React
component bundles from natural language descriptions.

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

Save files as jsx and return all of them as the outcome.

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

All visual styling MUST use CSS custom properties with the `--cg-` prefix. These
tokens drive a live theme switcher — any hardcoded value breaks theming.

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

When you produce a `journey.json` alongside UI components, you are building a
**multi-view app** — one React component per state in the state machine.

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

Views transition using the **Ark SDK** available as `window.ark`:

```jsx
// Navigate to another state, passing context data
window.ark.navigateTo("select_models", { teamProfile });

// Final state: emit outcome to the host
window.ark.emit("journey:complete", { decision, comparisonSet });
```

### View Contract

Each view component receives two props:

- `data` — the journey context relevant to this state
- `onTransition` — callback for state transitions (wired to ark.navigateTo)

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

## Available Globals

`React`, `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`,
`useContext`, `useReducer`, `useLayoutEffect`, `memo`, `forwardRef`,
`createContext`, `Fragment`

Generate realistic, plausible sample data — no "Lorem ipsum". Be creative and
visually impressive.
