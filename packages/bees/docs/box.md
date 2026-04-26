# Box — Filesystem-Driven Orchestrator

The box is a file-watching alternative to the HTTP server. Instead of exposing
a REST API, it watches the hive directory for changes and drives the scheduler
through filesystem events. Named after the hive box — the physical structure
that houses bees.

## Overview

```
┌──────────────────────────────────────────────────┐
│               Hivetool (browser)                 │
│    File System Access API — reads and writes     │
│                      │                           │
│              filesystem ↕                        │
├──────────────────────────────────────────────────┤
│              Hive Directory (disk)               │
│   config/   skills/   tickets/   logs/           │
│                      │                           │
│            watchfiles ↕                           │
├──────────────────────────────────────────────────┤
│                Box (bees.box)                    │
│         classify → restart or trigger            │
│                      │                           │
│               Bees hooks ↕                       │
├──────────────────────────────────────────────────┤
│                Bees Framework                    │
│           Scheduler → Session → LLM             │
└──────────────────────────────────────────────────┘
```

The filesystem is the API. Any process that writes files in the right shape —
hivetool, a shell script, VS Code, `echo` — can drive the system. The box
never needs to know who wrote the files.

## How it works

The box runs a single `asyncio` event loop with two conceptually distinct
watchers sharing one `watchfiles.awatch()` stream on the hive root.

### Config watcher (cold restart)

Changes to configuration files cause the box to shut down the current `Bees`
instance and restart with fresh configuration. This covers:

| Path                      | What changed                    |
| ------------------------- | ------------------------------- |
| `config/SYSTEM.yaml`      | System identity, root template  |
| `config/TEMPLATES.yaml`   | Template definitions            |
| `config/hooks/*.py`       | Template lifecycle hooks        |
| `skills/**`               | Agent skill files                |

On restart, `Bees` re-reads all configuration, reconnects MCP servers, recovers
stuck tasks, and re-boots the root template if needed — the same startup
sequence as the HTTP server.

### Task watcher (hot trigger)

Changes under `tickets/` wake the scheduler to re-evaluate available work.
The scheduler's existing cycle logic handles all the details:

- New ticket directory appears → scheduler finds it as `available`, runs it.
- `metadata.json` changes (status flipped, assignee changed) → scheduler
  promotes blocked tasks, resumes responded tasks.
- `response.json` written → scheduler picks up the response and resumes the
  suspended agent.

The box calls `bees.trigger()` — the same mechanism the HTTP server uses after
processing a REST request.

### Ignored paths

Changes to `logs/` and other directories outside `config/`, `skills/`, and
`tickets/` are silently ignored.

## The two-loop structure

```python
# Pseudocode — see bees/box.py for the real implementation.

async def run(hive_dir, *, gemini_key):
    runners = {
        "generate": GeminiRunner(backend),
        "live": LiveRunner(api_key=gemini_key),
    }
    while True:                          # Outer: cold restart loop
        bees = Bees(hive_dir, runners)
        bees.on(TaskAdded, _on_task_added)
        bees.on(TaskDone, _on_task_done)
        # ...
        bees.listen()

        async for changes in awatch(hive_dir):   # Inner: file watch
            for path in changes:
                kind = classify_change(path, hive_dir)
                if kind == "config":
                    break  # → restart
                if kind == "task":
                    bees.trigger()

        bees.shutdown()
```

Config changes break the inner loop. The outer loop restarts `Bees` from
scratch. Task changes trigger the scheduler without restarting. Graceful
shutdown on `SIGINT`/`SIGTERM` cancels and cleans up.

## Usage

```bash
# Default hive (packages/bees/hive):
npm run dev:box -w packages/bees

# Custom hive:
BEES_HIVE_DIR=/path/to/hive npm run dev:box -w packages/bees

# Direct invocation:
python -m bees.box
```

The box reads `GEMINI_KEY` and `BEES_HIVE_DIR` from the environment (or
`.env`), identical to the HTTP server.

## Comparison with the HTTP server

| Concern                | HTTP Server (`app/server.py`)     | Box (`bees/box.py`)               |
| ---------------------- | --------------------------------- | --------------------------------- |
| Client communication   | REST + SSE                        | Filesystem                        |
| Task creation          | `POST /agents/{id}/reply`         | Write `response.json` + metadata  |
| State observation      | SSE event stream                  | `FileSystemObserver` (hivetool)   |
| Config reload          | `uvicorn --reload`                | Built-in config watcher           |
| Dependencies           | FastAPI, uvicorn, sse-starlette   | watchfiles                        |
| Use case               | Reference app (web shell)         | Local dev, headless, CI           |

The HTTP server is part of the reference application — a full web-based product.
The box is a library-level tool — minimal infrastructure for running bees
locally without a server.

## Observability

The box subscribes to typed scheduler events via `bees.on()` and logs them to
stderr via Python's `logging` module:

```
18:25:01 [INFO] bees.box: Box starting — watching /path/to/hive
18:25:01 [INFO] bees.box: Bees started — watching for changes
18:25:03 [INFO] bees.box: Agent added: planner (a3cb7443)
18:25:03 [INFO] bees.box: Cycle 1: 1 new + 0 resumable
18:25:03 [INFO] bees.box: Agent running: planner (a3cb7443)
18:25:15 [INFO] bees.box: Agent completed: planner (a3cb7443)
18:30:22 [INFO] bees.box: Config change detected — restarting
18:30:22 [INFO] bees.box: Restarting bees...
```

## Driving the box from the command line

Since the filesystem is the API, you can interact with the box using standard
Unix tools:

```bash
# Create a new task:
TASK_ID=$(uuidgen)
mkdir -p hive/tickets/$TASK_ID
echo "Summarize the project README" > hive/tickets/$TASK_ID/objective.md
echo '{"status":"available","created_at":"2026-04-15T00:00:00Z"}' \
  > hive/tickets/$TASK_ID/metadata.json

# Reply to a suspended task:
echo '{"text":"Yes, proceed with that approach"}' \
  > hive/tickets/$TASK_ID/response.json
# Then flip assignee in metadata.json to "agent"

# Retry a paused task:
# Edit metadata.json: set status to "available", clear error
```

This makes the box scriptable, testable, and composable with any tool that can
write files.
