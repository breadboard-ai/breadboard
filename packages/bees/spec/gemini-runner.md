# GeminiRunner — Spec Doc

**Goal**: Create a concrete `SessionRunner` implementation that wraps opal's
session API. This is Phase 1 of the SessionRunner migration — pure additive
code, nothing else changes.

## Context

The `SessionRunner` protocol and supporting types (`SessionStream`,
`SessionConfiguration`, `drain_session`) are specified and tested. What's
missing is the concrete implementation — the adapter between bees' protocol and
opal's session API (`new_session`, `start_session`, `resume_session`).

Today, `session.py`'s `run_session()` and `resume_session()` inline this logic
directly. Phase 1 extracts it into a standalone class that satisfies the
`SessionRunner` protocol, without touching the existing call sites.

### What `run_session()` does (the pattern to wrap)

```
1.  Create InMemorySessionStore, InMemoryInteractionStore, Subscribers
2.  session_id = uuid4()
3.  Call new_session(session_id, segments, store, backend, interaction_store,
        flags={}, graph={}, extra_groups, function_filter, model, file_system,
        context_queue)
4.  queue = subscribers.subscribe(session_id)
5.  task = asyncio.create_task(start_session(session_id, store, subscribers))
6.  register_task(session_id, task)
7.  Drain queue: while True → event = await queue.get() → None = break
8.  await task
9.  If suspended/paused → _save_session_state(...)
10. Build SessionResult from collector
```

### What `resume_session()` does

```
1.  Load session state from JSON (session_id, interaction_id, InteractionState)
2.  Provision session (function groups, file system)
3.  Create stores + subscribers
4.  Call new_session (same as run, without model)
5.  Set session status = "suspended", resume_id, save interaction state
6.  Assemble context parts from response + pending updates
7.  queue = subscribers.subscribe(session_id)
8.  task = asyncio.create_task(api_resume_session(session_id, response,
        store, subscribers, context_parts))
9.  register_task(session_id, task)
10. Drain queue
11. If suspended/paused → _save_session_state(...)
```

Steps 7–10 in both paths are identical — the queue-drain-to-async-iterator
pattern. That's `GeminiStream`.

Steps 1–6 (run) and 1–8 (resume) are the setup — creating opal infrastructure
and starting the session. That's `GeminiRunner.run()` and
`GeminiRunner.resume()`.

Step 9/11 (state capture) is `GeminiStream.resume_state()`.

## Design Decisions

### `GeminiStream` wraps the queue-to-async-iterator pattern

Opal's event delivery is queue-based: `Subscribers.subscribe()` returns an
`asyncio.Queue`, events arrive via `queue.get()`, `None` is the sentinel.
`GeminiStream` wraps this into a `SessionStream` (async iterator with
back-channel methods).

The stream handles:

- `__aiter__` / `__anext__`: drain the queue, raise `StopAsyncIteration` on
  `None`.
- `send_context(parts)`: push to the internal context queue (same queue passed
  to `new_session`).
- `send_tool_response(responses)`: no-op for the batch API (opal dispatches
  tools internally). Satisfies the protocol signature.
- `resume_state()`: returns the opaque blob captured when the stream exhausts.

### Resume state capture happens eagerly

`resume_state()` is sync (per the `SessionStream` protocol). The state capture
(reading from opal's interaction store) is async. So the stream captures the
state eagerly inside `__anext__` when it receives the `None` sentinel, before
raising `StopAsyncIteration`. The sync `resume_state()` then returns the
pre-captured blob.

### Resume state blob format

The blob is JSON bytes containing:

```json
{
  "session_id": "...",
  "interaction_id": "...",
  "interaction_state": { ... },
  "function_name": "request_user_input"
}
```

`function_name` is extracted from the `InteractionState.function_call_part`
field during capture. Including it in the blob lets the consumer annotate
suspend events without interpreting the interaction state itself. This resolves
the friction noted in the session-runner spec (task_runner currently peeks into
`InteractionState` to get the function name).

### `GeminiRunner` owns the opal infrastructure per-session

Each `run()` / `resume()` call creates its own `InMemorySessionStore`,
`InMemoryInteractionStore`, `Subscribers`, and context queue. These are
short-lived — they exist for the duration of one session run. The runner holds
only the `HttpBackendClient` (shared across sessions).

### Temporary home in `bees/runners/`

The runner lives in `bees/runners/gemini.py` temporarily. It imports from
`opal_backend` — that's expected, since it IS the opal adapter. Phase 5
(`gemini-runners-package`) moves it out. For now, having it in `bees/` keeps
iteration fast and avoids premature packaging.

### Context queue wiring

Currently, `run_session()` receives `context_queue` as a parameter and passes it
to `new_session`. Mid-session context injection works by the scheduler pushing
parts to this queue.

In the `GeminiRunner`, the stream creates its own internal context queue, passes
it to `new_session`, and exposes `send_context()` to push to it. The caller
(eventually `task_runner`) holds a reference to the stream and calls
`stream.send_context()` instead of pushing to an external queue.

This inverts the control: today the queue is created externally and threaded
through; after migration, the stream owns the queue and exposes a method.

## Protocol Inventory

| Type / Function | Status  | Category |
| --------------- | ------- | -------- |
| `GeminiStream`  | Pending | Specify  |
| `GeminiRunner`  | Pending | Specify  |

## Protocol Shapes

### `GeminiStream`

```python
class GeminiStream:
    """SessionStream wrapping opal's queue-based event delivery.

    Created by GeminiRunner.run() and .resume().  Drains the opal
    subscriber queue as an async iterator.  Captures resume state
    eagerly when the stream exhausts.
    """

    def __init__(
        self,
        *,
        queue: asyncio.Queue,
        task: asyncio.Task,
        context_queue: asyncio.Queue,
        session_id: str,
        session_store: InMemorySessionStore,
        interaction_store: InMemoryInteractionStore,
        collector: EvalCollector | None = None,
    ) -> None: ...

    def __aiter__(self) -> AsyncIterator[dict[str, Any]]: ...

    async def __anext__(self) -> dict[str, Any]:
        """Yield next event, or capture state and stop.

        On None sentinel:
        1. await the background task
        2. capture resume state from opal stores
        3. raise StopAsyncIteration
        """
        ...

    async def send_tool_response(
        self, responses: list[dict[str, Any]],
    ) -> None:
        """No-op for batch API (tools dispatched internally)."""
        ...

    async def send_context(
        self, parts: list[dict[str, Any]],
    ) -> None:
        """Push context parts to the internal queue."""
        ...

    def resume_state(self) -> bytes | None:
        """Return opaque resume blob, or None if run completed."""
        ...
```

### `GeminiRunner`

```python
class GeminiRunner:
    """SessionRunner backed by opal's session API.

    Wraps new_session + start_session / resume_session into the
    SessionRunner protocol.  Each run()/resume() creates short-lived
    opal infrastructure (stores, subscribers) and returns a GeminiStream.
    """

    def __init__(self, backend: HttpBackendClient) -> None: ...

    async def run(
        self,
        config: SessionConfiguration,
    ) -> GeminiStream:
        """Start a new session.

        1. Create stores, subscribers, context queue
        2. Call new_session() with config
        3. Subscribe to event queue
        4. Start start_session() as background task
        5. Return GeminiStream wrapping the queue
        """
        ...

    async def resume(
        self,
        config: SessionConfiguration,
        *,
        state: bytes,
        response: dict[str, Any],
        context_parts: list[dict[str, Any]] | None = None,
    ) -> GeminiStream:
        """Resume a suspended session.

        1. Deserialize resume state blob
        2. Create stores, subscribers, context queue
        3. Call new_session() and set up resume state in stores
        4. Start api_resume_session() as background task
        5. Return GeminiStream wrapping the queue
        """
        ...
```

## Migration Notes

### This spec (Phase 1: Implement)

1. Create `bees/runners/__init__.py` (empty).
2. Create `bees/runners/gemini.py` with `GeminiStream` and `GeminiRunner`.
3. Write conformance tests in `tests/test_runners/test_gemini_runner.py`.
4. Update `docs/future.md` progress.

### Friction: `_save_session_state` logic moves into `GeminiStream`

The current `_save_session_state` (session.py lines 884–927) does:

1. Extract `interaction_id` from suspend event or session store
2. Load `InteractionState` from interaction store
3. Serialize to JSON and write to disk

Steps 1–2 move into `GeminiStream._capture_resume_state()`. Step 3 (disk write)
stays in the caller — `save_resume_state()` already exists for that. The stream
captures but doesn't persist; the caller (eventually task_runner) calls
`save_resume_state(ticket_dir, stream.resume_state())`.

### Friction: `context_queue` parameter threading

`run_session()` accepts `context_queue` from the caller and passes it to
`new_session()`. In the runner model, the stream owns its own context queue. The
caller uses `stream.send_context()` instead of pushing to an external queue.
This is a control inversion — the scheduler's `_deliver_context_update` must
change from `queue.put_nowait(parts)` to `stream.send_context(parts)`. That
change happens in Phase 2 (task-runner-rewiring), not here.

### Not in scope

- Rewiring `TaskRunner` to use the runner (Phase 2).
- Changing `Scheduler` / `Bees` constructors (Phase 3).
- Removing `run_session` / `resume_session` (Phase 4).
- Creating `gemini-runners` package (Phase 5).

## Conformance Testing Strategy

1. **`GeminiStream` satisfies `SessionStream` protocol**: `isinstance` check.

2. **`GeminiRunner` satisfies `SessionRunner` protocol**: `isinstance` check.

3. **`GeminiStream` iteration**: Use a mock `asyncio.Queue` pre-loaded with
   events and a `None` sentinel. Verify events are yielded in order and
   `StopAsyncIteration` is raised.

4. **`GeminiStream.resume_state()` capture**: After stream exhausts, verify
   `resume_state()` returns the expected blob (requires mocking the opal stores
   with a pre-saved `InteractionState`).

5. **`GeminiStream.resume_state()` returns `None` for completed sessions**: When
   no suspend/pause occurred, `resume_state()` is `None`.

6. **`GeminiStream.send_context()`**: Verify parts are pushed to the internal
   queue.

7. **`GeminiRunner.run()` integration**: Mock `HttpBackendClient` and opal
   session API. Verify `new_session` and `start_session` are called with correct
   arguments. Verify returned stream is iterable.

8. **`GeminiRunner.resume()` integration**: Mock opal API. Verify `new_session`,
   store setup, and `api_resume_session` are called correctly.

## Dependencies

All dependencies are already available:

- `SessionRunner` protocol — `bees/protocols/session.py` ✅
- `SessionStream` protocol — `bees/protocols/session.py` ✅
- `SessionConfiguration` — `bees/protocols/session.py` ✅
- `SUSPEND_TYPES` / `PAUSE_TYPES` — `bees/protocols/session.py` ✅
- Opal session API — `opal_backend/sessions/api.py` (existing)
- Opal stores — `opal_backend/sessions/in_memory_store.py`,
  `opal_backend/local/interaction_store_impl.py` (existing)

This spec is a leaf.
