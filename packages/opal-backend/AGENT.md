# Agent Guide: opal-backend

Orientation guide for AI agents working in `packages/opal-backend`. Read this
before making changes.

> **This project is a moving target.** The backend migration
> ([PROJECT_CORNERSTONE.md](../../PROJECT_CORNERSTONE.md)) is still in progress.
> Modules will be added, renamed, and restructured more often than usual. Treat
> these docs as a best-effort snapshot — when they disagree with the code, the
> code wins.

## Keeping Docs in Sync

These docs describe _where things are_ and _how to work here_, not API details
(those live in the code's docstrings). But the tables and checklists below can
still drift. **When you change the structure** — add a module, add a function
group, add an event type, add a scenario — update the relevant README as part of
your change. The how-to checklists below include these reminders explicitly.

## Package Structure at a Glance

| Directory                 | Synced? | What lives here                            |
| ------------------------- | ------- | ------------------------------------------ |
| `opal_backend/*.py`       | ✅ Yes  | Core agent loop, events, protocols         |
| `opal_backend/functions/` | ✅ Yes  | Function groups (system, generate, etc.)   |
| `opal_backend/local/`     | ❌ No   | httpx/FastAPI implementations of protocols |
| `opal_backend/dev/`       | ❌ No   | Dev server (real Gemini + proxy)           |
| `opal_backend/fake/`      | ❌ No   | Fake server (canned scenarios)             |
| `tests/`                  | ❌ No   | pytest test suite                          |

## The #1 Rule: The Sync Boundary

**Core modules (`opal_backend/*.py`, `opal_backend/functions/`) must have ZERO
external dependencies.** No `httpx`, `fastapi`, `pydantic`, or `sse_starlette`
imports. Only Python stdlib + typing.

All transport is injected through two protocols:

| Protocol           | File                   | What it abstracts                   |
| ------------------ | ---------------------- | ----------------------------------- |
| `BackendClient`    | `backend_client.py`    | One Platform ops + Gemini streaming |
| `InteractionStore` | `interaction_store.py` | Suspend/resume state persistence    |

Implementations live in `local/`:

- `HttpBackendClient` → `local/backend_client_impl.py`
- `InMemoryInteractionStore` → `local/interaction_store_impl.py`

## Entry Points

The public API is two async generators in `run.py`:

```python
# Start a new run
async for event in opal_backend.run(
    objective=objective,
    backend=backend_client,
    store=interaction_store,
    flags={"enable_g1_quota": True},
):
    yield event

# Resume a suspended run
async for event in opal_backend.resume(
    interaction_id=interaction_id,
    response=user_response,
    backend=backend_client,
    store=interaction_store,
):
    yield event
```

These create all internal state (file system, task tree, function groups, loop)
and yield typed `AgentEvent` instances. Callers provide only what varies by
environment.

## How the Loop Works

```
run() → Loop.run(args)
  │
  ├─ POST objective to Gemini (streaming)
  ├─ Parse response chunks
  │   ├─ Text part → on_thought / on_content hooks
  │   └─ Function call parts → FunctionCaller.call()
  ├─ Await all function results (concurrent)
  ├─ Feed results back to Gemini as next turn
  └─ Repeat until:
      ├─ LoopController.terminate() is called (by system functions)
      ├─ SuspendError is raised (by chat functions)
      └─ Error occurs
```

## How Suspend/Resume Works

```
1. Function raises SuspendError(event, function_call_part)
2. Loop catches it → returns SuspendResult
3. run() saves state to InteractionStore, yields suspend event, closes
4. Client POSTs {interactionId, response}
5. resume() loads state, injects response as function result
6. Loop continues from where it left off
```

This is the "reconnect, not keepalive" pattern — the SSE stream closes on
suspend. The client opens a new one to resume.

## How to Add a New Function Group

1. Create `opal_backend/functions/my_feature.py`
2. Define handler functions using `FunctionDefinition`:

   ```python
   from ..function_definition import FunctionDefinition
   from ..shared_schemas import STATUS_UPDATE_SCHEMA, TASK_ID_SCHEMA

   def _define_my_function(*, file_system, ...):
       async def handler(args, status_cb):
           status_cb("Working...")
           # ... do work ...
           return {"result": "done"}

       return FunctionDefinition(
           name="my_function",
           description="Does the thing",
           handler=handler,
           parameters_json_schema={
               "type": "object",
               "properties": {
                   "prompt": {"type": "string", "description": "..."},
                   **STATUS_UPDATE_SCHEMA,
                   **TASK_ID_SCHEMA,
               },
           },
       )
   ```

3. Create the group factory:

   ```python
   from ..function_definition import FunctionGroup, map_definitions

   def get_my_function_group(*, file_system, ...):
       mapped = map_definitions([_define_my_function(file_system=file_system)])
       return FunctionGroup(
           instruction="Instructions for the model...",
           **vars(mapped),
       )
   ```

4. Wire it into `run.py` → `_build_function_groups()`
5. Wire it into `dev/main.py` if it needs special setup
6. Add tests in `tests/test_my_feature.py`
7. **Update docs:** add the group to the table in
   `opal_backend/functions/README.md` and update the wiring diagram there

## How to Add a New Event Type

1. Add the dataclass to `events.py` with a `to_dict()` method (camelCase keys)
2. Add it to the `AgentEvent` union type in `events.py`
3. If it's a loop lifecycle event, add a hook in `LoopHooks` and wire it in
   `agent_events.py` → `build_hooks_from_sink()`
4. If it's a suspend event, add it to the `SuspendEvent` union
5. **Update docs:** if the event changes the wire protocol table in `README.md`,
   update it there too

## Testing

```bash
# All tests
npm run test -w packages/opal-backend

# Single file
.venv/bin/python -m pytest tests/test_loop.py -v

# Type checking
npm run typecheck -w packages/opal-backend
```

### Mock Patterns

Tests inject mock implementations of protocols:

```python
# Minimal BackendClient mock
class MockBackendClient:
    async def execute_step(self, body): ...
    async def upload_gemini_file(self, request): ...
    async def upload_blob_file(self, drive_file_id): ...
    async def stream_generate_content(self, model, body): ...
```

### Test File Mapping

| Test file                   | Source module(s)                     |
| --------------------------- | ------------------------------------ |
| `test_loop.py`              | `loop.py`, `function_caller.py`      |
| `test_run.py`               | `run.py`                             |
| `test_agent_events.py`      | `agent_events.py`                    |
| `test_agent_file_system.py` | `agent_file_system.py`               |
| `test_conform_body.py`      | `conform_body.py`                    |
| `test_pidgin.py`            | `pidgin.py`                          |
| `test_step_executor.py`     | `step_executor.py`                   |
| `test_suspend_resume.py`    | `suspend.py`, `interaction_store.py` |
| `test_task_tree_manager.py` | `task_tree_manager.py`               |
| `test_system_functions.py`  | `functions/system.py`                |
| `test_generate.py`          | `functions/generate.py`              |
| `test_code_gen.py`          | `functions/generate.py` (code exec)  |
| `test_image.py`             | `functions/image.py`                 |
| `test_video.py`             | `functions/video.py`                 |
| `test_audio.py`             | `functions/audio.py`                 |
| `test_chat_functions.py`    | `functions/chat.py`                  |
| `test_server.py`            | `fake/main.py`                       |
| `test_proxy.py`             | `dev/main.py` (proxy)                |
| `test_pending_requests.py`  | `local/pending_requests.py`          |

## Common Pitfalls

1. **Importing httpx in synced code** — Don't. Use `BackendClient` protocol.
   Production injects its own transport.

2. **Forgetting `to_dict()` on new events** — The SSE layer calls
   `event.to_dict()` to serialize. If you add an event field, add it to
   `to_dict()` too (camelCase key, omit if `None`).

3. **Not threading deps through `_build_function_groups()`** — New function
   groups need `file_system`, `task_tree_manager`, and `backend`. These are
   threaded in `run.py` → `_build_function_groups()`.

4. **Suspend without `function_call_part`** — `SuspendError` needs the function
   call part that triggered it so the loop can inject the response as a matching
   `functionResponse` on resume.

5. **Testing async code** — Use `pytest-asyncio` (`asyncio_mode = "auto"` is
   configured in `pyproject.toml`). All test functions using `await` must be
   `async def`.

## Related Documentation

- [PROJECT_CORNERSTONE.md](../../PROJECT_CORNERSTONE.md) — migration plan
- [opal_backend/README.md](opal_backend/README.md) — synced core module map
- [opal_backend/functions/README.md](opal_backend/functions/README.md) —
  function groups
- [opal_backend/local/README.md](opal_backend/local/README.md) — local
  implementations
- [opal_backend/dev/README.md](opal_backend/dev/README.md) — dev server
- [opal_backend/fake/README.md](opal_backend/fake/README.md) — fake server
- [tests/README.md](tests/README.md) — testing guide
