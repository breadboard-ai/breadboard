# Project Penguin: Session-Based Agent Loop

> Decouple the agent loop from the SSE connection. The loop runs in the
> background; clients connect and disconnect freely. Sessions track lifecycle,
> events, and suspend/resume state.

## Protocol

The full session protocol is in
[SESSION_PROTOCOL.md](packages/opal-backend/opal_backend/SESSION_PROTOCOL.md).

## Approach

Outside-in: stub the REST API surface first so we can curl endpoints
immediately, then progressively wire real implementations behind them.

## Phases

### Phase 1: API Skeleton

> **🎯 Objective:** All five session endpoints exist and return valid-shaped
> responses. An `InMemorySessionStore` tracks state. Nothing runs a real loop
> yet.
>
> ```bash
> curl -X POST localhost:8080/v1beta1/sessions/new \
>   -d '{"segments":[{"type":"text","text":"Hello"}]}'
> # → {"sessionId":"sess-abc-123"}
>
> curl localhost:8080/v1beta1/sessions/sess-abc-123/status
> # → {"sessionId":"sess-abc-123","status":"running","eventCount":0}
> ```

- [ ] `SessionStatus(StrEnum)` — `running`, `suspended`, `completed`, `failed`,
      `cancelled`
- [ ] `SessionStore(Protocol)` — as specified in `SESSION_PROTOCOL.md`
- [ ] `InMemorySessionStore` — dict-backed implementation
- [ ] `POST /v1beta1/sessions/new` — creates session in store, returns ID (no
      loop spawned yet)
- [ ] `GET /v1beta1/sessions/{id}` — stub SSE stream (emits `start` event, then
      closes)
- [ ] `POST /v1beta1/sessions/{id}/resume` — stub: validates session is
      suspended, returns `{"ok": true}`
- [ ] `GET /v1beta1/sessions/{id}/status` — returns real status from store
- [ ] `POST /v1beta1/sessions/{id}:cancel` — sets status to `cancelled`
- [ ] Unit tests for `InMemorySessionStore` round-trips
- [ ] Integration tests: curl each endpoint, verify response shapes

### Phase 2: Wire the Loop

> **🎯 Objective:** `new_session()` + `start_session()` run a real agent loop.
> Events flow into the store and out through SSE. A session runs to completion
> in the background.
>
> ```bash
> # Create session — loop starts in background
> curl -X POST localhost:8080/v1beta1/sessions/new \
>   -d '{"segments":[{"type":"text","text":"What is 2+2?"}]}'
> # → {"sessionId":"sess-abc-123"}
>
> # Watch real events flow
> curl localhost:8080/v1beta1/sessions/sess-abc-123 --no-buffer
> # → event: functionCall ...
> # → event: thought ...
> # → event: content ...
> # → event: complete ...
> ```

- [ ] Implement `new_session()` — parse segments, build state, create session in
      store, return ID
- [ ] Implement `start_session()` — run the loop, tee events into
      `store.append_event()`, set terminal status on exit
- [ ] Wire `POST /sessions/new` to call `new_session()` +
      `asyncio.create_task(start_session())`
- [ ] Wire `GET /sessions/{id}` to replay from store + subscribe to live events
- [ ] Subscriber queue: live event delivery to connected SSE clients
- [ ] Tests: event tee captures all events, status transitions on complete/error

### Phase 3: Suspend/Resume

> **🎯 Objective:** When the loop suspends, the session enters `suspended`
> status. The client POSTs a response, and the loop continues.
>
> ```bash
> # Session suspends (waitForInput)
> curl localhost:8080/v1beta1/sessions/sess-abc-123/status
> # → {"status":"suspended"}
>
> # Resume with user input
> curl -X POST localhost:8080/v1beta1/sessions/sess-abc-123/resume \
>   -d '{"response":{"input":{"role":"user","parts":[{"text":"Yes"}]}}}'
> # → {"ok": true}
>
> # Events flow again
> curl localhost:8080/v1beta1/sessions/sess-abc-123?after=12 --no-buffer
> # → new events...
> ```

- [ ] Implement `resume_session()` — load interaction state, inject response,
      continue loop
- [ ] Wire `POST /sessions/{id}/resume` to call `resume_session()` +
      `asyncio.create_task(start_session())`
- [ ] On suspend: set status to `SUSPENDED`, save interaction via
      `store.save_interaction()`
- [ ] Suspend events carry `sessionId` (replaces `interactionId` on the wire)
- [ ] Tests: suspend → resume → complete lifecycle

### Phase 4: Reconnection + Cancellation + Backward Compat

> **🎯 Objective:** Clients reconnect after disconnect and catch up. Running
> sessions can be cancelled. `streamRunAgent` still works.
>
> ```bash
> # Reconnect after disconnect, catch up from event 12
> curl localhost:8080/v1beta1/sessions/sess-abc-123?after=12 --no-buffer
> # → replays events 13+, then live
>
> # Cancel a running session
> curl -X POST localhost:8080/v1beta1/sessions/sess-abc-123:cancel
> # → {"status":"cancelled"}
> ```

- [ ] SSE replay: `GET /sessions/{id}?after=N` replays from store, then switches
      to live
- [ ] Cancellation: loop polls `store.get_status()` on each tee cycle; if
      `cancelled`, graceful shutdown
- [ ] `streamRunAgent` backward-compat shim (start: `new` → stream; resume:
      translate `interactionId` → `POST /sessions/{id}/resume`)
- [ ] Tests: reconnect catches up, cancel stops loop, shim works for both start
      and resume

### Phase 5: Client Migration

> **🎯 Objective:** The frontend uses session endpoints. Background sessions
> survive page refresh.

- [ ] `SSEAgentEventSource`: switch from `streamRunAgent` to session endpoints
- [ ] Persist `session_id` across page loads (URL param or `localStorage`)
- [ ] On page load: check `GET /v1beta1/sessions/{id}/status` for active
      sessions
- [ ] Reconnection: `GET /v1beta1/sessions/{id}?after=N` to catch up
- [ ] UI: toast for background sessions, expand to full console on click
