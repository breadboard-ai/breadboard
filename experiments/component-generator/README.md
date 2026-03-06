# ComponentGen — AI Component Generator

An experimental tool that generates React components from text descriptions
using Gemini. Describe a component, optionally attach or "imagine" a reference
image, and get a live-previewing React component with interactive props.

## Quick Start

```bash
# 1. Set your Gemini API key
echo "GEMINI_API_KEY=your-key-here" > .env

# 2. Start the dev server
npm run dev
```

Open `http://localhost:5173`. Type a component description, hit **Generate**.

## Architecture

The host UI is built with **Lit web components** and **signal-polyfill** for
reactive state. The preview iframe runs **React** — no React outside the iframe.

```
src/
├── main.ts            # Entry point — imports <cg-app> and global styles
├── state.ts           # Signal-polyfill reactive state (loading, images, etc.)
├── actions.ts         # Business logic (generate, imagine, uploadImage)
├── styles.css         # Global design tokens and resets only
├── debug.ts           # Debug log utility (writes to console groups)
├── utils.ts           # String utilities (toTitleCase, toKebabCase)
│
├── components/        # Lit web components (host UI)
│   ├── cg-app.ts      # Top-level shell — grid layout, overlay routing
│   ├── cg-top-bar.ts  # Logo, theme/code toggles, + New, ⚙ Settings
│   ├── cg-sidebar.ts  # Left panel — wraps cg-library
│   ├── cg-library.ts  # Component list with search, groups, selection
│   ├── cg-preview.ts  # Iframe, code viewer, theme, TweakPane, resize
│   ├── cg-generation-overlay.ts  # Modal for generating/imagining
│   └── cg-settings-overlay.ts    # Modal for layout tokens & debug
│
├── core/              # Pure logic — no DOM, no framework
│   ├── parser.ts      # Code block extraction, JSX parsing, prop extraction
│   ├── prompt.ts      # Gemini system prompt builder
│   ├── registry.ts    # In-memory component registry (localStorage-backed)
│   └── stream.ts      # SSE stream reader for Gemini proxy
│
├── preview/           # Iframe internals (React)
│   ├── iframe.ts      # Creates and communicates with the preview iframe
│   ├── iframe-entry.ts# React bootstrap inside the iframe
│   └── themes.ts      # Theme definitions (CSS strings)
│
└── design/
    └── tokens.ts      # CSS custom property strings for the iframe
```

## How It Works

### Signal-Driven State

All reactive state lives in `state.ts` as `@signal accessor` fields on the
`AppState` singleton class, using `signal-utils`. Lit components extend
`SignalWatcher(LitElement)` from `@lit-labs/signals`, which automatically
re-renders when any signal read during `render()` changes.

```
AppState.field            UI Component
──────────────            ────────────
loading ──────────────┬── cg-generation-overlay (buttons)
imagineLoading ───────┤
thinking ─────────────┘── cg-generation-overlay (thinking panel)
selectedTag ──────────┬── cg-library (highlights active)
                      └── cg-preview (renders component)
searchQuery ──────────── cg-library (filters list)
codeVisible ──────────── cg-preview (toggles code panel)
inspectorVisible ─────── cg-preview (toggles TweakPane)
uploadedImage ────────── cg-generation-overlay (shows preview)
conceptImage ─────────── cg-generation-overlay + cg-preview
useLayoutTokens ──────── cg-settings-overlay (toggle)
generationOverlayOpen ── cg-app (overlay visibility)
settingsOverlayOpen ──── cg-app (settings overlay)
```

### Actions

Business logic lives as plain `async` functions in `actions.ts`:

| Action                      | What it does                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `generate(description)`     | Builds a Gemini prompt, streams the response, parses components, updates the registry, selects the result |
| `imagine(description)`      | Calls the concept-image endpoint (with optional uploaded reference), then auto-generates                  |
| `processUploadedFile(file)` | Reads a File into base64 and stores in `uploadedImage` signal                                             |

### Component Tree

```
<cg-app>                       ← grid shell (top-bar + sidebar + preview)
├── <cg-top-bar>               ← logo, theme, code toggle, + New, ⚙ Settings
├── <cg-sidebar>               ← left panel
│   └── <cg-library>           ← component list with search and groups
├── <cg-preview>               ← right panel
│   ├── concept panel + resize handle
│   ├── iframe container       ← React lives here
│   ├── code panel overlay
│   └── TweakPane container
├── <cg-generation-overlay>    ← modal: prompt, image upload, thinking
└── <cg-settings-overlay>      ← modal: layout tokens, debug inspector
```

### The Imagine Flow

1. User types a description and clicks **✨ Imagine**
2. If a reference image is uploaded, it's sent alongside the text to
   `/api/concept-image` so the AI concept is influenced by the reference
3. The concept image appears in the preview area
4. `generate()` is called automatically with both images (uploaded + concept) as
   visual context for the component generation

### Thinking Panel

During generation, the model's internal thoughts are streamed in real-time and
rendered as **markdown** in a collapsible `<details>` element inside the
generation overlay. The summary line shows a pulsing dot and a truncated status.
Expanding reveals the full thought stream with proper markdown formatting.

## Design Tokens

CSS custom properties defined in `styles.css` on `:root` pierce shadow DOM
boundaries, so all Lit components have access to the shared design system:

| Token              | Value            | Usage                 |
| ------------------ | ---------------- | --------------------- |
| `--host-surface`   | `#0a0a0a`        | Page background       |
| `--host-surface-1` | `#141414`        | Sidebar background    |
| `--host-surface-2` | `#1e1e1e`        | Input backgrounds     |
| `--host-surface-3` | `#2a2a2a`        | Hover/active states   |
| `--host-accent`    | `#a3e635`        | Primary accent (lime) |
| `--host-font`      | `Inter`          | Body text             |
| `--host-font-mono` | `JetBrains Mono` | Code and tags         |

## Server (Vite Plugin)

The Vite dev server includes a proxy plugin (`vite.config.ts`) with these
endpoints:

| Endpoint               | Method | Description                                                          |
| ---------------------- | ------ | -------------------------------------------------------------------- |
| `/api/generate/stream` | POST   | Streaming Gemini proxy (SSE) with thoughts                           |
| `/api/generate`        | POST   | Non-streaming Gemini proxy                                           |
| `/api/transform`       | POST   | JSX → CJS transform via esbuild                                      |
| `/api/image`           | GET    | Image generation via Gemini (cached)                                 |
| `/api/concept-image`   | POST   | Concept image via Nano Banana Pro (accepts optional reference image) |

## Testing

```bash
npm run test        # Runs all tests
```

Tests use Node's built-in test framework. The parser tests in
`tests/parser.test.ts` cover code block extraction, JSX parsing, and prop
extraction — all pure logic, no DOM required.

## Dependencies

| Package               | Why                                          |
| --------------------- | -------------------------------------------- |
| `lit`                 | Web component framework for the host UI      |
| `signal-polyfill`     | TC39 Signals polyfill for reactive state     |
| `signal-utils`        | Signal helper utilities                      |
| `@lit-labs/signals`   | SignalWatcher mixin — Lit ↔ signals bridge   |
| `react` / `react-dom` | Component runtime inside the preview iframe  |
| `tweakpane`           | Inspector panel for interactive prop editing |
| `markdown-it`         | Markdown rendering in the thinking panel     |
| `acorn` / `acorn-jsx` | JSX parser for code analysis                 |
