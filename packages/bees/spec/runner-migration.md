# Runner Migration — Spec Doc

**Goal**: Rewire the constructor-to-consumption chain so `TaskRunner` uses
`runner.run()` + `drain_session()` instead of `run_session()` /
`resume_session()`, and `box.py` constructs `GeminiRunner`.

## Context

Phase 1 shipped `GeminiRunner` + `GeminiStream` as a standalone `SessionRunner`
implementation. `drain_session()`, `save_resume_state()`, and
`load_resume_state()` also exist in `session.py`. Everything is additive —
nothing uses the new code yet.

Phase 2 substitutes the old call path with the new one across the full chain:

```
Before:  box.py → Bees(backend) → Scheduler(backend) → TaskRunner(backend) → run_session()
After:   box.py → GeminiRunner(backend) → Bees(runner) → Scheduler(runner) → TaskRunner(runner)
```

Per the SDD principle _"every PR leaves the system working"_, the substitution
must include the full path from construction (`box.py`) to consumption
(`TaskRunner`). Implementing the adapter without wiring it leaves dead code;
wiring without the adapter doesn't build.

### Remaining `opal_backend` imports removed by this phase

| Module         | Import removed                        |
| -------------- | ------------------------------------- |
| `scheduler.py` | `HttpBackendClient` (type annotation) |

## Design Decisions

### Constructor chain passes `SessionRunner`, not `HttpBackendClient`

`Bees.__init__`, `Scheduler.__init__`, and `TaskRunner.__init__` all change
their `backend` parameter to `runner: SessionRunner`. The `HttpBackendClient`
construction stays in `box.py` — it's an application concern, not a framework
concern. The runner is the boundary.

### `TaskRunner.run_task()` becomes provision → run → drain → persist

```python
config = provision_session(...)
stream = await self._runner.run(config)
self._active_streams[task.id] = stream
try:
    result = await drain_session(stream, config=config, ...)
finally:
    del self._active_streams[task.id]

resume_state = stream.resume_state()
if resume_state:
    save_resume_state(task.dir, resume_state)
```

Four clean steps replace the 15-parameter `run_session()` call. `function_name`
is already in `result.suspend_event` — the runner enriched it before yielding
(see below).

### `TaskRunner.resume_task()` assembles context updates directly

The context update assembly logic currently buried inside `resume_session()`
(lines 746–763) moves to `TaskRunner.resume_task()`. This is simpler because the
task runner already has the task and store:

```python
all_updates = []
response_updates = response.pop("context_updates", None)
if response_updates:
    all_updates.extend(response_updates)

if task.metadata.pending_context_updates:
    all_updates.extend(task.metadata.pending_context_updates)
    task.metadata.pending_context_updates = []
    self._store.save_metadata(task)

context_parts = updates_to_context_parts(all_updates) if all_updates else None

state = load_resume_state(task.dir)
stream = await self._runner.resume(config, state=state, response=response,
                                    context_parts=context_parts)
result = await drain_session(stream, ...)
```

No more `scheduler.store.get(ticket_id)` fallback — the task runner has the task
object and store directly.

### Context delivery uses streams, not raw queues

`Scheduler._context_queues: dict[str, asyncio.Queue]` becomes
`_active_streams: dict[str, SessionStream]`. The mid-stream injection path
changes from `queue.put_nowait(parts)` to
`asyncio.create_task(stream.send_context(parts))`.

`create_task` is correct because: (a) we're always inside the event loop, (b)
`GeminiStream.send_context` just does `put_nowait` internally — no real I/O, the
task completes instantly, and (c) `_deliver_context_update` must stay sync
(called from sync function handler closures via `deliver_to_parent`).

The `_context_queues` dict and the `context_queues` parameter throughout the
`TaskRunner` constructor are removed.

### The runner enriches suspend events, bees observes them

Currently `_handle_suspend` reads `load_session_state(task.dir)` to extract
`function_name` from the persisted `InteractionState.function_call_part`. This
reaches across the abstraction boundary — bees interprets runner-internal state.

After migration, `GeminiStream` enriches suspend events with `function_name`
before yielding them. The function name is the runner's domain knowledge (it
knows about `InteractionState` and `function_call_part`). Bees just reads it
from `result.suspend_event`:

```python
# In GeminiStream.__anext__, when a suspend event is detected:
for suspend_type in SUSPEND_TYPES:
    if suspend_type in event:
        iid = event[suspend_type].get("interactionId")
        if iid:
            state = await self._interaction_store.load(iid)
            if state:
                fcp = state.to_dict().get("function_call_part", {})
                fn = fcp.get("functionCall", {}).get("name")
                if fn:
                    event["function_name"] = fn
        break
```

The enriched event flows through `drain_session` → `EvalCollector` →
`SessionResult.suspend_event`. `_handle_suspend` reads
`result.suspend_event.get("function_name")` — no blob parsing, no disk reads, no
reaching into runner internals.

The resume state blob stays truly opaque. Bees never interprets it.

### Same file, new writer

The new persistence functions (`save_resume_state` / `load_resume_state` /
`clear_resume_state`) use the same `session_state.json` filename as the legacy
functions. The opacity boundary is the `bytes` API, not the filename. This means
tasks suspended before the migration resume after the migration with zero issues
— no backward compatibility concern.

## Module Changes

### `task_runner.py`

**Imports**:

- Remove: `run_session`, `resume_session`, `load_session_state`,
  `clear_session_state` from `bees.session`
- Add: `drain_session`, `save_resume_state`, `load_resume_state`,
  `clear_resume_state` from `bees.session`
- Add: `SessionRunner` from `bees.protocols.session`
- Add: `provision_session` from `bees.provisioner`
- Add: `updates_to_context_parts` from `bees.context_updates`

**Constructor**:

- `backend: Any` → `runner: SessionRunner`
- Remove `context_queues` parameter — streams tracked internally
- Add `_active_streams: dict[str, SessionStream]` (private)

**`run_task()`**: Provision → `runner.run()` → `drain_session()` → persist. Pass
`on_events_broadcast`, `deliver_to_parent`, `scope`, `scheduler` to
`provision_session`. The stream goes into `_active_streams` for mid-session
context delivery.

**`resume_task()`**: `load_resume_state()` → provision → assemble
`context_parts` → `runner.resume()` → `drain_session()` → persist or clear.

**`_handle_suspend(task, result)`**: Drop `load_session_state` call. Read
`function_name` from `result.suspend_event.get("function_name")` instead.

### `scheduler.py`

**Imports**:

- Remove: `from opal_backend.local.backend_client_impl import HttpBackendClient`
- Add: `from bees.protocols.session import SessionRunner`

**Constructor**:

- `backend: HttpBackendClient` → `runner: SessionRunner`
- Remove `_context_queues` dict
- Add `_active_streams: dict[str, SessionStream]` (shared with TaskRunner via
  constructor injection, same pattern as `_context_queues` today)

**`_deliver_context_update` Path 1**:

```python
stream = self._active_streams.get(target_id)
if stream is not None:
    parts = updates_to_context_parts([update])
    asyncio.create_task(stream.send_context(parts))
    return
```

**TaskRunner construction**: Pass `runner` instead of `backend`. Remove
`context_queues` parameter.

### `bees.py`

**Constructor**: `backend` → `runner`. Passes `runner=runner` to
`Scheduler(...)`. Remove `_backend` field.

### `box.py`

**Imports**: Add `from bees.runners.gemini import GeminiRunner`

**`run()`**:

```python
runner = GeminiRunner(backend)
bees = Bees(hive_dir, runner)
```

**`main()`**: Unchanged — still creates `HttpBackendClient` the same way.

## Friction

### `on_chat_entry` wiring for resume

Currently `resume_session` creates its own `_make_chat_log_writer`. After
migration, `TaskRunner.resume_task()` passes it via `provision_session` (same as
`run_task` does today). `task_runner.py` imports `_make_chat_log_writer` from
`session.py` — or uses its public wrapper `append_chat_log` plus the
`provision_session` parameter.

Resolution: `provision_session` already accepts `on_chat_entry`. Pass
`_make_chat_log_writer(task.dir)` from the task runner. Import the private
function or make it public.

### `_active_streams` ownership

Today `_context_queues` is owned by the Scheduler and passed to TaskRunner via
constructor injection. The same pattern applies to `_active_streams`: Scheduler
owns the dict, TaskRunner adds/removes entries, Scheduler reads for
`_deliver_context_update`.

### `SubagentScope` and `scheduler_ref`

`provision_session` accepts `scope` and `scheduler`. TaskRunner already has both
(`SubagentScope.for_ticket(task)` and `self._scheduler_ref`). No change needed —
the parameters already flow correctly in `run_task`.

### `hive_dir` inference

`run_session` and `resume_session` infer `hive_dir` from `ticket_dir`. After
migration, `provision_session` does the same inference internally (lines 83–89
of `provisioner.py`). No change needed.

## Not in scope

- **Removing `run_session` / `resume_session`** — Phase 3 (session-cleanup).
- **Removing transitional back-imports** (`SuspendError`, `AgentResult`) —
  Phase 3.
- **Moving runner to `gemini-runners` package** — Phase 4.
- **Other `run_session` callers** (if any CLI scripts call it directly) — they
  continue working until Phase 3.

## Verification Plan

### Automated

1. `npm run build` — type-checks compilation.
2. `npm run test -w packages/bees` — existing test suite passes.
3. Manually inspect remaining `opal_backend` imports in `bees/` — should be
   reduced by one (`scheduler.py`'s `HttpBackendClient`).

### Manual

1. Run `box` against a test hive. Create a task, watch it execute through the
   new path.
2. Trigger a task suspension (via `request_user_input`). Verify
   `session_state.json` is written, `function_name` appears in metadata's
   `suspend_event`.
3. Resume the suspended task. Verify it picks up from `session_state.json` and
   clears it on completion.
4. Test mid-session context delivery (subagent completes while parent is
   running). Verify `stream.send_context()` path works.
