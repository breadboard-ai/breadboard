# The Reference Application

The bees codebase includes a reference application — a chat-based web shell
backed by a FastAPI server. This document describes how the reference app
consumes the bees framework. It is both a working product and an example of the
consumption model described in `patterns.md`.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Web Shell (Lit)                      │
│  sidebar · chat float · stage (iframe) · subagent panel │
│                          │                               │
│                    SSE ↓ REST ↑                          │
├─────────────────────────────────────────────────────────┤
│                   Server (FastAPI)                       │
│          REST endpoints · SSE broadcaster               │
│                          │                               │
│               SchedulerHooks ↕                          │
├─────────────────────────────────────────────────────────┤
│                   Bees Framework                        │
│              Scheduler → Session → LLM                  │
└─────────────────────────────────────────────────────────┘
```

The server is the glue layer that projects the scheduler's model as REST
endpoints and SSE events. The web shell consumes those projections and renders
them as a chat UI with an embedded app stage.

## The Server (`app/server.py`)

The server has three responsibilities:

### 1. Boot the system

On startup, the server:

1. Creates a `Scheduler` instance with an `HttpBackendClient`.
2. Recovers stuck tickets (tasks that were running when the server last shut
   down) by resetting them to `available`.
3. Calls `boot_root_template()` — reads `SYSTEM.yaml` and creates the root task
   if none exists.
4. Starts the scheduler loop (`scheduler.start_loop()`), which continuously
   drains available tasks.

### 2. Project the model as REST

Every endpoint is a thin view over the task list. The server does no business
logic beyond serializing task data and writing user responses.

| Endpoint                     | Method | Purpose                                    |
| ---------------------------- | ------ | ------------------------------------------ |
| `/tickets`                   | GET    | List all tasks, optionally filtered by tag |
| `/tickets/{id}`              | GET    | Single task with chat history              |
| `/tickets/{id}/respond`      | POST   | Write user response, flip assignee         |
| `/tickets/{id}/retry`        | POST   | Reset a paused task to available           |
| `/tickets/{id}/tags`         | POST   | Update task tags                           |
| `/tickets/{id}/files`        | GET    | List files in the task's workspace         |
| `/tickets/{id}/files/{path}` | GET    | Serve a file from the task's workspace     |
| `/tickets`                   | POST   | Create a new ad-hoc task                   |
| `/status`                    | GET    | Summary of active tasks grouped by run     |

The `respond` endpoint is the **controller** interaction point: when an agent
suspends with `assignee == "user"`, the web shell calls this endpoint to deliver
the user's response. Under the hood, it writes `response.json` and flips
`assignee` to `"agent"`, then triggers the scheduler. This is the direct
model-editing pattern noted in `patterns.md` as the main gap in the consumption
API.

#### Querying tasks

Tasks can be filtered by metadata fields. The reference app's `/status` endpoint
exposes this, but the filtering logic (`should_include_ticket` in `app/server.py`)
operates on the task model directly.

| Filter   | Example                 | Effect                        |
| -------- | ----------------------- | ----------------------------- |
| `kind`   | `work`, `!coordination` | Match/exclude by ticket kind  |
| `status` | `running,suspended`     | OR across statuses            |
| `tags`   | `chat`, `!opie`         | OR across tags, `!` to negate |

- Prefix with `!` to negate.
- Comma-separated values within a filter are OR'd.
- Multiple filters are AND'd.

### 3. Broadcast state changes via SSE

The server uses a `Broadcaster` (fan-out queue) to deliver real-time state
changes to all connected clients via Server-Sent Events.

The wiring: each `SchedulerHooks` callback maps to an SSE event type.

| SchedulerHook         | SSE event type   | What happened                    |
| --------------------- | ---------------- | -------------------------------- |
| `on_startup`          | `ticket_added`   | Root task was created at boot    |
| `on_ticket_start`     | `ticket_update`  | Task transitioned to running     |
| `on_ticket_done`      | `ticket_update`  | Task reached a resting state     |
| `on_ticket_event`     | `session_event`  | Running session emitted an event |
| `on_events_broadcast` | `ticket_added`   | Agent created a task mid-session |
| `on_cycle_start`      | `drain_start`    | Scheduler cycle beginning        |
| `on_cycle_complete`   | `drain_complete` | Scheduler has no more work       |

On initial connection, the SSE stream sends an `init` event with the full task
list. After that, clients receive incremental updates.

## The Web Shell (`web/`)

The frontend is a Lit application that renders the bees model as a chat-based
UI. It follows the SCA (Services, Controllers, Actions) pattern used in the
broader codebase.

### Services

| Service                    | Responsibility                                                         |
| -------------------------- | ---------------------------------------------------------------------- |
| `BeesAPI`                  | Thin REST wrapper — `respond()`, `retry()`, `getFile()`, etc.          |
| `SSEClient`                | Connects to `/events`, parses SSE, dispatches to an `EventTarget` bus. |
| `HostCommunicationService` | postMessage bridge to the iframe-hosted React apps.                    |

The `SSEClient` is the pipeline from the server's model to the frontend's
controller state. It listens for SSE events and dispatches them as DOM
CustomEvents on a shared `stateEventBus`.

### Controllers

The controller hierarchy holds the frontend's reactive state.

| Controller            | State                                                     |
| --------------------- | --------------------------------------------------------- |
| `GlobalController`    | The task list (`tickets`), draining flag, toast queue.    |
| `AgentTreeController` | Currently selected agent ID in the sidebar.               |
| `ChatController`      | Chat threads, messages, pending choices, minimized state. |
| `StageController`     | Current stage view, digest ticket ID.                     |

`GlobalController.tickets` is the frontend's copy of the model. All other
controllers derive their state from it (e.g., chat threads are derived from
tasks tagged `"chat"`).

### Actions

Actions are triggered by SSE events and transform the controller state.

| Action group | Trigger                        | What it does                                 |
| ------------ | ------------------------------ | -------------------------------------------- |
| `sync/`      | SSE events (init, add, update) | Upsert tasks into `GlobalController.tickets` |
| `chat/`      | User input, agent messages     | Send responses via `BeesAPI.respond()`       |
| `stage/`     | Bundle events                  | Load React apps into the iframe stage        |
| `tree/`      | Agent selection in sidebar     | Update `AgentTreeController.selectedAgentId` |

The sync actions are the MVC bridge: SSE events arrive → sync actions upsert
into `GlobalController.tickets` → signal reactivity causes UI components to
re-render.

### UI Components

Components are thin rendering shells. They read from controllers via signals and
dispatch mutations through actions.

### The Iframe Sandbox

Agent-generated React components (produced by the `ui-generator` template) run
in a sandboxed iframe (`iframe.html`). The `HostCommunicationService` and
`MessageBridge` handle a typed postMessage protocol:

- **Host → Iframe**: `render` (code + props + assets)
- **Iframe → Host**: `ready`, `navigate`, `readFile`
- **Host → Iframe (response)**: `readFile.response`

This allows React apps generated by agents to read files from the hive
filesystem and trigger navigation in the shell, while remaining sandboxed.

## How the MVC Pattern Manifests

The consumption model described in [patterns.md](./patterns.md) plays out
concretely here:

- **Model**: The scheduler's task list, delivered via SSE. The
  `GlobalController.tickets` array is the frontend's synchronized copy.
- **View**: Tags drive UI treatment. The reference app's tag vocabulary:

  | Tag         | UI effect                                                                                                   |
  | ----------- | ----------------------------------------------------------------------------------------------------------- |
  | `"chat"`    | Task appears as a thread in the floating chat window. Chat log is restored on reload.                       |
  | `"bundle"`  | Task's workspace is scanned for JS/CSS bundles, which are loaded into the iframe stage as a live React app. |
  | `"opie"`    | Identifies the root assistant (used for sidebar identity).                                                  |
  | `"journey"` | Identifies a journey-manager task (used for subagent panel grouping).                                       |

  Tags without a `"chat"` or `"bundle"` tag still appear in the sidebar tree but
  have no special UI treatment — they're visible as task nodes with status
  indicators.

- **Controller**: User interactions (chat responses, retries) flow through
  `BeesAPI` to the server, which edits the task directly. This is the gap — the
  server manipulates the model's files on behalf of the frontend, rather than
  going through a framework-provided interaction API.

## What Would Change

When the consumption API matures (see [flux.md](./flux.md)), the reference app
would:

1. Stop editing task files directly in `/respond` — use a framework-provided
   interaction surface instead.
2. Replace `SchedulerHooks` callbacks with a more principled observation API.
3. Potentially extract into its own package, consuming bees as a library.

The current implementation works but is tightly coupled to the framework's
internals. The reference app is as much a test of the consumption API's limits
as it is a product.
