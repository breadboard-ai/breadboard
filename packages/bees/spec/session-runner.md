# SessionRunner — Spec Doc

**Goal**: Define the `SessionRunner` protocol — the contract between bees
(orchestration) and a model provider (session execution) — and extract the
common event-draining pattern into a reusable `drain_session` function. This is
the final protocol in the library extraction.

## Context

With the previous seven specs complete, `session.py` has been separated into:

- **Provisioning** (`provisioner.py`) — assembles `SessionConfiguration`, zero
  opal deps. ✅
- **Observation types** (`protocols/session.py`) — `SessionResult`,
  `SUSPEND_TYPES`, `PAUSE_TYPES`, `SessionConfiguration`, `SessionStream`,
  `SessionEvent`. ✅
- **Event collection** (`session.py`) — `EvalCollector`,
  `_print_event_summary`. Opal-free. ✅
- **Execution** (`session.py`) — `run_session()`, `resume_session()`. Deep opal
  deps. ← **this spec**

The `SessionRunner` protocol formalizes the execution boundary. Everything above
(provisioning, observation, task orchestration) stays in `bees`. Everything
below (model API calls, event generation) moves to the runner.

### Remaining `opal_backend` imports after this spec

| Module             | Current imports                                        | After this spec        |
| ------------------ | ------------------------------------------------------ | ---------------------- |
| `session.py`       | `HttpBackendClient`, `InMemoryInteractionStore`, `InteractionState`, `new_session`, `start_session`, `resume_session`, `Subscribers`, `InMemorySessionStore`, `register_task` | Same (migration is next spec) |
| `scheduler.py`     | `HttpBackendClient` (type annotation)                  | Same                   |
| `box.py`           | `HttpBackendClient`, `app.auth`, `app.config`          | Same                   |
| `handler_types.py` | Transitional back-imports (`SuspendError`, `AgentResult`) | Same                 |

This spec **specifies and tests** the boundary. The migration (restructuring
`task_runner.py`, creating `GeminiRunner`, removing opal imports) is the
follow-up spec.

## Design Decisions

### Two methods: `run` and `resume`

A session runner has two entry points:

- `run(config)` — start a new session from segments
- `resume(config, state, response)` — continue a suspended session

Both return a `SessionStream` (already defined). The distinction matters because
resume requires opaque state from the previous run plus the user's response.

### Both methods are async

`run` and `resume` are `async def` — they may perform async setup (creating
stores, calling API initialization) before returning the stream.
Initialization errors raise directly from `run()`/`resume()`. Execution
errors come through the event stream as `{"error": {...}}` events.

### Resume state is opaque bytes

`stream.resume_state()` returns `bytes | None`. Bees persists it to disk
without interpretation. On resume, bees reads the blob and passes it to
`runner.resume()`.

For the batch `GeminiRunner`, this blob is serialized JSON containing
`session_id`, `interaction_id`, and `InteractionState`. For a future Live
runner, it could be a session resumption token.

### Context injection: two paths, one protocol

1. **On resume** — accumulated context updates from the response and from
   `pending_context_updates` in task metadata → pre-processed by bees into
   context parts → passed as `context_parts` to `runner.resume()`.
2. **Mid-session** — new updates arriving while running → caller invokes
   `stream.send_context(parts)`.

Both paths are already accounted for in `SessionStream`. The `context_queue`
parameter threading through `run_session` → `new_session` disappears — the
runner manages its own internal queue.

### Suspend events include the triggering function name

Currently `task_runner._handle_suspend` peeks into persisted `InteractionState`
to extract `function_call_part.functionCall.name`. With opaque resume state, the
runner must include `function_name` in the suspend event dict before yielding it.
This is metadata enrichment — the runner knows which function triggered the
suspend because it processed the function call.

> **Mirror, then evolve.** The initial `GeminiRunner` can either (a) include
> `function_name` in suspend events, or (b) expose it via a structured
> `resume_state()` that bees parses. Option (a) is cleaner because it keeps
> resume state truly opaque. Noted as a migration detail, not a spec concern.

### `drain_session` is the composition point

A new function encapsulates the bees-side event loop — the duplicated pattern
in both `run_session()` and `resume_session()`:

```
subscribe → create collector → drain events → write logs → build SessionResult
```

After migration, `task_runner.run_task()` becomes:

```python
config = provision_session(...)
stream = await runner.run(config)
self._active_streams[task.id] = stream    # for mid-session context injection
try:
    result = await drain_session(stream, config=config, ...)
finally:
    del self._active_streams[task.id]

resume_state = stream.resume_state()
if resume_state:
    save_resume_state(ticket_dir, resume_state)
```

The 15-parameter `run_session()` call becomes four clean steps: provision, run,
observe, persist.

### `HttpBackendClient` disappears from bees

Currently `Bees.__init__`, `Scheduler.__init__`, and `TaskRunner.__init__` all
accept/pass `backend: HttpBackendClient`. After migration, they accept
`runner: SessionRunner`. The `HttpBackendClient` lives entirely inside
`bees-gemini`, constructed by the application layer (`box.py` or the web app).

### `drain_session` lives in `session.py`

`session.py` already holds `EvalCollector`, `_print_event_summary`, and
`_write_eval_log` — all observation concerns. `drain_session` composes them. After
migration, `run_session()` and `resume_session()` are removed and `session.py`
becomes purely the observation module.

## Protocol Inventory

| Type / Function         | Status             | Category |
| ----------------------- | ------------------ | -------- |
| `SessionRunner`         | ✅ Spec'd + Tested | Specify  |
| `drain_session`         | ✅ Implemented     | Specify  |
| `save_resume_state`     | ✅ Implemented     | Specify  |
| `load_resume_state`     | ✅ Implemented     | Specify  |

## Protocol Shapes

### `SessionRunner`

```python
@runtime_checkable
class SessionRunner(Protocol):
    """Contract: execute a session and return an event stream.

    The runner owns the model interaction — API calls, turn management,
    function dispatch.  It receives a provisioned configuration (function
    groups, file system, segments) and returns a stream of events.

    The framework (bees) owns observation (EvalCollector), orchestration
    (Scheduler), and persistence (resume state to disk).
    """

    async def run(
        self,
        config: SessionConfiguration,
    ) -> SessionStream:
        """Start a new session and return an event stream.

        The stream yields events until the run ends (completion,
        suspension, pause, or error).  After the stream exhausts,
        ``stream.resume_state()`` provides the opaque blob needed
        to resume (or ``None`` if the run completed).
        """
        ...

    async def resume(
        self,
        config: SessionConfiguration,
        *,
        state: bytes,
        response: dict[str, Any],
        context_parts: list[dict[str, Any]] | None = None,
    ) -> SessionStream:
        """Resume a suspended session.

        Args:
            config: Same provisioned configuration as ``run()``.
            state: Opaque resume state from a previous
                ``stream.resume_state()`` call.
            response: The user's response dict (text, structured data).
            context_parts: Pre-formatted context parts to inject at
                the start of the resumed session.  Assembled by bees
                from ``response.context_updates`` and
                ``pending_context_updates`` in task metadata.
        """
        ...
```

### `drain_session`

```python
async def drain_session(
    stream: SessionStream,
    *,
    config: SessionConfiguration,
    ticket_id: str | None = None,
    on_event: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> SessionResult:
    """Drain a session stream into a SessionResult.

    Iterates the stream, collects events via ``EvalCollector``, writes
    eval logs at turn boundaries, prints event summaries, and builds
    the final ``SessionResult``.

    The caller is responsible for:
    - Mid-session context injection via ``stream.send_context()``.
    - Persisting ``stream.resume_state()`` after this returns.
    """
    ...
```

### Resume state persistence

```python
def save_resume_state(ticket_dir: Path, state: bytes) -> None:
    """Persist opaque resume state to the ticket directory."""
    ...

def load_resume_state(ticket_dir: Path) -> bytes | None:
    """Load saved resume state, or None if not found."""
    ...
```

These replace the existing `save_session_state` / `load_session_state` pair.
The file format changes from structured JSON (`session_state.json`) to an
opaque blob (`resume_state.bin`).  `clear_session_state` becomes
`clear_resume_state` for symmetry.

## Migration Notes

### This spec (Phase 1: Specify + Test)

1. Add `SessionRunner` protocol to `bees/protocols/session.py`.
2. Implement `drain_session` in `bees/session.py`.
3. Implement `save_resume_state` / `load_resume_state` in `bees/session.py`.
4. Write conformance tests.
5. Update `bees/protocols/__init__.py` exports.
6. Update `docs/future.md` progress.

### Next spec (Phase 2: Migrate)

1. Create `GeminiRunner` in `bees-gemini` wrapping opal's session API.
2. Restructure `task_runner.py` to use
   `runner.run(config)` + `drain_session()`.
3. Change `Scheduler.__init__` / `Bees.__init__` to accept `SessionRunner`
   instead of `HttpBackendClient`.
4. Change `box.py` to construct `GeminiRunner` and pass to `Bees`.
5. Remove `run_session()` / `resume_session()` from `session.py`.
6. Remove transitional back-imports in `handler_types.py`.

### Friction: `task_runner._handle_suspend` peeks into InteractionState

Lines 281–290 of `task_runner.py` read
`interaction_state.function_call_part.functionCall.name` from persisted session
state to annotate suspend events with the triggering function's name. With
opaque resume state, this information must come from elsewhere.

**Resolution (deferred to Phase 2):** The `GeminiRunner` includes
`function_name` in suspend event dicts before yielding them.  This is a
one-line enrichment inside the runner, and it keeps resume state truly opaque.

### Friction: `_save_session_state` extracts interaction_id from suspend events

The current `_save_session_state` (lines 759–802) does complex extraction:
finding `interaction_id` from the suspend event, falling back to the session
store, then loading the InteractionState.  With the runner protocol, all of
this is replaced by `stream.resume_state()` — the runner knows its own
resumption needs.

### Friction: `box.py` imports `app.auth` and `app.config`

These are application concerns (loading the Gemini key, resolving hive dir from
environment). They stay in `box` — the CLI runner package, not the `bees`
library. After Phase 2, box constructs a `GeminiRunner` with the loaded
credentials and passes it to `Bees`.

## Conformance Testing Strategy

1. **`SessionRunner` protocol satisfaction**: a minimal mock with `run()` and
   `resume()` satisfies the protocol via `isinstance`.

2. **`drain_session` with mock stream**: create a `MockStream` that yields a
   predetermined event sequence (thought → functionCall → usageMetadata →
   complete). Verify `drain_session` produces a correct `SessionResult` with
   expected `turns`, `thoughts`, `outcome`, etc.

3. **`drain_session` with suspend**: mock stream yields a `waitForInput` event
   then exhausts.  Verify `result.suspended` is `True` and
   `result.suspend_event` contains the event.

4. **`drain_session` with pause**: mock stream yields a `paused` event.
   Verify `result.paused` is `True` and `result.error` is set.

5. **Resume state round-trip**: `save_resume_state` / `load_resume_state`
   correctly persist and recover arbitrary bytes.

6. **Accessibility**: `SessionRunner` is accessible from `bees.protocols`.

## Dependencies

All dependencies are already extracted:

- `SessionConfiguration` — `bees/protocols/session.py` ✅
- `SessionStream` — `bees/protocols/session.py` ✅
- `SessionResult` — `bees/protocols/session.py` ✅
- `SessionEvent` — `bees/protocols/session.py` ✅
- `SUSPEND_TYPES` / `PAUSE_TYPES` — `bees/protocols/session.py` ✅
- `EvalCollector` — `bees/session.py` (opal-free) ✅

This spec is a leaf.
