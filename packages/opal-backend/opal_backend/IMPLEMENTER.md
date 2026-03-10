# Implementer Guide

`opal_backend` is a library. It runs an agent loop and yields typed events.
Your job is to wire it into your server by providing three dependencies.

## Entry Points

```python
from opal_backend import run, resume
```

Both are async generators that yield `AgentEvent` instances. The full
lifecycle is:

1. Client sends a start request → your server calls `run()`.
2. `run()` yields events. Serialize them to your transport (SSE, proto, etc.).
3. If the loop suspends (needs user input), you'll receive a `SuspendEvent`
   with an `interactionId`. The SSE stream ends.
4. Client responds → your server calls `resume()` with the `interactionId`
   and the client's response. A new event stream begins.

### `run()`

```python
async for event in run(
    segments=segments,       # list[dict] — structured segments from wire protocol
    backend=backend,         # BackendClient — you implement this
    store=store,             # InteractionStore — you implement this
    graph=graph,             # GraphInfo — {url: str, title: str}
    flags=flags,             # dict | None — feature flags
    drive=drive,             # DriveOperationsClient | None — for memory features
):
    send(event.to_dict())
```

### `resume()`

```python
async for event in resume(
    interaction_id=interaction_id,  # from the suspend event
    response=response,              # client's response dict
    backend=backend,                # BackendClient
    store=store,                    # InteractionStore
    drive=drive,                    # DriveOperationsClient | None
):
    send(event.to_dict())
```

Flags and graph identity are restored from saved state — callers do not
re-supply them on resume.

---

## Protocols to Implement

All protocols are defined with `@runtime_checkable` — you can use
`isinstance()` checks if needed. Each protocol uses only Python stdlib +
typing. No transport dependencies.

### 1. `BackendClient` — [backend_client.py](backend_client.py)

Handles One Platform operations and Gemini streaming. This is the main
integration surface.

```python
class BackendClient(Protocol):
    async def execute_step(self, body: dict[str, Any]) -> dict[str, Any]: ...
    async def upload_gemini_file(self, request: dict[str, str]) -> dict[str, Any]: ...
    async def upload_blob_file(self, drive_file_id: str) -> str: ...
    def stream_generate_content(self, model: str, body: dict[str, Any]) -> AsyncIterator[dict[str, Any]]: ...
```

| Method | What it does | Returns |
| --- | --- | --- |
| `execute_step` | POSTs an `ExecuteStepRequest` to the backend | Raw API response dict |
| `upload_gemini_file` | Uploads a file to Gemini File API | `{fileUrl, mimeType}` |
| `upload_blob_file` | Uploads a Drive file to blob storage | Blob handle path (`/board/blobs/{id}`) |
| `stream_generate_content` | Streams from Gemini `streamGenerateContent` | Parsed JSON chunks |

**Auth is a transport concern.** The dev implementation uses OAuth access
tokens in headers. Your implementation can use service accounts, RPC
credentials, or whatever your environment provides.

### 2. `InteractionStore` — [interaction_store.py](interaction_store.py)

Persists agent state across suspend/resume cycles. The loop calls `save()`
on suspend and `load()` on resume.

```python
class InteractionStore(Protocol):
    async def save(self, interaction_id: str, state: InteractionState) -> None: ...
    async def load(self, interaction_id: str) -> InteractionState | None: ...
    async def has(self, interaction_id: str) -> bool: ...
    async def clear(self) -> None: ...
```

**Key contract:** `load()` is single-use — it removes the state after
loading. Return `None` if not found.

#### `InteractionState` — What Gets Saved

`InteractionState` is a pure-data dataclass — no live objects, closures,
or service references. This is by design: in production, a resume request
may hit a different server node than the one that suspended. Everything
needed to reconstruct the agent loop is captured here.

| Field | Type | Purpose |
| --- | --- | --- |
| `contents` | `list[dict]` | Conversation history up to the suspend point, including the model's function call turn. This is the full Gemini `contents` array. |
| `function_call_part` | `dict` | The function call part that triggered the suspend. On resume, the client's response is wrapped as a `functionResponse` for this call. |
| `file_system` | `FileSystemSnapshot` | Snapshot of all files, routes, and file count from the agent's virtual file system. |
| `task_tree` | `TaskTreeSnapshot` | Snapshot of the hierarchical task tree the agent uses for planning. |
| `flags` | `dict` | Feature flags active at suspend time. Restored so the agent continues with the same configuration. |
| `graph` | `dict \| None` | Lightweight graph identity (`{url, title}`). Stored so `resume()` doesn't need to re-receive it. |
| `session_id` | `str` | Stable session identifier, preserved across all suspend/resume cycles within one conversation. |
| `is_precondition_check` | `bool` | `True` when the suspend was raised by a precondition (e.g., consent) rather than the main handler. On resume, this tells the loop to re-dispatch the function call instead of injecting the response. |
| `consents_granted` | `set[str]` | Consent types granted across the lifetime of this run. Preconditions check this set before suspending. |

#### Snapshot Architecture

The file system and task tree use a **data/behavior separation**
pattern. Live objects (`AgentFileSystem`, `TaskTreeManager`) have
behavior (file I/O, tree indexing) that can't be serialized. The
snapshots capture only the data:

```
AgentFileSystem  ──snapshot──▸  FileSystemSnapshot (files, routes, file_count)
                 ◂─from_snapshot──
TaskTreeManager  ──snapshot──▸  TaskTreeSnapshot (tree dict)
                 ◂─from_snapshot──
```

On resume, `run.py` calls `AgentFileSystem.from_snapshot()` and
`TaskTreeManager.from_snapshot()` to reconstruct live objects. Transient
state (system files, sheet manager) is re-attached by the caller — these
are service-side concerns, not serialized.

#### Serialization

`InteractionState` provides `to_dict()` / `from_dict()` for JSON
round-trips. Use these for database persistence:

```python
# Save
state_json = state.to_dict()
await db.set(interaction_id, json.dumps(state_json))

# Load
raw = await db.get(interaction_id)
state = InteractionState.from_dict(json.loads(raw))
```

`to_dict()` handles all nested types: `FileDescriptor` fields become
plain dicts, `consents_granted` (a `set`) becomes a sorted list.
`from_dict()` reconstructs them.

#### Production Store Considerations

- **TTL**: Suspends can last seconds to days. Set a reasonable expiry
  (the dev store uses in-memory with no TTL; production should have one).
- **Single-use**: `load()` must remove the entry. If a resume is
  attempted twice with the same `interactionId`, the second call should
  return `None`.
- **Distributed**: The store must be accessible across server nodes.
  The suspend and resume requests may hit different instances.

### 3. `DriveOperationsClient` (optional) — [drive_operations_client.py](drive_operations_client.py)

Required only for memory features (Sheets-backed agent memory). Pass `None`
to disable.

```python
class DriveOperationsClient(Protocol):
    async def create_file(self, metadata: dict) -> dict: ...
    async def get_file(self, file_id: str) -> dict: ...
    async def delete_file(self, file_id: str) -> None: ...
    async def query_files(self, query: str) -> list[dict]: ...
    async def get_spreadsheet_metadata(self, spreadsheet_id: str) -> dict: ...
    async def get_spreadsheet_values(self, spreadsheet_id: str, range: str) -> list[list[str]]: ...
    async def set_spreadsheet_values(self, spreadsheet_id: str, range: str, values: list[list[str]]) -> None: ...
    async def append_spreadsheet_values(self, spreadsheet_id: str, range: str, values: list[list[str]]) -> None: ...
    async def update_spreadsheet(self, spreadsheet_id: str, requests: list[dict]) -> None: ...
```

---

## Event Stream Contract

Every event has a `to_dict()` method producing camelCase JSON. The format
uses proto-style `oneof` keys:

```json
{"thought": {"text": "Thinking..."}}
{"functionCall": {"callId": "abc", "name": "generate_text", "args": {...}}}
{"complete": {"result": {"success": true}}}
```

### Fire-and-forget events (server → client, no response needed)

| Event | Purpose |
| --- | --- |
| `StartEvent` | Loop began |
| `ThoughtEvent` | Model reasoning text |
| `FunctionCallEvent` | Tool invocation started (`callId` correlates updates) |
| `FunctionCallUpdateEvent` | Tool status update |
| `FunctionResultEvent` | Tool result |
| `ContentEvent` | Model output |
| `TurnCompleteEvent` | Full turn finished |
| `SendRequestEvent` | Gemini request sent (includes model + body) |
| `GraphEditEvent` | Fire-and-forget graph modifications |
| `SubagentAddJsonEvent` | Nested progress data |
| `SubagentErrorEvent` | Nested error |
| `SubagentFinishEvent` | Nested progress complete |
| `UsageMetadataEvent` | Token usage metadata |
| `CompleteEvent` | Loop finished — contains `AgentResult` |
| `ErrorEvent` | Loop error |
| `FinishEvent` | Cleanup signal |

### Suspend events (server → client, client must respond)

When emitted, the stream ends. The client collects user input and POSTs
back with `{interactionId, response}`.

| Event | Purpose |
| --- | --- |
| `WaitForInputEvent` | Needs user text/file input |
| `WaitForChoiceEvent` | Needs user choice selection |
| `ReadGraphEvent` | Needs the current graph structure |
| `InspectNodeEvent` | Needs to inspect a specific node |
| `ApplyEditsEvent` | Wants to apply graph modifications |
| `QueryConsentEvent` | Needs user consent for a capability |

All event types are defined in [events.py](events.py). The `.. proto-guide::`
docstrings contain proto message definitions for generating `.proto` files.

---

## Minimal Wiring Example

```python
from opal_backend import run, resume

# 1. Start a run
async def handle_start(segments, flags, graph, access_token):
    backend = MyBackendClient(access_token=access_token)
    store = MyInteractionStore()

    async for event in run(
        segments=segments,
        backend=backend,
        store=store,
        graph=graph,
        flags=flags,
    ):
        yield event.to_dict()  # serialize to your transport

# 2. Resume after suspend
async def handle_resume(interaction_id, response, access_token):
    backend = MyBackendClient(access_token=access_token)
    store = MyInteractionStore()  # must be the SAME store instance

    async for event in resume(
        interaction_id=interaction_id,
        response=response,
        backend=backend,
        store=store,
    ):
        yield event.to_dict()
```

> [!IMPORTANT]
> The `InteractionStore` instance must be shared across `run()` and
> `resume()` calls for the same user session. `run()` saves state on
> suspend; `resume()` loads it back. If they use different stores, resume
> will fail with "Unknown interaction ID."

---

## What Ships vs. What Stays Behind

The `local/`, `dev/`, `fake/`, and `tests/` directories are **not
transferred** by copybara. They contain reference implementations and
dev tooling:

| Directory | Contains | Transferred? |
| --- | --- | --- |
| `opal_backend/` | Core library (protocols, loop, events, functions) | ✅ Yes |
| `declarations/` | Tool declarations (JSON + instruction markdown) | ✅ Yes |
| `local/` | `HttpBackendClient`, `InMemoryInteractionStore`, HTTP wiring | ❌ No |
| `dev/` | FastAPI dev server (`main.py`) | ❌ No |
| `fake/` | Fake implementations for testing | ❌ No |
| `tests/` | Test suite | ❌ No |

Use `local/` as your reference for implementing the protocols. The
`dev/main.py` file shows the complete wiring pattern.
