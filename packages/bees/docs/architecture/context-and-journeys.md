# Context Degradation and the Journey Manager Pattern

## The Problem

The original `app` playbook used an infinite-loop ticket pattern: the `ui-gen`
step received a specification, generated UI, asked the user for feedback,
regenerated, and repeated indefinitely inside a single agent session.

This creates a **context degradation** problem. Every iteration stuffs the
agent's context window with:

1. The user's chat message
2. The previous React component code
3. The LLM's own intermediate reasoning
4. The new React component code

After several iterations, the accumulated dead context causes the agent to:

- Forget earlier constraints and requirements
- Hallucinate references to code that no longer exists
- Produce malformed or inconsistent output
- Exhibit recency bias — later content silently overwrites earlier instructions

Even with very large context windows, this is a structural problem, not a
capacity problem. The architecture should not depend on a model capability that
may regress across versions.

Additionally, the infinite-loop pattern has no **resumability**. If the session
fails due to a 503, timeout, or other transient error, the entire conversation
history — including the journey state — is lost. There is no checkpoint to
resume from.

## The Insight

A user journey (e.g., "help me find a laptop") is a **state machine with
loops**: the user might ask for more research after seeing initial UI, or
request a layout change that requires a fresh generation pass.

A playbook, however, is a **directed acyclic graph** — it flows forward through
dependency-ordered steps. It cannot loop.

Forcing the loop into a single ticket's ReAct cycle conflates two concerns:

- **Routing** — deciding what to do next (research? regenerate UI? ask a
  question?)
- **Execution** — actually doing the research, writing the code, running the
  bundler

The routing decisions require memory of the journey's history, but the execution
tasks do not. A research worker doesn't need to know what the UI looks like. A
UI generator doesn't need to know what search queries were run. Each task
benefits from a clean, focused context.

## The Solution: Three Layers

### 1. Opie (Executive Assistant)

Opie remains the user-facing conversational agent. When a user asks for
something that requires multiple phases (research, UI generation, iteration),
Opie **delegates** by launching a Journey Manager and steps entirely out of the
loop.

Opie's context window stays clean because it never touches journey internals —
it only receives high-level status updates via coordination signals.

### 2. Journey Manager (Project Manager)

The Journey Manager is a long-running daemon modelled after the Digest agent. It
uses `chat_await_context_update` to suspend between phases, waking only when a
worker completes.

Its responsibilities:

- **Interview** the user to understand the objective (using the `interview-user`
  skill)
- **Dispatch** finite worker tickets for research, journey design, and UI
  generation
- **Accumulate** context by reading worker outcomes when they complete
- **Iterate** on user feedback, dispatching fresh workers as needed
- **Define exit criteria** — some journeys are one-off ("buy a laptop"), others
  are open-ended ("plan my meals weekly")

The Journey Manager never generates code or journey specs itself. It is a pure
coordinator.

Because the Journey Manager only processes high-level status updates (not raw
code or research data), its context window fills very slowly — making it
resilient over long-running journeys.

### 3. Atomic Workers (Disposable Compute)

Each discrete task is handled by a **finite, stateless ticket** that does
exactly one job and terminates:

- **`atomic-research`** — gathers data, writes it to a file, and exits.
- **`atomic-journey-gen`** — designs an XState blueprint (`journey.json`) for a
  UI segment and exits.
- **`atomic-ui-gen`** — consumes the blueprint and data, generates a React app,
  bundles it, and exits.

Every worker gets a completely clean context window. There is no accumulated
history from prior iterations. The Journey Manager provides all necessary
context in the briefing.

This pattern provides natural **resumability**: if a worker fails, the Journey
Manager can simply dispatch a new one with the same briefing. The journey state
lives on disk (in the Journey Manager's ticket directory), not in an LLM's
volatile context.

## Why Not Just Use a Larger Context Window?

Three reasons:

1. **Recency bias** — LLMs demonstrably weight later tokens more heavily than
   earlier ones. Constraints stated at the beginning of a long session are
   progressively forgotten.

2. **Resumability** — structural state (files on disk, ticket metadata) survives
   transient failures. A context window does not. A 503 during iteration 5 of an
   infinite loop means starting over. With atomic workers, the Journey Manager
   simply re-dispatches.

3. **Separation of concerns** — a research agent should not carry 400 lines of
   React code in its context. A UI generator should not carry search query logs.
   Clean contexts produce better results for each specialised task.

## Architecture Diagram

```
User
  │
  ▼
┌────────┐   delegates   ┌───────────────────┐
│  Opie  │ ────────────▶ │  Journey Manager  │
│  (EA)  │ ◀──────────── │   (Project Mgr)   │
└────────┘ status updates└───────┬───────────┘
                                 │
                    dispatches   │   dispatches
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Research │ │ Journey  │ │ UI Gen   │
              │ Worker   │ │ Designer │ │ Worker   │
              └──────────┘ └──────────┘ └──────────┘
                (finite)     (finite)     (finite)
```

Each worker terminates after completing its task. The Journey Manager
accumulates results and dispatches the next phase.

## The Feedback Loop

When the user provides feedback after seeing the generated UI:

1. The feedback reaches the **Journey Manager** (via chat).
2. The Journey Manager decides what's needed:
   - New data? → dispatch a fresh `atomic-research` worker
   - New layout? → dispatch `atomic-journey-gen` then `atomic-ui-gen`
   - Satisfied? → mark the journey complete
3. Each dispatched worker gets a **clean context** — no accumulated history from
   prior iterations.

This is structurally identical to how the Digest agent works: it sleeps, wakes
on a signal, processes it, and sleeps again. The difference is that the Journey
Manager drives an interactive, multi-phase workflow rather than a passive
content aggregator.

## Shared Playbook Filesystem

### The Data Handoff Problem

Each ticket in Bees gets its own isolated filesystem sandbox at
`tickets/{id}/filesystem/`. This is fine for independent tickets, but
coordinated workers (like the Journey Manager's atomic workers) need to share
data: the research worker writes `research-data.json`, the journey designer
reads it and writes `journey.json`, and the UI generator reads both.

In the original architecture, the only way to pass data between workers was to
inject file contents into the LLM context string — essentially serializing
structured data through the LLM's attention mechanism. This is fragile,
token-expensive, and unreliable: the LLM may truncate, reformat, or
hallucinate the data.

### The Solution: `parent_run_id` and Shared Workspaces

When the Journey Manager dispatches a child playbook with `share_workspace:
true`, the framework sets `parent_run_id` on the child's tickets to the
Journey Manager's own `playbook_run_id`. This causes the child tickets'
filesystem to resolve to:

```
tickets/_runs/{parent_run_id}/filesystem/
```

instead of the default:

```
tickets/{ticket_id}/filesystem/
```

All child tickets sharing the same `parent_run_id` read and write from the
same directory. The Journey Manager itself does not use this directory — it is
a pure coordinator that doesn't need to read/write data files. Its children
handle all file I/O.

### Data Flow

```
Journey Manager (playbook_run_id: abc-123)
  │
  ├── atomic-research (parent_run_id: abc-123)
  │     └── writes research-data.json to _runs/abc-123/filesystem/
  │
  ├── atomic-journey-gen (parent_run_id: abc-123)
  │     ├── reads research-data.json from _runs/abc-123/filesystem/
  │     └── writes journey.json to _runs/abc-123/filesystem/
  │
  └── atomic-ui-gen (parent_run_id: abc-123)
        ├── reads journey.json from _runs/abc-123/filesystem/
        ├── reads research-data.json from _runs/abc-123/filesystem/
        └── writes App.jsx, bundle.js, bundle.css to _runs/abc-123/filesystem/
```

The Journey Manager never needs to read these files or inject them into
context — it just tells each worker which filenames to expect. The filesystem
is the coordination mechanism, not the LLM.

### Why Not Use Outcomes?

The `system_objective_fulfilled` outcome mechanism works well for passing
**summaries** between steps, but data files (JSON blueprints, research
datasets) are too large and structured for LLM context injection. The shared
filesystem keeps structured data on disk where it belongs, and summaries in
the LLM context where they belong.
