# The Manager Agent Pattern

A user journey (e.g., "help me find a laptop") is a state machine with loops:
the user might ask for more research after seeing initial UI, or request a
layout change that requires a fresh generation pass.

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

Each discrete task is handled by a finite worker that does exactly one job:

- **`atomic-research`** — gathers data, writes it to a file, and exits.
- **`atomic-journey-gen`** — designs an XState blueprint (`journey.json`) for a
  UI segment and exits.
- **`atomic-ui-gen`** — consumes the blueprint and data, generates a React app,
  bundles it, and exits.

Every worker gets a completely clean context window. There is no accumulated
history from prior iterations. The Journey Manager provides all necessary
context in the briefing.

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

When the Journey Manager dispatches a child playbook with
`share_workspace: true`, the framework sets `parent_run_id` on the child's
tickets to the Journey Manager's own `playbook_run_id`. This causes the child
tickets' filesystem to resolve to:

```
tickets/{parent_run_id}/filesystem/
```

instead of the default:

```
tickets/{ticket_id}/filesystem/
```

All child tickets sharing the same `parent_run_id` read and write from the same
directory.

### Data Flow

```
Journey Manager (playbook_run_id: abc-123)
  │
  ├── atomic-research (parent_run_id: abc-123)
  │     └── writes research-data.json to abc-123/filesystem/
  │
  ├── atomic-journey-gen (parent_run_id: abc-123)
  │     ├── reads research-data.json from abc-123/filesystem/
  │     └── writes journey.json to abc-123/filesystem/
  │
  └── atomic-ui-gen (parent_run_id: abc-123)
        ├── reads journey.json from abc-123/filesystem/
        ├── reads research-data.json from abc-123/filesystem/
        └── writes App.jsx, bundle.js, bundle.css to abc-123/filesystem/
```
