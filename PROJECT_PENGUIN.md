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

- [x] `SessionStatus(StrEnum)` — `running`, `suspended`, `completed`, `failed`,
      `cancelled`
- [x] `SessionStore(Protocol)` — as specified in `SESSION_PROTOCOL.md`
- [x] `InMemorySessionStore` — dict-backed implementation
- [x] `POST /v1beta1/sessions/new` — creates session in store, returns ID (no
      loop spawned yet)
- [x] `GET /v1beta1/sessions/{id}` — stub SSE stream (emits `start` event, then
      closes)
- [x] `POST /v1beta1/sessions/{id}/resume` — stub: validates session is
      suspended, returns `{"ok": true}`
- [x] `GET /v1beta1/sessions/{id}/status` — returns real status from store
- [x] `POST /v1beta1/sessions/{id}:cancel` — sets status to `cancelled`
- [x] Unit tests for `InMemorySessionStore` round-trips
- [x] Integration tests: curl each endpoint, verify response shapes

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

- [x] Implement `new_session()` — parse segments, build state, create session in
      store, return ID
- [x] Implement `start_session()` — run the loop, tee events into
      `store.append_event()`, set terminal status on exit
- [x] Wire `POST /sessions/new` to call `new_session()` +
      `asyncio.create_task(start_session())`
- [x] Wire `GET /sessions/{id}` to replay from store + subscribe to live events
- [x] Subscriber queue: live event delivery to connected SSE clients
- [x] Tests: event tee captures all events, status transitions on complete/error

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

- [x] Implement `resume_session()` — load interaction state, inject response,
      continue loop
- [x] Wire `POST /sessions/{id}/resume` to call `resume_session()` +
      `asyncio.create_task(start_session())`
- [x] On suspend: set status to `SUSPENDED`, save interaction via
      `store.save_interaction()`
- [x] Suspend events carry `sessionId` (replaces `interactionId` on the wire)
- [x] Tests: suspend → resume → complete lifecycle

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

- [x] SSE replay: `GET /sessions/{id}?after=N` replays from store, then switches
      to live
- [x] Cancellation: `asyncio.Task.cancel()` kills in-flight Gemini calls; no
      wasted inference
- [x] `streamRunAgent` backward-compat shim (start: `new` → stream; resume:
      translate `interactionId` → `POST /sessions/{id}/resume`)
- [x] Tests: reconnect catches up, cancel stops loop, shim works for both start
      and resume

### Phase 5: Client Migration (Final)

> **🎯 Objective:** The frontend uses session endpoints directly. The
> `streamRunAgent` shim is no longer the active code path.
>
> ```
> # Frontend creates a session, streams events, resumes on suspend:
> POST /sessions/new → { sessionId }
> GET  /sessions/{id} → SSE stream
> POST /sessions/{id}/resume → { ok }
> ```

- [ ] `SSEAgentEventSource`: swap from `streamRunAgent` to 3 session endpoints
      (create → stream → resume cycle)
- [ ] `fetch-allowlist.ts`: update URL allowlist for new endpoints
- [ ] Tests: update `sse-agent-event-source.test.ts`
- [ ] `abort()`: `POST /sessions/{id}:cancel` instead of dropping connection
