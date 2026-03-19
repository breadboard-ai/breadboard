---
name: UI Generation
description:
  Technical infrastructure for generating multi-file React component bundles.
  Defines output format, available globals, design tokens, and constraints.
  Aesthetic direction comes from the task prompt, not this skill.
---

# UI Generation Skill

You are generating a multi-file React component bundle. This skill defines the
**technical rules** — what's available, how to output files, and what constraints
to respect. The visual direction and aesthetic come separately in the prompt.

## Hard Rules

1. **All colors, spacing, typography, and radii MUST use `--cg-` design
   tokens.** No hex colors, no `rgb()`, no named colors, no raw pixel values.
   The design tokens are themeable — hardcoded values break theme switching.
2. **Your output renders inside a host application.** Don't create app names,
   brand headers, splash screens, or taglines. Start with the actual content.
3. **Use provided data exactly.** Do not invent additional data items.
4. **Be discreet.** Never expose reasoning as UI. No sections titled "Agent
   Analysis", "Priority Assessment", or "Based on your activity".
5. **Responsive by default.** Must work from 320px to 1200px+. Use `clamp()`
   for font sizes, `flex-wrap` or `auto-fit/minmax` for multi-column layouts.
   Test your mental model at 375px, 768px, and 1200px.

## Image Helper

A global `imageUrl(prompt)` function is available. It returns a URL string:

```jsx
const heroSrc = imageUrl("A sunny windowsill with houseplants");
// Returns: "/api/image?prompt=A%20sunny%20windowsill%20with%20houseplants"
```

Use data `imagePrompt` values exactly as provided.

## Constraints

- **No external APIs.** No `fetch()`, no `XMLHttpRequest`.
- **No routing.** Single view, no multi-page navigation.
- **Static data.** All data is embedded in the component.
- **XState is available** via `require("xstate")` for interactive state
  management if you want expand/collapse, detail views, etc.

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

**Expressive:** `--cg-border-{style,width}`,
`--cg-heading-{transform,letter-spacing,font-style}`,
`--cg-img-{radius,border,shadow,filter}`,
`--cg-divider-{color,thickness,style}`,
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
`createContext`, `Fragment`

Google Material Symbols Outlined is available:

```jsx
<span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
  search
</span>
```

## Output Format

Before writing code, output a brief `<thinking>` block (max 4-5 sentences)
describing your design approach: what gets emphasis, what techniques you're
using, and the overall narrative arc.

Then return each file in a fenced code block with the filename as the
language identifier:

    ```App.jsx
    // ... code ...
    ```

    ```styles.css
    /* ... styles ... */
    ```

    ```sections/SectionName.jsx
    // ... code ...
    ```

### Rules

1. **App.jsx is the entry point.** Named exactly `App.jsx`, function `App`.
2. **All data embedded as defaults.** The component renders standalone.
3. **Sub-components live in `sections/`.** One per layout section.
4. **Every file imports React.** Include `import React from "react"`.
5. **CSS imports work.** Use `import "./styles.css"` in App.jsx.
6. **Export default.** Each file exports its component.
