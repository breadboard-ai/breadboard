> [!NOTE]
> The central thesis of this doc — bees as a pure orchestration and tooling
> framework — is now reality. The `SessionRunner` protocol lives in
> `bees/protocols/session.py`, with `GeminiRunner` and `LiveRunner` as concrete
> implementations. Key differences from this proposal: `ContextChannel` was
> absorbed into `SessionStream.send_context()`, and `dispatch.py` / `channel.py`
> were never created as separate modules. See
> [library-extraction.md](./library-extraction.md) for the current state and
> [PROJECT_ACOUSTIC.md](../../PROJECT_ACOUSTIC.md) for the Live API integration.

# Delegated Sessions — The General Case

What if _all_ sessions are delegated? What if bees never closes over the model
conversation at all?

## The observation

The current architecture configurations three concerns into one process:

1. **Orchestration** — scheduling tasks, managing dependencies, tracking
   lifecycle.
2. **Tool provisioning and dispatch** — assembling FunctionGroups, executing
   tool handlers.
3. **Session execution** — connecting to Gemini, streaming turns, managing the
   context window.

Concern #3 is the one that varies by transport. Batch sessions use
`GenerateContent` over HTTP. Live sessions use a persistent WebSocket. Future
session types might use different models, different protocols, or different
providers entirely.

If bees owns #1 and #2 but delegates #3, it becomes transport-agnostic. The
`Loop`, `GeminiClient`, `stream_generate_content` — all of that moves out of
bees and into the session runner. Bees becomes a pure orchestration and tooling
framework.

## What bees becomes

Three roles, and nothing more:

### 1. Task orchestrator

The scheduler manages task lifecycle, dependency promotion, cycle execution, and
the agent tree. This is unchanged. The scheduler still decides _when_ a task
runs and _what_ it depends on.

### 2. Tool provisioner

On request, bees assembles everything a session runner needs:

```python
@dataclass
class SessionConfiguration:
    """Everything an external runner needs to start a session."""

    task_id: str
    system_instruction: str        # Assembled from objective + skills + groups
    tool_declarations: list[dict]  # JSON schemas from enabled FunctionGroups
    model: str                     # Model identifier
    config: dict                   # Modality, voice, temperature, etc.
```

Notice what's absent: **auth**. The runner brings its own credentials. Bees
never needs an API key, an access token, or any model-provider auth. This
eliminates the `backend` parameter that currently threads through `Scheduler` →
`TaskRunner` → `run_session` → `Loop`.

The configuration is assembled using the same code paths that `run_session` uses
today — segment resolution, skill merging, function filtering — but stops before
calling the model. It hands the assembled ingredients to the session runner
rather than consuming them internally.

### 3. Tool dispatch service

When a session runner receives a tool call from the model, it forwards it to
bees for execution. Bees validates the call against the session's allowed
functions, dispatches it through the FunctionGroup handler, and returns the
result.

```
Runner → POST /dispatch { task_id, calls: [{name, args, id}] }
Bees   → validate scope → execute handler → return results
Runner ← { responses: [{id, name, response}] }
```

The handlers are the same Python async functions that `FunctionCaller` invokes
today. The only difference is who's calling them — an in-process loop vs. a
network request.

## What bees stops being

Bees no longer:

- Accepts or threads auth credentials (`backend`, API keys).
- Manages the context window or conversation history.
- Handles streaming chunks from the model.

The `opal_backend` dependency doesn't leave bees — it moves to
`bees/runners/batch.py`, isolated from the rest of the framework. The scheduler,
task store, coordination, and provisioner never import it.

## Session runners

A session runner is anything that can:

1. Accept a `SessionConfiguration`.
2. Connect to a model (bringing its own auth).
3. Run the conversation loop.
4. Report session events and completion.

Runners are **part of bees** — shipped as reference implementations, not pushed
to the app layer:

```
bees/
  runners/
    protocol.py    # SessionRunner protocol
    batch.py       # Uses opal_backend Loop + GenerateContent
    live.py        # Uses google-genai SDK + Live API WebSocket
```

| Runner        | Transport            | Model connection   | Where it runs |
| ------------- | -------------------- | ------------------ | ------------- |
| `BatchRunner` | GenerateContent HTTP | `Loop` (from opal) | Server        |
| `LiveRunner`  | WebSocket            | Gemini Live API    | Browser relay |
| `TestRunner`  | Mock                 | Scripted responses | Test harness  |

### Runner as constructor parameter

The runner is injected into `Bees` at construction time. The app layer chooses
which runners to wire in and supplies their auth:

```python
# The app creates the runner with credentials — bees never sees them.
runner = BatchRunner(
    api_key=load_gemini_key(),
    http_client=httpx.AsyncClient(timeout=httpx.Timeout(300.0)),
)

# Bees takes the runner as a parameter. No backend, no auth.
bees = Bees(hive_dir, runner=runner)
```

This means both the box and the reference app are thin shells:

```python
# box.py — filesystem-driven
runner = BatchRunner(api_key=load_gemini_key(), ...)
bees = Bees(hive_dir, runner=runner)
await bees.listen()
async for changes in awatch(hive_dir):
    bees.trigger()

# server.py — REST/SSE-driven
runner = BatchRunner(api_key=load_gemini_key(), ...)
bees = Bees(hive_dir, runner=runner)
app = build_fastapi_app(bees)
```

Neither constructs an `HttpBackendClient`. Neither threads auth through the
scheduler. The runner encapsulates all model-provider concerns.

## The context channel

Dynamic steering — pushing context updates into a running session mid-turn — is
essential. The current `context_queue` (`asyncio.Queue`) is the implementation,
but the abstraction is: **the scheduler can push a message into any running
session**.

In the delegated model, the context channel becomes a named, transport-aware
pipe:

```python
class ContextChannel(Protocol):
    """Push context updates into a running session."""

    def push(self, parts: list[dict]) -> None: ...
```

Implementations vary by runner location:

| Runner location | Channel implementation                                  |
| --------------- | ------------------------------------------------------- |
| In-process      | `asyncio.Queue` (unchanged from today)                  |
| Same server     | Direct function call to the runner's injection point    |
| Browser (SSE)   | SSE event → browser calls `session.send_client_content` |
| Remote server   | Webhook POST to runner's callback URL                   |
| Disconnected    | Buffer in metadata, drain on next poll                  |

### How context flows in each case

**Batch (in-process):**

```
Child agent calls events_send_to_parent
  → Scheduler._deliver_context_update(parent_id, update)
    → queue.put_nowait(parts)          # asyncio.Queue, same as today
      → Loop drains queue at turn boundary
        → parts appended to contents
```

No change from today. The delegation is conceptual — the implementation
short-circuits because runner and dispatcher share a process.

**Live (browser via SSE):**

```
Child agent calls events_send_to_parent
  → Scheduler._deliver_context_update(parent_id, update)
    → Broadcaster.broadcast({type: "context:update", task_id, parts})
      → SSE pushes to browser
        → Browser receives event
          → session.send_client_content(turns={parts})
            → Gemini Live API receives context mid-session
```

The Live API's `send_client_content` is designed exactly for this — injecting
context into a running session without interrupting the audio stream.

### The three delivery paths, generalized

The scheduler's `_deliver_context_update` currently has three paths:

1. Mid-stream injection (live queue)
2. Immediate resume (write response.json)
3. Buffer in metadata

These generalize cleanly:

| Current path       | Generalized                                    |
| ------------------ | ---------------------------------------------- |
| Mid-stream (queue) | Push to the session's `ContextChannel`         |
| Resume             | Unchanged — write response.json, flip assignee |
| Buffer             | Unchanged — stash in metadata for later drain  |

Path 1 changes implementation (queue → channel). Paths 2 and 3 are already
transport-independent — they operate on the filesystem regardless of session
type.

## The co-located optimization

Full delegation doesn't mean full indirection. When the session runner and the
tool dispatcher share a process — the common case for batch sessions — the
system short-circuits:

- **Tool dispatch**: direct function calls, no network hop.
- **Context channel**: `asyncio.Queue`, no serialization.
- **Lifecycle events**: in-process callbacks, no SSE.

The delegation model is the _conceptual_ architecture. The in-process path is
the _optimized_ implementation for the common case. Both conform to the same
interface, so the system works identically when the runner is remote.

```python
# bees/runners/protocol.py
class SessionRunner(Protocol):
    async def run(
        self, configuration: SessionConfiguration, channel: ContextChannel,
    ) -> SessionResult: ...

# bees/runners/batch.py — in-process, calls handlers directly
class BatchRunner:
    def __init__(self, api_key: str, http_client: httpx.AsyncClient): ...

    async def run(
        self, configuration: SessionConfiguration, channel: ContextChannel,
    ) -> SessionResult:
        loop = Loop(...)  # From opal_backend
        args = AgentRunArgs(
            objective=configuration.system_instruction,
            function_groups=configuration.tool_declarations,
            context_queue=channel,  # asyncio.Queue for in-process
            ...
        )
        return await loop.run(args)
```

## What this changes in the codebase

### Moves within `bees/`

| Current location       | New location            | What                            |
| ---------------------- | ----------------------- | ------------------------------- |
| `bees/session.py`      | `bees/runners/batch.py` | `run_session`, `resume_session` |
| `opal_backend` imports | `bees/runners/batch.py` | Loop, streaming (isolated)      |

### Stays in `bees/`

| Module                  | What                                       |
| ----------------------- | ------------------------------------------ |
| `bees/scheduler.py`     | Task orchestration, cycle logic            |
| `bees/task_runner.py`   | Metadata bookkeeping (delegates to runner) |
| `bees/functions/`       | FunctionGroup handlers                     |
| `bees/declarations/`    | Tool schemas and instructions              |
| `bees/segments.py`      | Prompt assembly                            |
| `bees/disk_file_system` | File system for tool handlers              |
| `bees/task_store.py`    | Task persistence                           |
| `bees/coordination.py`  | Cross-task event routing                   |

### New in `bees/`

| Module                     | What                                          |
| -------------------------- | --------------------------------------------- |
| `bees/runners/protocol.py` | SessionRunner protocol                        |
| `bees/runners/batch.py`    | BatchRunner (current session.py, reorganized) |
| `bees/runners/live.py`     | LiveRunner (Gemini Live API, new)             |
| `bees/provisioner.py`      | SessionConfiguration assembly from templates  |
| `bees/dispatch.py`         | Tool dispatch validation and execution        |
| `bees/channel.py`          | ContextChannel protocol and implementations   |

### Simplified in `app/`

Both the box and the reference app get simpler — they stop constructing
`HttpBackendClient` and threading it through bees. They just pick a runner:

| Module          | Before                                        | After                                   |
| --------------- | --------------------------------------------- | --------------------------------------- |
| `app/server.py` | Creates `HttpBackendClient`, passes to `Bees` | Creates `BatchRunner`, passes to `Bees` |
| `bees/box.py`   | Creates `HttpBackendClient`, passes to `Bees` | Creates `BatchRunner`, passes to `Bees` |

Live API support is added by passing a `LiveRunner` alongside the `BatchRunner`.
The app decides which runners to enable; bees routes tasks to the appropriate
runner based on the template's `session_type`.

## Implications

**The framework boundary sharpens.** Today, bees is a framework that happens to
include a session executor. After this change, bees is a framework that
provisions sessions and dispatches tools. The runners ship with bees as
reference implementations, but the boundary between orchestration and execution
is explicit. This aligns with the extraction goal in `docs/future.md` — bees as
an installable library with a clean API.

**Auth drops out of the core.** The `backend` parameter — currently threaded
through `Bees` → `Scheduler` → `TaskRunner` → `run_session` → `Loop` — moves to
the runner's constructor. The scheduler, task store, coordination layer, and
provisioner never see credentials. Auth is the app's concern, handed to the
runner at construction time.

**Testing simplifies.** Bees' orchestration tests cover scheduling,
provisioning, and tool dispatch — no Gemini mocking needed. Runner tests mock
the model client in isolation. A `TestRunner` with scripted responses makes
integration tests deterministic.

**The reference app gets simpler, not more complex.** The app doesn't gain the
session execution responsibility — bees ships the runners. The app just chooses
which runner to instantiate and supplies credentials. Both the box and the
reference app shrink to thin shell code.

**Live sessions become first-class.** They're not a special case bolted onto a
batch-centric framework. They're a runner that speaks a different protocol to
the same provisioning and dispatch infrastructure. The framework doesn't
privilege any transport.

## Open questions

**Suspend/resume across runners.** Batch sessions suspend by serializing
conversation state. The `BatchRunner` handles this internally (it has access to
the `Loop`'s contents). But bees needs to know the session is suspended (to
track status). The runner reports status changes; bees doesn't own the
mechanics.

**MCP lifecycle.** MCP server connections are currently established per-session
inside bees. Under delegation, the dispatch endpoint needs active MCP
connections. Who manages their lifecycle — bees (as part of tool dispatch
infrastructure) or the runner? Bees seems right, since MCP tools are dispatched
through bees regardless of runner type.

**Gradual migration.** This doesn't have to happen all at once. The first step
is the `SessionConfiguration` + dispatch endpoint (for Live sessions). The
second step is extracting `BatchRunner` from `session.py` into the reference
app. The existing code path continues to work throughout.
