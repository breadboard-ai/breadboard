# Opal Backend Session Protocol

> Specification for session-based agent execution. A session decouples the agent
> loop from the SSE connection — the loop runs in the background, events
> accumulate in a store, and clients connect and disconnect freely. This document
> defines the session lifecycle, the `SessionStore` protocol, the Python session
> API, and the REST endpoints.
## Concepts

### Session

A **session** is the full lifecycle of a single user request — from the initial
`run()` call through any number of suspend/resume cycles to eventual completion
or failure. A session has:

- A stable **session ID** (assigned at creation, never changes)
- A **status** (see state machine below)
- An **event log** (append-only sequence of `AgentEvent` dicts)
- Zero or more **interaction snapshots** (suspend/resume state)

Today, none of these exist as a unified concept. The SSE stream is ephemeral,
`interaction_id` is single-use and generated per-suspend, and there's no event
log. Opal Backend Session Protocol introduces the session as the missing
umbrella.

### Event Log

An append-only sequence of serialized events. Every event yielded by
`_stream_loop` is appended. The log enables:

- **Replay**: client reconnects and catches up from any point
- **Recovery**: page refresh, network drop, laptop close/reopen
- **Audit**: post-hoc inspection of what happened

Events are indexed by position (0-based). Clients track their cursor and request
`get_events(session_id, after=cursor)`.

### Interaction Snapshot

The existing `InteractionState` — conversation history, function call part, file
system snapshot, task tree, flags, consents. Saved on suspend, loaded on resume.
**Single-use**: loading removes the snapshot (the resume creates a new run
segment that may suspend again, creating a new snapshot).

The session _owns_ the interaction snapshot. The session ID serves as the
storage key, replacing the per-suspend `interaction_id`. This works because the
loop is sequential — a session has **at most one pending suspend** at any time.
The state machine enforces this: a session must be in `suspended` status before
it can resume, and resuming transitions it back to `running`.

## Status State Machine

```
  running ──► suspended ──► running ──► ... ──► completed
                                            ──► failed
              (any) ──────────────────────────► cancelled
```

| Status      | Meaning                                               | Who sets it                           |
| ----------- | ----------------------------------------------------- | ------------------------------------- |
| `running`   | Loop is executing (Gemini calls, function dispatch)   | `run()` / `resume()`                  |
| `suspended` | Loop paused, waiting for client input (chat, consent) | `_stream_loop` on `SuspendResult`     |
| `completed` | Loop finished successfully                            | `_stream_loop` on `CompleteEvent`     |
| `failed`    | Loop errored                                          | `_stream_loop` on unrecoverable error |
| `cancelled` | Caller aborted the session                            | Cancel endpoint                       |

Every status changes behavior or gates an endpoint.

### Transitions

- `running → suspended`: function needs client input (existing suspend flow).
  Interaction snapshot saved.
- `suspended → running`: client POSTs response (existing resume flow). Snapshot
  loaded and consumed.
- `running → completed`: loop terminates normally.
- `(any) → failed`: unrecoverable error.
- `(any) → cancelled`: explicit cancellation.

## Protocol: `SessionStore`

```python
class SessionStatus(StrEnum):
    RUNNING = "running"
    SUSPENDED = "suspended"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@runtime_checkable
class SessionStore(Protocol):
    """Manages the lifecycle of a session."""

    # ── Lifecycle ──

    async def create(self, session_id: str) -> None:
        """Create a new session. Initial status: RUNNING."""
        ...

    async def get_status(self, session_id: str) -> SessionStatus | None:
        """Return current status, or None if not found."""
        ...

    async def set_status(
        self, session_id: str, status: SessionStatus
    ) -> None:
        """Transition to a new status."""
        ...

    # ── Event Log ──

    async def append_event(
        self, session_id: str, event: dict[str, Any]
    ) -> int:
        """Append an event. Returns the new event's index."""
        ...

    async def get_events(
        self, session_id: str, *, after: int = -1
    ) -> list[dict[str, Any]]:
        """Return events with index > after. after=-1 returns all."""
        ...

    # ── Interaction State (suspend/resume) ──

    async def save_interaction(
        self, session_id: str, state: InteractionState
    ) -> None:
        """Save interaction snapshot on suspend. Overwrites any prior."""
        ...

    async def load_interaction(
        self, session_id: str,
    ) -> InteractionState | None:
        """Load and clear the interaction snapshot. Single-use."""
        ...
```

### Relationship to `InteractionStore`

`SessionStore` is a new protocol, not an evolution of `InteractionStore`.
`InteractionStore` continues to serve the old `run()` / `resume()` path — the
two coexist until `streamRunAgent` is deprecated.

## Session API (New)

Three functions, each mapping to one lifecycle step. These are new — the
existing `run()` / `resume()` remain untouched as the backward-compat path for
`streamRunAgent`.

### `new_session` — create

```python
async def new_session(
    *,
    session_id: str,
    segments: list[dict[str, Any]],
    store: SessionStore,
    backend: BackendClient,
    interaction_store: InteractionStore,
    flags: dict[str, Any] | None = None,
    graph: dict[str, Any] | None = None,
    drive: DriveOperationsClient | None = None,
) -> str:
    """Create a session in the store and stash deps for start_session().

    Captures per-request dependencies (access token, clients) in a
    _SessionContext so the background task can outlive the HTTP request.
    Does NOT start the loop — call start_session() separately.

    Returns the session ID.
    """
```

> `interaction_store` is required because `run()` uses it internally for
> suspend state. This is the same `InteractionStore` used by the legacy
> `streamRunAgent` path — it coexists until that endpoint is deprecated.

### `start_session` — run

```python
async def start_session(
    *,
    session_id: str,
    store: SessionStore,
    subscribers: Subscribers,
) -> None:
    """Run the loop for an existing session.

    Consumes the _SessionContext stashed by new_session(). Iterates
    run(), tees each event to store.append_event() and
    subscribers.publish(). Sets terminal status (COMPLETED, FAILED,
    SUSPENDED) on exit.

    This is a plain coroutine — the caller decides whether to await it
    or wrap it in asyncio.create_task().
    """
```

> Dependencies (backend, drive, flags, graph) are captured in
> `_SessionContext` at creation time. `start_session` retrieves them by
> session ID — the background task never accesses the original HTTP request.

### `resume_session` — resume

```python
async def resume_session(
    *,
    session_id: str,
    response: dict[str, Any],
    store: SessionStore,
    subscribers: Subscribers,
) -> None:
    """Resume a suspended session.

    Loads interaction state from store.load_interaction(session_id),
    injects the response, and continues the loop. Same push semantics
    as start_session().
    """
```

### How the REST endpoint uses them

```python
@app.post("/v1beta1/sessions/new")
async def create_session(request: Request):
    body = await request.json()

    # Extract auth: prefer body param, fall back to Authorization header.
    access_token = body.pop("accessToken", "")
    if not access_token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            access_token = auth_header[len("Bearer "):]

    backend = backend_factory(access_token, origin)
    drive = drive_factory(access_token)

    session_id = await new_session(
        session_id=str(uuid.uuid4()),
        segments=body["segments"],
        store=store,
        backend=backend,
        interaction_store=interaction_store,
        graph=body.get("graph"),
        flags=body.get("flags"),
        drive=drive,
    )
    asyncio.create_task(start_session(
        session_id=session_id,
        store=store,
        subscribers=subscribers,
    ))
    return {"sessionId": session_id}
```

The `create_task` decision lives in the endpoint — the library functions are
pure coroutines with no hidden concurrency.

### Relationship to `run()` / `resume()`

The old pull-based API (`async for event in run(...)`) is unchanged. The
`streamRunAgent` backward-compat shim uses it directly. Over time, as clients
migrate to the session endpoints, `run()` / `resume()` can be deprecated.

## REST API

### Overview

```
POST /v1beta1/sessions/new                       → { sessionId }
GET  /v1beta1/sessions/{id}?alt=sse              → SSE stream (replay + live)
POST /v1beta1/sessions/{id}:resume                → { ok }
GET  /v1beta1/sessions/{id}/status               → { status, eventCount, ... }
POST /v1beta1/sessions/{id}:cancel               → { status: "cancelled" }
```

This replaces the current single `POST /v1beta1/streamRunAgent` endpoint with a
session-centric design. Session creation is decoupled from event streaming — the
client gets a session ID synchronously, then connects to the SSE stream
separately. The stream endpoint supports connect/disconnect/reconnect freely.

### Authentication

The user's OAuth token must reach the backend for Gemini and Drive API calls.
It is passed in **two ways** — same token, two delivery paths:

1. **`Authorization: Bearer <token>`** header — standard HTTP auth.
2. **`accessToken`** field in the `POST /sessions/new` request body.

Both are needed because of the production deployment. The prod backend
**replaces** the `Authorization` header with its own service account token.
The original user token is only preserved as `accessToken` in the request body.
In dev, there is no such replacement, so the header carries the user token
directly.

The endpoint extracts the token with body-first precedence:

```python
access_token = body.pop("accessToken", "")
if not access_token:
    access_token = extract_bearer(request)  # header fallback for dev
```

The token is captured at session creation and bound to the session's clients
(`BackendClient`, `DriveOperationsClient`). On **resume**, the client should
send a fresh `accessToken` — the endpoint creates new clients with it,
replacing the potentially expired originals.

---

### `POST /v1beta1/sessions/new`

Create a session and kick off the agent loop in the background.

**Request**

|              |                         |
| ------------ | ----------------------- |
| Method       | `POST`                  |
| Path         | `/v1beta1/sessions/new` |
| Content-Type | `application/json`      |

```json
{
  "segments": [{ "type": "text", "text": "Generate a video of a sunset" }],
  "flags": { "googleOne": true },
  "graph": { "url": "...", "title": "My Opal" },
  "accessToken": "ya29..."
}
```

Headers:

```
Authorization: Bearer <identity-token>
Content-Type: application/json
```

**Response `200`**

|              |                    |
| ------------ | ------------------ |
| Content-Type | `application/json` |

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Errors**

| Status | Condition                              |
| ------ | -------------------------------------- |
| `400`  | Missing `segments` in request body     |

**Behavior**

1. Generates a session ID
2. Calls `store.create(session_id)`
3. Spawns the loop as a background task (`asyncio.create_task`)
4. Returns immediately — the loop runs independently of any SSE connection

---

### `GET /v1beta1/sessions/{id}`

SSE event stream. Replays history, then streams live. Connect at any time.

**Request**

|        |                                                          |
| ------ | -------------------------------------------------------- |
| Method | `GET`                                                        |
| Path   | `/v1beta1/sessions/{session_id}`                             |
| Query  | `alt=sse` (required) — signals SSE response format           |
|        | `after` (int, optional) — replay events after this index     |

**Response `200`**

|              |                     |
| ------------ | ------------------- |
| Content-Type | `text/event-stream` |

```
event: start
data: {"sessionId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890"}

event: functionCall
data: {"functionCall":{"name":"generate_video","args":{...}}}

event: thought
data: {"thought":{"text":"Planning the scene..."}}

event: complete
data: {"complete":{"result":{...}}}
```

**Behavior**

- **`alt=sse`**: required on every request to this endpoint. The production
  deployment uses this parameter to route SSE requests correctly (same
  convention as `streamRunAgent?alt=sse`).
- **Replay**: on connect, replays all events from the log (or from `&after=N`).
  Then switches to live streaming via subscriber queue.
- **Reconnect**: client disconnects, reconnects with `?alt=sse&after=47` to
  pick up where it left off. No data loss.
- **Multiple connections**: allowed. Each gets its own subscriber queue.

**Errors**

| Status | Condition         |
| ------ | ----------------- |
| `404`  | Session not found |

---

### `POST /v1beta1/sessions/{id}:resume`

Inject a response for a suspended session. The loop resumes in the background.

**Request**

|              |                                         |
| ------------ | --------------------------------------- |
| Method       | `POST`                                  |
| Path         | `/v1beta1/sessions/{session_id}:resume` |
| Content-Type | `application/json`                      |

The response shape depends on the suspend event type:

```jsonc
// For waitForInput — user text or file upload:
{
  "response": {
    "input": {
      "role": "user",
      "parts": [{ "text": "Make it a beach sunset" }],
    },
  },
}

// For waitForChoice — selected option:
// { "response": { "choice": "option-2" } }

// For queryConsent — grant or deny:
// { "response": { "consent": true } }

// For readGraph — current graph structure:
// { "response": { "graph": { ... } } }

// For inspectNode — node inspection data:
// { "response": { "node": { ... } } }

// For applyEdits — confirmation of graph edits:
// { "response": { "applied": true } }
```

**Token refresh:** include `accessToken` to refresh the session's backend
clients (the original token from session creation may have expired):

```jsonc
{
  "response": { "input": { "role": "user", "parts": [...] } },
  "accessToken": "ya29...fresh-token"
}
```

**Response `200`**

|              |                    |
| ------------ | ------------------ |
| Content-Type | `application/json` |

```json
{
  "ok": true
}
```

**Behavior**

1. Loads interaction state from `store.load_interaction(session_id)`
2. Injects the response (same logic as current `resume()`)
3. Spawns a new loop segment as a background task
4. Returns immediately — events flow through `GET /v1beta1/sessions/{id}`

No `interaction_id` is needed in the request body. The session guarantees at
most one pending suspend at any time (the loop is sequential). The session ID in
the URL path is sufficient to locate the stored `InteractionState`.

If `accessToken` is present in the body, the endpoint creates fresh backend and
drive clients, replacing the ones captured at session creation. This handles
OAuth token refresh across long-lived suspends.

**Errors**

| Status | Condition                         |
| ------ | --------------------------------- |
| `404`  | Session not found                 |
| `409`  | Session not in `suspended` status |

---

### `GET /v1beta1/sessions/{id}/status`

Lightweight status check. No event replay.

**Request**

|        |                                         |
| ------ | --------------------------------------- |
| Method | `GET`                                   |
| Path   | `/v1beta1/sessions/{session_id}/status` |

**Response `200`**

|              |                    |
| ------------ | ------------------ |
| Content-Type | `application/json` |

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "running",
  "statusMessage": "Generating video...",
  "eventCount": 47,
  "createdAt": "2026-03-12T20:30:00Z"
}
```

**Errors**

| Status | Condition         |
| ------ | ----------------- |
| `404`  | Session not found |

---

---

### `POST /v1beta1/sessions/{id}:cancel`

Cancel a running session.

**Request**

|        |                                         |
| ------ | --------------------------------------- |
| Method | `POST`                                  |
| Path   | `/v1beta1/sessions/{session_id}:cancel` |

**Response `200`**

|              |                    |
| ------------ | ------------------ |
| Content-Type | `application/json` |

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "cancelled"
}
```

**Behavior**

The cancel endpoint calls `asyncio.Task.cancel()` on the background task,
raising `CancelledError` through the entire await chain — including any
in-flight Gemini API call. No further inference is consumed. Events accumulated
before cancellation remain in the log.

**Errors**

| Status | Condition                                                                |
| ------ | ------------------------------------------------------------------------ |
| `404`  | Session not found                                                        |
| `409`  | Session already in a terminal state (`completed`, `failed`, `cancelled`) |

### Client Flows

#### Happy Path

```
 1. POST /v1beta1/sessions/new { segments, flags, graph }
    → { sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }

 2. GET /v1beta1/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890?alt=sse
    → SSE stream: start, functionCall, thought, content, ...

 3. Stream completes → done event → close
```

#### Disconnect + Reconnect

```
 1. POST /v1beta1/sessions/new → { sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
 2. GET /v1beta1/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890?alt=sse → SSE events flowing...
 3. Connection drops (network, page refresh)
 4. Client has session_id (URL param or localStorage)
 5. GET /v1beta1/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890?alt=sse&after=12 → replay from event 13, live thereafter
 6. Stream completes → done
```

#### Suspend + Resume

A suspend happens when the loop needs client input to continue. The client
discovers the suspend through the SSE stream — a **suspend event** arrives, then
the stream goes quiet (no more events until the client resumes).

**Suspend event types** (from `events.py`):

| Event           | Client must provide                         |
| --------------- | ------------------------------------------- |
| `waitForInput`  | Text, file upload, or skip                  |
| `waitForChoice` | Selection from a list of choices            |
| `readGraph`     | Current graph structure                     |
| `inspectNode`   | Node inspection data                        |
| `applyEdits`    | Confirmation of graph edits                 |
| `queryConsent`  | Consent for a capability (e.g., web access) |

**What the client sees on the wire:**

```
event: waitForInput
data: {
  "waitForInput": {
    "requestId": "req-001",
    "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "prompt": { "parts": [{ "text": "What topic?" }] },
    "inputType": "text"
  }
}
```

> Note: `sessionId` replaces the old `interactionId` field. The client already
> has the session ID from the start response — the field in the event is
> confirmatory, not discovery.

**After the suspend event:**

1. The SSE stream stays open but produces no further events (the loop is paused,
   there's nothing to emit). The server may also close the stream — the client
   should handle both cases identically.
2. Session status transitions to `SUSPENDED`.
3. The client renders the appropriate UI (text input, choice list, consent
   dialog) based on the event type.

**Resuming:**

```
 1. Client collects user input based on suspend event type
 2. POST /v1beta1/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890:resume
    Body: {
      "response": {
        "input": { "role": "user", "parts": [{ "text": "..." }] }
      }
    }
    → { "ok": true }
 3. Session status: RUNNING
 4. Loop spawns a new segment as a background task
 5. Client reconnects to SSE (or is already connected):
    GET /v1beta1/sessions/a1b2c3d4-e5f6-7890-abcd-ef1234567890?alt=sse&after=12 → new events flow
```

**Multiple suspends in one session:**

A session can suspend and resume multiple times (e.g., consent check, then user
input, then another consent). Each suspend/resume is a separate cycle, but they
share the same session ID. The `at most one pending suspend` invariant holds at
each point — the loop is sequential.

### Migration from `streamRunAgent`

`POST /v1beta1/streamRunAgent` continues to work as a backward-compatible shim:

- **Start**: the shim calls `POST /v1beta1/sessions/new` internally, then
  immediately streams `GET /v1beta1/sessions/{id}` as the SSE response.
- **Resume**: when the request body contains an `interactionId`, the shim
  translates it to `POST /v1beta1/sessions/{id}:resume` and streams the
  session afterward.

Existing clients see no change. New clients use the session endpoints directly.
