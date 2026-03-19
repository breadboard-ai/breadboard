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

## Hard Rules

1. **All colors, spacing, typography, and radii MUST use `--cg-` design
   tokens.** No hex colors, no `rgb()`, no named colors, no raw pixel values.
   Hardcoded values like `#8B6F47` or `color: olive` break the live theme
   switcher. This is a build error, not a suggestion.
2. **Your output renders inside a host application.** Don't create app names,
   brand headers, splash screens, or taglines. Start with the actual task UI.
   The host provides the chrome.
3. **NEVER invent context that wasn't provided.** Do not fabricate user names,
   preferences, budgets, locations, lifestyles, or any other personal details.
   If the personal context is empty, the user is anonymous and you know
   NOTHING about them. Your output must reflect only what you were told.
4. **Be discreet.** Never expose your reasoning process as UI. No sections
   titled "Agent Analysis", "Non-Negotiables", "Why this fits", "Priorities",
   or "Compromises". No subtitles like "Curated for X, Y, and Z" or
   "Based on your preferences". Show your understanding through what you
   include and how you rank it, not through meta-commentary.
5. **Use provided image paths exactly.** The dataset includes image paths
   like `/images/property-1.png`. These are real files. Use them as-is in
   `<img>` tags. Never substitute with Unsplash, placeholder, or invented
   URLs.
6. **Responsive by default.** The UI must work on mobile (320px) through
   desktop (1200px+). Use CSS flexbox/grid with wrapping, relative units,
   and sensible breakpoints. A single rigid two-column layout is not
   acceptable.

## Constraints

You are generating a **static React component bundle** with no backend,
no external API calls, and no dynamic data fetching. This means:

- **Use widgets for maps and charts.** Don't draw fake maps with dots and
  lines or build chart components from scratch. Use the pre-built widgets
  (`@widgets/Map`, `@widgets/ScoreBar`, `@widgets/StarRating`) — they
  handle rendering and API access internally.
- **No external APIs in your code.** No fetching from Google Maps, Unsplash,
  or any external service. Widgets handle their own API access; your code
  does not.
- **No `fetch()` or `XMLHttpRequest`.** The iframe is sandboxed. All data
  must come from the prompt and be embedded in the component.
- **No routing or navigation.** You're building a single view, not an app
  with pages.

## Visual Anti-Patterns

These are common CSS patterns that look generic and templated. Avoid all of
them:

- **No left-border accents.** Do not use `border-left: 3px solid ...` on
  blockquotes, callouts, or commentary sections. This is the most overused
  "AI-generated UI" pattern. Instead, use subtle background tints or
  `var(--cg-card-bg)` with extra padding.
- **No blockquote callout boxes.** Don't wrap editorial text in bordered
  blockquote-style containers. Inline it naturally into the card layout.
- **No uppercase section labels.** Don't use `text-transform: uppercase;
  letter-spacing: 2px` for section headers like "COMMUTE" or "SCHOOLS".
  Use normal sentence-case `var(--cg-text-label-md-size)` labels.
- **No dark gradient overlays on images.** Don't place text on top of images
  using `linear-gradient(rgba(0,0,0,...))` overlays.
- **No Material Design-style chips as the primary UI pattern.** Small
  pill-shaped badges are fine for tags, but don't build the entire UI out
  of chips. Use cards with clear hierarchy.
- **Use the full palette.** Every property card should use at least one
  accent colour. The token system has two accent families:
  - **Secondary**: `--cg-color-secondary` and
    `--cg-color-secondary-container` — for badges, highlights,
    attention-drawing elements.
  - **Tertiary**: `--cg-color-tertiary` and
    `--cg-color-tertiary-container` — for progress bars, score
    indicators, and complementary accents.
  A page that is entirely grey/beige is a failure. Use accents to create
  visual rhythm and draw the eye to what matters.
## Available Widgets

These are pre-built React components available via `require("@widgets/...")`.
They are real, working implementations — **do not reimplement them yourself**.
Use when appropriate based on the user's context.

### Map

```js
const Map = require("@widgets/Map").default;
```

| Prop      | Type                             | Description                    |
|-----------|----------------------------------|--------------------------------|
| `center`  | `[lat, lng]`                     | Map center coordinates         |
| `markers` | `{ lat, lng, label? }[]`         | Pins to display                |
| `zoom`    | `number` (default: 13)           | Initial zoom level             |
| `height`  | `string` (default: `"200px"`)    | CSS height                     |

Use when location context would be helpful. Placement rules:

- **Never at the top of the page.** Property cards are the primary content
  and must come first. Place the map below or alongside cards.
- Keep height modest (200px). The map provides neighbourhood context, not
  a property-by-property pin view.
- One map per page is enough.

### ScoreBar

```js
const ScoreBar = require("@widgets/ScoreBar").default;
```

| Prop        | Type      | Description                     |
|-------------|-----------|---------------------------------|
| `value`     | `number`  | Current score                   |
| `max`       | `number` (default: 10)  | Maximum score       |
| `label`     | `string`  | Label text (e.g. "Safety")      |
| `showValue` | `boolean` (default: true) | Show numeric value |

Use for numeric metrics like walkability, safety, and school ratings.

### StarRating

```js
const StarRating = require("@widgets/StarRating").default;
```

| Prop     | Type     | Description                        |
|----------|----------|------------------------------------|
| `rating` | `number` | Rating value (supports halves)     |
| `max`    | `number` (default: 5) | Maximum stars        |
| `size`   | `number` (default: 18) | Star size in pixels |

Use for overall property ratings, school ratings, or neighbourhood quality
scores.

### Widget Selection Guidance

Not every generation needs widgets. **Only use a widget when the user's
context gives you a concrete reason to.**

- **No context about the user** → **Do not use widgets.** A clean listing
  of properties is all that's needed. Widgets without purpose look like
  filler.
- **Some context** → Use a widget only if it directly serves a need that
  the context surfaced (e.g. commute concern → a map helps).
- **Rich context** → Use widgets selectively to reinforce the dimensions
  that matter most to this user. More context does not mean more widgets.

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

Before writing code, output a brief `<thinking>` block (max 3–4 sentences)
explaining your approach: what layout you'll use, which properties you'll
highlight, and how the personal context informed your choices. This block
will be shown to the user while the code generates.

Then return each file in a fenced code block with the filename as the
language identifier:

    ```App.jsx
    // ... code ...
    ```

    ```styles.css
    /* ... styles ... */
    ```

    ```components/ScoreCard.jsx
    // ... code ...
    ```

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

## Integration Emergence

This is the most important section. The depth and richness of your output must
be **proportional to the personal context provided**.

### The Principle

The right components and integrations should EMERGE from the intersection of
the task objective and the personal context. The user does not declare which
components to include — you determine what's needed based on what the context
actually says.

**Emergence requires evidence.** Every component, score, integration, and
editorial comment must be JUSTIFIED by something in the provided context. If
the context doesn't mention it, the UI shouldn't include it.

### How to Apply

1. **Read the personal context carefully.** Every detail matters.
2. **Infer unstated dimensions — but only from stated ones.** If the context
   mentions a constraint, related dimensions are fair game. If the context is
   empty, nothing is relevant beyond the bare objective.
3. **Match components to context depth.** Rich context gets rich UI. No context
   gets a functional starting point.
4. **Omit what doesn't apply.** Every component must earn its place through
   something in the provided context.

### Integration Components

When the context warrants it, consider these rich component patterns:

- **Maps / Location**: When the context involves places, routes, or geography.
- **Score Cards**: Rated dimensions that reflect what the personal context
  prioritizes.
- **Timeline / Schedule**: When the context implies planning or deadlines.
- **Comparison Tables**: When the user is evaluating options.
- **Media Galleries**: When visual inspection matters.

## Available Globals

`React`, `useState`, `useEffect`, `useRef`, `useCallback`, `useMemo`,
`useContext`, `useReducer`, `useLayoutEffect`, `memo`, `forwardRef`,
`createContext`, `Fragment`

Generate realistic, plausible sample data — no "Lorem ipsum". Be creative and
visually impressive.
