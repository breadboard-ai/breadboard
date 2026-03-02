# Opal Backend

Python package that powers the Opal agent loop — a Gemini function-calling
orchestrator that streams events over SSE. This code is being migrated from an
in-browser TypeScript implementation to a server-side Python backend.

See [PROJECT_CORNERSTONE.md](../../PROJECT_CORNERSTONE.md) for the full
migration plan and history.

## Architecture

```
opal_backend/                 ← SYNCED to production (google3)
├── run.py                       Public API: run() / resume()
├── loop.py                      Gemini function-calling orchestrator
├── events.py                    22 typed event models (wire protocol)
├── agent_events.py              Event sink + hooks adapter
├── gemini_client.py             Streaming Gemini API client
├── conform_body.py              Data part transforms (storedData → fileData)
├── pidgin.py                    Segment → pidgin text translation
├── step_executor.py             One Platform executeStep client
├── agent_file_system.py         In-memory virtual file system
├── task_tree_manager.py         Hierarchical task tree
├── suspend.py                   Suspend/resume primitives
├── interaction_store.py         InteractionStore protocol
├── backend_client.py            BackendClient protocol (no deps)
├── function_definition.py       FunctionDefinition / FunctionGroup types
├── function_caller.py           Async function dispatch
├── shared_schemas.py            Shared parameter schemas
└── functions/                   Function groups (system, generate, image, ...)

opal_backend/local/           ← NOT synced (local-only implementations)
├── api_surface.py               FastAPI router + AgentBackend protocol
├── backend_client_impl.py       HTTP-based BackendClient
├── interaction_store_impl.py    In-memory InteractionStore
├── pending_requests.py          Pending request map for fake server
└── sse_sink.py                  SSE event sink adapter

opal_backend/dev/             ← Dev server (real Gemini, proxy to One Platform)
└── main.py                      FastAPI app

opal_backend/fake/            ← Fake server (canned scenarios, no API calls)
├── main.py                      FastAPI app
└── scenarios.py                 echo, chat, graph-edit, consent

tests/                        ← pytest test suite (20 files, 300+ tests)
```

### Sync Boundary

Everything in `opal_backend/*.py` and `opal_backend/functions/` ships to the
production backend via copybara. These modules have **zero external
dependencies** — no `httpx`, `fastapi`, or `pydantic` imports. All transport is
injected through protocols (`BackendClient`, `InteractionStore`).

Everything in `opal_backend/local/`, `opal_backend/dev/`, and
`opal_backend/fake/` is local-only development infrastructure.

## Quick Start

### Setup

```bash
# From repo root — creates .venv and installs all dependencies
npm run setup -w packages/opal-backend
```

### Dev Server (real Gemini APIs)

```bash
# Starts unified-server (port 3000) + Python dev backend (port 8080)
npm run dev:backend -w packages/unified-server
```

Or run the Python server directly:

```bash
npm run dev -w packages/opal-backend
```

### Fake Server (canned scenarios)

```bash
npm run dev:fake -w packages/opal-backend
```

### Tests

```bash
# All tests
npm run test -w packages/opal-backend

# Single file
.venv/bin/python -m pytest tests/test_loop.py -v
```

### Type Checking

```bash
npm run typecheck -w packages/opal-backend
```

## Key Concepts

### The Agent Loop

`Loop.run()` is the core orchestrator. It sends an objective to Gemini, parses
function calls from the response, dispatches them concurrently, feeds results
back, and repeats until a termination function fires or an error occurs.

### Wire Protocol

22 `AgentEvent` types stream from server to client over SSE. Each is a dataclass
with a `to_dict()` method producing camelCase JSON. See `events.py` for the
complete type catalog.

### Suspend/Resume

When a function needs user input (text, choices, graph edits), it raises
`SuspendError`. The loop catches it, saves state via `InteractionStore`, and
closes the SSE stream. The client POSTs back with `{interactionId, response}` to
resume — this is the "reconnect, not keepalive" pattern.

### Pidgin

The pidgin vocabulary is a lightweight markup language (`<file>`, `<asset>`,
`<content>`, `<objective>` tags) that encodes structured content for the agent.
`pidgin.py` is the single source of truth for this vocabulary.

### Function Groups

Functions are organized into groups, each with an optional system instruction:
`system`, `generate`, `image`, `video`, `audio`, `chat`. See
`opal_backend/functions/README.md`.
