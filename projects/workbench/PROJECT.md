# Project Workbench — Agent-Centric Editing

Opie is the user's collaborator — they work together to create and refine an
agent. In today's model, that agent is a graph with a single node whose type is
"agent", configured with skills, tools, and assets. The current UI — a graph
canvas with a collapsible sidebar — was built for multi-node graphs. It's the
wrong shape for this collaborative, single-agent workflow.

This project replaces the graph-centric editor with an **Agent Workbench**: a
three-column layout purpose-built for authoring, collaborating on, and running a
single agent.

```
┌────────────────────┬─────────────────────────┬────────────────────┐
│                    │                         │                    │
│   Opie             │   Agent Configuration   │   Run Log          │
│   Conversation     │                         │                    │
│                    │   ┌───────────────────┐ │   ┌────────────┐   │
│   Contextualized   │   │                   │ │   │ Run 3      │   │
│   history of all   │   │   Objective       │ │   │ ████████░░ │   │
│   changes, user    │   │   Editor          │ │   │            │   │
│   messages, and    │   │                   │ │   ├────────────┤   │
│   Opie responses   │   │  (contenteditable │ │   │ Run 2 ✓    │   │
│                    │   │    with inlined   │ │   │            │   │
│                    │   │    assets)        │ │   ├────────────┤   │
│                    │   │                   │ │   │ Run 1 ✓    │   │
│                    │   └───────────────────┘ │   │            │   │
│                    │                         │   └────────────┘   │
│                    │   ┌───────────────────┐ │                    │
│                    │   │ Tools & Skills    │ │   ▶ Run  ■ Stop    │
│                    │   │ Advanced Options  │ │                    │
│                    │   └───────────────────┘ │                    │
│                    │                         │                    │
└────────────────────┴─────────────────────────┴────────────────────┘
```

**Left column** — a full-height contextualized conversation with Opie. Not just
chat: this contains the complete interleaved history of user messages, Opie
responses, and every mutation to the agent's configuration. The user can
traverse this history and restore any prior version.

**Center column** — the agent's configuration. Dominated by the objective editor
— a rich contenteditable surface where the agent's system prompt lives alongside
inlined assets (think iframes, images, data). Below it: tool/skill toggles and
advanced options.

**Right column** — the run log. The full history of running the agent, with
controls for run, stop, and (eventually) resume. Effectively today's console,
promoted to a first-class panel.

## Direction of Travel

This project touches nearly every surface of the editor. Some concepts are ready
to build now; others depend on pending backend work.

**Things we control and can build now:**

- The `enableAgentWorkbench` flag and the routing/layout switch.
- The three-column layout shell.
- Migrating the console/run log to the right column.
- The objective editor surface (evolving the existing step/prompt editor).
- Tool and skill configuration UI beneath the objective.
- Theme controls relocated to app-level chrome.

**Things that depend on future infrastructure:**

- The contextualized conversation with version traversal and restore (left
  column). The underlying history/versioning model will be built by a colleague.
  We need to design the UI to accommodate it, but the actual data plumbing is
  not ours to build. Phase 1 establishes the column; later phases populate it as
  the backend arrives.
- The comment/annotation system (highlight any element, attach an annotation
  that Opie collects on next run). This is a distinct feature layered on top of
  the workbench layout.

**What happens to the graph view?**

It doesn't disappear yet. Multi-node graphs still exist (legacy and some power
user flows). The flag gates the workbench for single-agent Opals. When the flag
is off (or the Opal has multiple nodes), the current graph editor remains. When
the flag is on and the Opal is a single-agent graph, the workbench replaces it.

## Architecture Context

### Current Layout

The current editor is `bb-canvas-controller`, which renders a `ui-splitter`
with:

- **Slot 0**: The graph renderer (`bb-renderer`), edit-history overlay, empty
  state, theme editor.
- **Slot 1**: A side-nav with tabs for Preview, Console, Step (entity-editor),
  and Theme.

Opie currently lives as a floating chat panel (`bb-graph-editing-chat`) overlaid
on the graph renderer, toggled by `GraphEditingAgentController.open`.

### Target Layout

The workbench replaces the splitter with a three-column CSS grid:

```
grid-template-columns: var(--col-left) var(--col-center) var(--col-right);
```

Each column is a distinct element (not tabbed side-nav slots). Column widths are
adjustable via two independent drag handles. Default ratio is **1:2:1** (or more
precisely 1:flex:1 — left and right are fixed-width panels, center takes
remaining space).

The current `ui-splitter` is a two-slot design: one split ratio, one drag
handle, one `SplitterController` with binary clamping. It doesn't generalize to
three columns. We need a new **tri-splitter** element (or a generalized N-column
splitter) with two handles and per-column min-width constraints. The pattern is
the same — pointer capture, `fr` units, session-persisted ratios — but the
geometry is fundamentally different (two degrees of freedom, not one).

### SCA Impact

The workbench introduces new controller state and restructures existing
controllers. Key changes:

| Current                                            | Target                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `editor.graphEditingAgent` — chat toggle + entries | `editor.workbench` — workbench layout state, column visibility, active tab |
| `editor.sidebar` — section: console/editor/preview | Absorbed into workbench; columns replace tabs                              |
| `run.main` — console entries, status, input        | Unchanged; the run log column reads from the same controller               |
| `editor.step` — pending edits                      | Unchanged; the objective editor reads/writes the same controller           |
| `editor.graph` — graph state                       | Unchanged; the objective editor operates on the graph's agent node         |
| `editor.theme` — theme hash                        | Relocated to `global` or app-level chrome                                  |

New additions:

- `editor.workbench.WorkbenchController` — column visibility, drag state,
  workbench mode detection.
- Eventually: `editor.workbench.HistoryController` — version traversal for the
  left column (deferred until backend arrives).

### Flag

```typescript
/**
 * Enables the Agent Workbench layout for single-agent Opals.
 * Replaces the graph canvas + sidebar with a three-column
 * conversation / configuration / run-log view.
 */
enableAgentWorkbench: boolean;
```

Visibility: `"experimental"` initially.

Added to:

1. `packages/types/src/flags.ts` (`RuntimeFlags` type + `RUNTIME_FLAG_META`)
2. `packages/visual-editor/src/ui/config/client-deployment-configuration.ts`
3. `packages/unified-server/src/config.ts` (env variable mapping)

---

## Phase 1 — The Shell

### 🎯 Objective

When `enableAgentWorkbench` is on and the loaded Opal is a single-agent graph,
the editor renders a three-column layout instead of the graph canvas + sidebar.
The right column shows the console/run log (not a placeholder). Theme controls
are relocated out of the sidebar. The Preview tab is gone. A **toggle** lets the
user switch between the workbench and the legacy graph view; it is only available
when the graph meets the criteria (single agent node + flag on).

**Observable proof:** Enable the flag. Open a single-agent Opal. The workbench
appears by default with three columns: "Conversation" (left, placeholder for
now), "Configuration" (center, placeholder for now), and the run log (right,
live). Run the agent — the right column populates in real-time. Find the
workbench/graph toggle on the floating control stack and switch to the classic
graph view — the graph renderer and sidebar appear as usual, minus the Preview
tab. Toggle back — the workbench returns. Open a multi-node graph with the flag
on; no toggle, classic editor is the only option. Theme editing is accessible
from the app tab, not the sidebar.

### Toggle: Floating Control Stacks

The toggle between workbench and graph view lives in the **floating control
stack** — the existing pill-shaped button group in the bottom corner of the
canvas (fit-to-screen, zoom +/−, undo, redo).

**Graph view stack** (existing, extended):

- Fit to screen
- Zoom +/−
- Undo / Redo
- **[NEW]** Workbench button — grayed out if ineligible, active if eligible

**Workbench view stack** (new, similar position):

- Undo / Redo (grayed out for now — future capability)
- Graph view button — returns to the classic editor

This keeps the toggle in context, avoids overloading the header, and gives both
views a symmetrical doorway to the other.

### Changes

#### packages/types

- [x] `flags.ts` — add `enableAgentWorkbench` to `RuntimeFlags` and
      `RUNTIME_FLAG_META` (visibility: `"experimental"`).

#### packages/unified-server

- [x] `config.ts` — map `ENABLE_AGENT_WORKBENCH` env variable to the flag.
- [x] `flags.ts` — add the flag default.

#### packages/visual-editor — SCA

- [x] `WorkbenchController` — new controller in
      `controller/subcontrollers/editor/workbench/`. Fields:
  - `eligible: boolean` — derived from flag + graph shape (single agent node).
    When false, the workbench is unavailable and the toggle is hidden.
  - `view: "workbench" | "classic"` (persisted, session) — the user's toggle
    choice. Defaults to `"workbench"` when eligible. Ignored when not eligible.
  - `splits: [number, number, number]` (persisted, session — three `fr` values,
    e.g. `[1, 2, 1]` for the default 1:2:1 ratio).
- [x] `controller.ts` — add `workbench` to `editor` subcontrollers.
- [x] `editor.ts` — re-export `WorkbenchController`.
- [x] Workbench eligibility trigger — a trigger that watches the flag signal and
      `editor.graph.graph` to set `workbench.eligible` when the flag is on and
      the graph has a single agent node.

#### packages/visual-editor — UI

**Routing.** The decision point is `bb-main` (`index.ts`), at the `mainPanel`
composition level (~L173). When `workbench.eligible && workbench.view ===
"workbench"`, render `#renderAgentWorkbench()` instead of
`#renderCanvasController()`. This is the same level that already switches
between canvas, app, and welcome views.

- [x] `bb-agent-workbench` — new element in
      `ui/elements/agent-workbench/agent-workbench.ts`. Renders the three-column
      CSS grid. Left and center columns render placeholders. Right column
      renders the run log (see below). A floating control stack in the bottom
      corner with: undo/redo (grayed out), graph view button.
- [x] `agent-workbench.styles.ts` — grid layout, column sizing.
- [x] **Tri-splitter** — new `ui-tri-splitter` element (or equivalent). Two drag
      handles, three slots. Per-column minimum widths. Same pointer-capture +
      `fr` unit pattern as `ui-splitter`, but with two degrees of freedom. The
      `WorkbenchController` owns the split state (not `SplitterController`,
      which remains for the classic layout).
- [x] `bb-run-log-column` — new element for the right column:
  - Column header: agent title, Run / Stop buttons, progress indicator.
  - Run list: reads from `AgentContext.getAllRuns()`, renders each as a
    collapsible entry (status badge, timestamp, summary).
  - Active run body: delegates live console output to existing `bb-console-view`
    or its internal rendering.
- [x] `index.ts` — conditional rendering in `mainPanel`: when workbench is
      active, render `bb-agent-workbench` instead of `bb-canvas-controller`.
- [x] Graph view floating control stack — extend the existing canvas control
      stack (fit-to-screen, zoom, undo/redo) with a workbench button, grayed
      out when ineligible.
- [x] Theme controls — remove the Theme button from the sidebar controls in
      `bb-canvas-controller` when workbench-eligible. Relocate to the app tab
      (accessible from the header's Editor/App toggle → App view). The theme
      designer overlay continues to render as an overlay.
- [x] Preview removal — the Preview sidebar tab is hidden when the workbench
      flag is on and the graph is eligible. Preview functionality moves to the
      App view (already accessible via the header toggle).

> [!NOTE] `AgentContext` already tracks multiple runs in a
> `Map<string, RunState>` (with status, contents, files, objective, and
> resumability per run). `RunController` only represents the _active_ run's
> console entries. The run log column bridges this gap — it reads the run list
> from `AgentContext` and delegates the active run's live output to the
> existing console rendering.

#### Tests

- [x] `workbench-controller.test.ts` — `eligible` is false when flag is off;
      `eligible` is true when flag is on and graph is single-agent; `eligible`
      is false when flag is on but graph is multi-node. `view` defaults to
      `"workbench"` when eligible; persists across reloads.

---

## Phase 2 — Objective Editor

### 🎯 Objective

The center column renders the agent's objective — the system prompt — in a rich
contenteditable editor. Assets (images, documents, data) can be inlined within
the objective text. Below the objective: tool and skill toggles. This replaces
the step-editor / entity-editor sidebar panel for single-agent workbench mode.

**Observable proof:** Enable the workbench. Open an agent with a system prompt
and attached assets. The center column shows the prompt text in a rich editor
with assets rendered inline (as thumbnails, previews, or placeholders). Edit the
prompt text. The change is reflected in the underlying graph. Toggle a tool off.
Run the agent. The tool is not available.

### Changes

#### packages/visual-editor — UI

- [ ] `bb-objective-editor` — new element in
      `ui/elements/agent-workbench/objective-editor/`. A contenteditable surface
      that renders the agent node's system prompt with inlined assets.
  - Reads from the agent node's configuration via the graph store.
  - Writes back via the existing step-edit action pipeline.
  - Asset rendering: each asset (image, file, etc.) is rendered as an inline
    block element within the contenteditable. Think decorations or embedded
    views, not separate file pickers.
- [ ] `bb-tool-shelf` — new element for toggling tools and skills. A compact
      list of available tools with toggle switches. Reads from the agent node's
      tool configuration.
- [ ] `bb-agent-workbench` — mount `bb-objective-editor` and `bb-tool-shelf` in
      the center column, replacing the Phase 1 placeholder.

> [!IMPORTANT] The objective editor is the most design-sensitive surface in the
> workbench. Mocks will be provided separately. The implementation should start
> with the data flow (reading/writing the agent node's system prompt through
> SCA) and then layer the visual design on top. Don't block on mocks for the
> data plumbing.

---

## Phase 3 — Opie Conversation Column

### 🎯 Objective

The left column renders the Opie conversation — the same chat currently shown in
the floating `bb-graph-editing-chat` panel — as a full-height, integrated
column. The floating panel is removed when the workbench is active.

**Observable proof:** Enable the workbench. The left column shows Opie's
greeting. Type a message. Opie responds. The conversation is anchored in the
left column, not a floating overlay. The chat input is at the bottom of the
column. Scrolling works naturally. Thoughts/thinking indicators appear inline.

### Changes

#### packages/visual-editor — UI

- [ ] `bb-conversation-column` — new element wrapping the existing Opie chat
      rendering. Extracts the chat log rendering from `bb-chat-panel` and mounts
      it as a full-height column with:
  - Conversation history (scrollable).
  - Input area at the bottom.
  - Opie avatar and greeting.
- [ ] `bb-agent-workbench` — mount `bb-conversation-column` in the left column
      slot.
- [ ] `bb-canvas-controller` / `bb-graph-editing-chat` — skip rendering the
      floating chat panel when workbench mode is active.

#### packages/visual-editor — SCA

- [ ] `GraphEditingAgentController` — the `open` field becomes irrelevant in
      workbench mode (the conversation is always visible). The controller
      continues to own chat entries and processing state.

> [!NOTE] This phase uses the existing `GraphEditingAgentController` and chat
> infrastructure. The "contextualized history with version traversal" described
> in the overview is a future capability that will be layered in when the
> backend versioning system arrives. Phase 3 migrates the chat to its new home;
> the contextualized history is Phase 5.

---

## Phase 4 — Column Interactions & Polish

### 🎯 Objective

The three columns interact fluidly. Columns are resizable via drag handles.
Column widths persist across sessions. The layout is responsive — on narrow
screens, columns collapse into a tabbed view (similar to the current narrow
screen behavior). Transitions between workbench and classic mode are smooth.

**Observable proof:** Drag the left column handle to resize it. Reload the page.
The column width is preserved. Resize the browser to a narrow width. The columns
collapse into tabs. Resize back. The columns restore. Switch between workbench
and classic mode via the toggle. The transition is immediate with no layout jank.

### Changes

#### packages/visual-editor — UI

- [ ] `bb-agent-workbench` — drag handles between columns. Resize logic using
      pointer events (consistent with existing `ui-splitter` patterns).
- [ ] Column width persistence — read/write from `WorkbenchController`'s
      persisted `splits` field.
- [ ] Narrow screen adaptation — media query or `ScreenSizeController`-driven
      switch to tabbed view.
- [ ] Transition polish — ensure no layout shift when switching modes.
- [ ] Empty states — each column shows an appropriate empty state when there's
      no content (no conversation yet, no objective, no runs).

---

## Phase 5 — Contextualized History (Future)

### 🎯 Objective

The left column's conversation view is upgraded from a simple chat log to a
**contextualized history** that interleaves user messages, Opie responses, and
configuration changes. The user can traverse backward and forward in this
history, and can "restore this version" to promote any historical state to the
current tip.

> [!WARNING] This phase depends on backend versioning infrastructure being
> built. The UI work cannot begin until the data model for version traversal is
> defined. This phase is a placeholder to capture the design intent and ensure
> earlier phases leave room for it.

### Changes (tentative)

#### packages/visual-editor — SCA

- [ ] `editor.workbench.HistoryController` — version list, current position,
      restore action.
- [ ] History trigger — watches for mutations and appends entries to the
      contextualized history.

#### packages/visual-editor — UI

- [ ] `bb-conversation-column` — augmented to render interleaved history entries
      (chat messages + configuration diffs + run summaries).
- [ ] Version navigation — scrubber or list UI to traverse history.
- [ ] "Restore this version" — action button on historical entries.

---

## Phase 6 — Annotation System (Future)

### 🎯 Objective

A comment/annotation system where the user can highlight any element in the
workbench UI — a phrase in the objective, an entry in the run log, a tool
configuration — and attach an annotation. These annotations are collected by
Opie on its next run, giving it targeted feedback.

> [!NOTE] This is a distinct feature that layers on top of the workbench. It's
> listed here because it's part of the broader Agent Workbench vision, but it
> could be its own project. The design needs to address: annotation persistence,
> annotation rendering (inline highlights? margin comments?), and the protocol
> by which Opie consumes annotations.

### Changes (tentative)

- [ ] `AnnotationController` — annotation storage, creation, deletion.
- [ ] Annotation rendering — highlights/markers in the objective editor and run
      log.
- [ ] Opie integration — annotations are serialized and injected into the
      agent's context on the next run.

---

## Non-Goals

- **Graph editor removal.** The graph canvas is hidden in workbench mode, not
  deleted. Multi-node graphs continue to use the classic editor. Full removal is
  a future decision, not this project.
- **Backend versioning.** The version traversal and restore infrastructure (left
  column, Phase 5) is being built. This project builds the UI shell and
  integration points, not the backend.
- **New Opie capabilities.** This project changes where Opie's conversation
  renders, not what Opie can do. Opie's editing capabilities, tool use, and
  response generation are unchanged.
- **Mobile-first layout.** The three-column layout is designed for desktop.
  Narrow screens get a tabbed fallback (Phase 4), but native mobile UX is out of
  scope.
- **Published/shared view changes.** The workbench is for authors editing their
  own agents. Published and shared views continue to use the app template
  (`app-basic`) unchanged.

## File Map

```
packages/types/src/
  flags.ts                               ← add enableAgentWorkbench

packages/unified-server/src/
  config.ts                              ← env variable mapping
  flags.ts                               ← default value

packages/visual-editor/src/
  sca/controller/subcontrollers/editor/
    workbench/
      workbench-controller.ts            ← [NEW] column state, mode detection
    editor.ts                            ← re-export WorkbenchController
  sca/controller/controller.ts           ← add workbench to editor
  sca/actions/workbench/
    workbench-actions.ts                 ← [NEW] mode switching, column resize
    triggers.ts                          ← [NEW] flag + graph shape trigger

  ui/elements/agent-workbench/
    agent-workbench.ts                   ← [NEW] three-column grid shell
    agent-workbench.styles.ts            ← [NEW] grid layout, columns
    objective-editor/
      objective-editor.ts               ← [NEW] contenteditable prompt surface
    run-log-column/
      run-log-column.ts                 ← [NEW] console wrapper + run controls
    conversation-column/
      conversation-column.ts            ← [NEW] Opie chat in column form

  ui/elements/canvas-controller/
    canvas-controller.ts                 ← conditional: workbench vs. classic
```

## Context for New Sessions

Read these files before starting work on any phase:

### Current editor layout

| File                                                                                   | What to learn                                                                                                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/visual-editor/src/ui/elements/canvas-controller/canvas-controller.ts`        | The main editor element. Renders the splitter, graph renderer, and side-nav. This is what the workbench replaces for single-agent mode. |
| `packages/visual-editor/src/ui/elements/canvas-controller/canvas-controller.styles.ts` | Current layout CSS — the splitter, side-nav, graph container.                                                                           |

### Routing

| File                                              | What to learn                                                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/visual-editor/src/index.ts`             | `bb-main` — the top-level element. `mainPanel` (~L173) composes canvas controller, app controller, and welcome panel. The workbench routing decision is here. |

### SCA controllers

| File                                                                                                | What to learn                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/visual-editor/src/sca/controller/controller.ts`                                           | The root controller tree. All subcontrollers are instantiated here.                                  |
| `packages/visual-editor/src/sca/controller/subcontrollers/editor/editor.ts`                         | Editor subcontroller barrel. All editor-domain controllers.                                          |
| `packages/visual-editor/src/sca/controller/subcontrollers/editor/graph-editing-agent-controller.ts` | Opie's reactive state — chat entries, open/waiting/processing flags.                                 |
| `packages/visual-editor/src/sca/controller/subcontrollers/run/run-controller.ts`                    | Run lifecycle — status, console entries, input requests, errors. The run log column reads from this. |
| `packages/visual-editor/src/sca/controller/subcontrollers/editor/sidebar/sidebar-controller.ts`     | Sidebar section state (console/editor/preview). Superseded by workbench columns.                     |

### Agent context (multi-run tracking)

| File                                                                       | What to learn                                                                                                     |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/visual-editor/src/a2/agent/agent-context.ts`                     | `AgentContext` — tracks multiple runs in `Map<string, RunState>`. Has `createRun`, `getAllRuns`, `clearAllRuns`.   |

### Opie chat

| File                                                                              | What to learn                                                        |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/visual-editor/src/ui/elements/graph-editing-chat/graph-editing-chat.ts` | The current floating chat panel wrapper.                             |
| `packages/visual-editor/src/ui/elements/graph-editing-chat/chat-panel.ts`         | The chat panel internals — message rendering, input, thought groups. |
| `packages/visual-editor/src/sca/actions/agent/opie-actions.ts`                    | Opie-specific actions (send message, etc.).                          |
| `packages/visual-editor/src/sca/actions/agent/graph-editing-agent-actions.ts`     | Graph editing agent actions — the main orchestration for Opie.       |

### Console / run view

| File                                                             | What to learn                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/visual-editor/src/ui/elements/console/console-view.ts` | The current console view element. Renders run entries. |

### Flags

| File                                    | What to learn                                                        |
| --------------------------------------- | -------------------------------------------------------------------- |
| `packages/types/src/flags.ts`           | Flag type definitions and metadata. The canonical list of all flags. |
| `packages/unified-server/src/config.ts` | Server-side flag configuration from env variables.                   |
