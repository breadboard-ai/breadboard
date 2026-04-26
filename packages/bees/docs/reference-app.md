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
│            Agent API · SSE broadcaster                  │
│                          │                               │
│                 Bees hooks ↕                             │
├─────────────────────────────────────────────────────────┤
│                   Bees Framework                        │
│              Scheduler → Session → LLM                  │
└─────────────────────────────────────────────────────────┘
```

The server is the glue layer that projects the framework's model as REST
endpoints and SSE events. The web shell consumes those projections and renders
them as a chat UI with an embedded app stage.

## The Server (`app/server.py`)

The server has three responsibilities:

### 1. Boot the system

On startup, the server creates a `Bees` instance with session runners and
calls `bees.listen()`, which recovers stuck tasks, boots the root template
from `SYSTEM.yaml`, and starts the scheduler loop.

### 2. Project the model as REST

Every endpoint is a thin view over the task list. The server does no business
logic beyond serializing task data and writing user responses. All endpoints
use the `/agents` prefix.

#### Commands (writes)

| Endpoint                      | Method | Purpose                                |
| ----------------------------- | ------ | -------------------------------------- |
| `/agents/{id}/reply`          | POST   | Send a chat message to a suspended agent |
| `/agents/{id}/choose`         | POST   | Submit a choice selection to a suspended agent |
| `/agents/{id}/retry`          | POST   | Reset a paused agent to available      |
| `/agents/{id}/tags`           | POST   | Update agent tags                      |

`reply` and `choose` are the **controller** interaction points: when an agent
suspends with `assignee == "user"`, the web shell calls one of these endpoints
to deliver the user's response. Under the hood, they write `response.json` and
flip `assignee` to `"agent"`, then trigger the scheduler. This is the direct
model-editing pattern noted in `patterns.md` as the main gap in the consumption
API.

#### Queries (reads)

| Endpoint                       | Method | Purpose                                    |
| ------------------------------ | ------ | ------------------------------------------ |
| `/agents/{id}/bundle?slug=`    | GET    | Resolved JS/CSS bundle for an agent        |
| `/agents/{id}/files`           | GET    | List files in the agent's workspace        |
| `/agents/{id}/files/{path}`    | GET    | Serve a file from the agent's workspace    |

The `bundle` endpoint resolves the agent's JS and CSS files server-side,
eliminating a multi-step client-side fetch dance. The optional `slug` query
parameter scopes the search to a subagent's subdirectory.

### 3. Broadcast state changes via SSE

The server uses a `Broadcaster` (fan-out queue) to deliver real-time state
changes to all connected clients via Server-Sent Events.

The wiring: each typed event maps to an SSE event type via `bees.on()`.

| Bees event type       | SSE event type      | What happened                    |
| --------------------- | ------------------- | -------------------------------- |
| `TaskAdded`           | `agent:added`       | A new agent was created          |
| `TaskStarted`         | `agent:updated`     | Agent transitioned to running    |
| `TaskDone`            | `agent:updated`     | Agent reached a resting state    |
| `TaskEvent`           | `session:event`     | Running session emitted an event |
| `CycleStarted`        | `scheduler:started` | Scheduler cycle beginning        |
| `CycleComplete`       | `scheduler:stopped` | Scheduler has no more work       |

On initial connection, the SSE stream sends an `init` event with the full task
list. After that, clients receive incremental updates. There is no REST endpoint
to list all tasks — SSE `init` is the sole source of truth.

## The Web Shell (`web/`)

The frontend is a Lit application that renders the bees model as a chat-based
UI. It follows the SCA (Services, Controllers, Actions) pattern used in the
broader codebase.

### Services

| Service                    | Responsibility                                                                |
| -------------------------- | ----------------------------------------------------------------------------- |
| `BeesAPI`                  | REST wrapper — `reply()`, `choose()`, `retry()`, `getBundle()`, `getFile()`   |
| `SSEClient`                | Connects to `/events`, parses SSE, dispatches to an `EventTarget` bus.        |
| `HostCommunicationService` | postMessage bridge to the iframe-hosted React apps.                           |

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

| Action group | Trigger                          | What it does                                     |
| ------------ | -------------------------------- | ------------------------------------------------ |
| `sync/`      | SSE events (init, added, updated)| Upsert tasks into `GlobalController.tickets`     |
| `chat/`      | User input, agent messages       | Send responses via `BeesAPI.reply()` / `choose()`|
| `stage/`     | Bundle events                    | Load React apps into the iframe stage            |
| `tree/`      | Agent selection in sidebar       | Update `AgentTreeController.selectedAgentId`     |

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

When the consumption API matures (see [future.md](./future.md)), the reference
app would:

1. Stop editing task files directly in `/reply` and `/choose` — use a
   framework-provided interaction surface instead.
2. Potentially extract into its own package, consuming bees as a library.

The current implementation works but is tightly coupled to the framework's
internals. The reference app is as much a test of the consumption API's limits
as it is a product.
