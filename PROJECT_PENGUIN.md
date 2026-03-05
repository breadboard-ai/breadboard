# Project Penguin: Long-Running Operation Support

> Adding long-running operation (LRO) support to the agent loop so that slow
> tasks (video generation, large code execution) can outlive a single SSE
> connection. The loop keeps running in the background; the client disconnects
> and reconnects to catch up.

## Architecture

```
BEFORE (today):

  Client ──SSE──→ Backend ──→ Loop ──→ Gemini
    ↑                           │
    └───── events ──────────────┘
    (stream lives for entire run)


AFTER (Penguin):

  Client ──SSE──→ Backend ──→ Loop ──→ Gemini
    ↑                │          │
    │          OperationStore   │ (append_event on every yield)
    │                │          │
    └── catch-up ────┘          │
                                │
  WaitForProcessingEvent        │
  = "disconnect now, I'll       │
     keep working"              ↓
                          (loop continues)
```

### Key Insight

The loop doesn't change. `WaitForProcessingEvent` is a **hint** emitted through
the existing `AgentEventSink` — just another event that happens to mean "you can
disconnect now." The caller inspects the event and decides what to do. The loop
keeps yielding events; the `OperationStore` captures them for later replay.

## Wire Format

### New Event: `waitForProcessing`

```json
{
  "waitForProcessing": {
    "requestId": "abc-123",
    "estimatedSeconds": 180,
    "statusMessage": "Generating video...",
    "interactionId": "op-456"
  }
}
```

### Operation Status (server-side, not on the wire)

```
running → processing → running → completed
                ↘ suspended → running ↗
                         ↘ failed
         (any) → cancelled
```

### Client Reconnection Flow

```
1. POST /v1beta1/streamRunAgent → SSE stream
2. Stream yields events normally
3. Function handler emits WaitForProcessingEvent
4. Client sees it → closes SSE → stores operation_id
5. Loop keeps running → events tee into OperationStore
6. Client polls GET /v1beta1/operations/{id}/events?after=N
7. When status = completed/failed → done
```

## Packages

| Package        | Changes                                         |
| -------------- | ----------------------------------------------- |
| `opal-backend` | New event, `OperationStore` protocol, event tee |
| Dev server     | In-memory `OperationStore` impl, poll endpoint  |
| google3 server | Production `OperationStore` (Firestore/etc.)    |

## Brainstorms

> Open questions and design ideas surfaced during review. Each is tagged with
> the phase where it would be resolved.

### B1: Operation ID Visibility (Phase 1)

The `operation_id` is caller-generated at stream start (per the new `run()`
signature). Should the client learn it from the _initial SSE event_ rather than
discovering it only when `WaitForProcessingEvent` fires? If so, the `start`
event should carry it:

```json
{ "start": { "operationId": "op-456" } }
```

This gives the client a reconnection handle from the very first event, which is
useful even without Penguin (e.g., for resuming after a network drop).

### B2: `estimated_seconds` — Hint, Not Promise (Phase 1)

The `estimated_seconds` field is a courtesy for client UI (progress spinners,
"this may take a few minutes" messages). Questions:

- **Who estimates?** The function handler. Video might say 180s, code execution
  30s. These are ballpark.
- **What if it's wrong?** Reframe: `estimated_seconds` is a _minimum wait before
  first poll_, not a completion estimate. The client should start polling after
  this interval, not show a progress bar that fills to 100%.
- **Alternative:** Drop it entirely and let the client poll on a fixed interval.
  Simpler, but loses the "this will take a while" UX signal.

**Recommendation:** Keep the field, document it as "minimum delay before polling
starts," default to 0 (poll immediately).

### B3: Progress Updates via Repeated Events (Phase 2)

`WaitForProcessingEvent` is one-shot today. But function handlers could emit
_multiple_ events with the same `request_id` and updated `status_message`:

```python
sink.emit(WaitForProcessingEvent(request_id=rid, status_message="Uploading..."))
# ... later ...
sink.emit(WaitForProcessingEvent(request_id=rid, status_message="Rendering frame 12/30"))
```

The client on reconnect replays the event log and uses the _latest_
`WaitForProcessingEvent` with each `request_id` as the current status. This
falls out naturally from the event tee — no library changes needed. Just needs
to be documented as a pattern.

### B4: `PROCESSING_TYPES` — Frozenset or Helper? (Phase 1)

The design doc suggests a `PROCESSING_TYPES` frozenset alongside
`SUSPEND_TYPES`. But with only one member (`WaitForProcessingEvent`), a simple
`is_processing_event(event)` helper is cleaner. Revisit if more processing-like
events emerge.

### B5: Status as a Type, Not a String (Phase 1)

`get_status()` returns `str | None`. Better options:

```python
class OperationStatus(StrEnum):
    RUNNING = "running"
    PROCESSING = "processing"
    SUSPENDED = "suspended"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
```

Or at minimum:
`Literal["running", "processing", "suspended", "completed", "failed", "cancelled"]`.
Catches typos at the type level.

### B6: The Rename Coordination Question (Phase 1)

Renaming `interaction_store.py` → `operation_store.py` requires Copybara
coordination:

- google3 imports `from opal_backend.interaction_store import InteractionStore`
  — these need updating
- Option: keep a re-export shim at the old path during transition
- The wire-format `interactionId` field name stays unchanged (backward compat) —
  it's just the `operation_id` now

### B7: TTL Semantics for Completed Operations (Phase 2)

When a completed operation expires, what does `get_status()` return? Probably
`None`, which the server translates to 404. But the client needs to distinguish
"never existed" from "existed but expired." Options:

1. Return `None` for both (simple, client retries are harmless)
2. Return a tombstone status `"expired"` (more informative)
3. Keep completed operations forever (simplest, but storage cost)

**Recommendation:** Start with option 1. Add tombstones only if clients need the
distinction.

### B8: Cancellation Token Design (Phase 2)

Today, cancellation is implicit: client closes SSE → server sees disconnect →
loop stops. With Penguin, the loop runs in the background with no listener, so
this implicit mechanism is gone. Cancellation is a **regression in user
control** if Penguin ships without it.

Where does the cancellation signal live?

1. **In the store** (simplest) — loop polls `get_status()` before each yield.
   Latency is one loop iteration (could be seconds during a slow Gemini call).
2. **`asyncio.Event`** threaded through the loop — instant cancellation, but
   requires sharing the event between SSE handler and background task.
3. **Both** — store is the durable source of truth; in-process event is the fast
   path. Store-based cancel works cross-process (production); event-based cancel
   works same-process (dev server).

**Recommendation:** Start with option 1 (store-only). The loop already touches
the store on every event tee. Checking status there is nearly free. Upgrade to
option 3 if latency matters.

### B9: Page Refresh Recovery (Phase 2)

Penguin's event tee gives us page-refresh recovery for free. The reconnection
flow is identical whether the client disconnected intentionally (processing
event) or involuntarily (page refresh, network drop, closing laptop):

1. Client persists `operation_id` (URL param `?op=abc-123` or `localStorage`)
2. On load, check `GET /v1beta1/operations/{id}/status`
3. If `running`/`processing`: replay events from `after=0`, enter polling loop
4. If `completed`/`failed`: replay all events, show final state

This enables "close laptop, come back later, see the result" — something the
current architecture can't do at all.

**Requirement:** `AgentEventConsumer` handlers must be idempotent (build state
from events, not cumulative mutation). The existing handlers already are, but
this should be verified as a test invariant.

### B10: Tiered Reconnection UX (Phase 2)

On page load, the client doesn't need to replay all events immediately. Two
tiers:

1. **Lightweight status check** — `GET /v1beta1/operations/{id}/status` returns
   a summary (status, message, event count, timestamp). Enough to paint a toast:
   _"Your video is still generating. Click to see details."_
2. **Full replay (on demand)** — User clicks the toast →
   `GET /v1beta1/operations/{id}/events?after=0` → full event replay into the
   console.

This extends to multiple concurrent operations: `GET /v1beta1/operations` (with
optional status filter) returns a list of active operations. The client shows a
card per operation. Click to expand.

The status summary response shape:

```json
{
  "operationId": "op-456",
  "status": "processing",
  "statusMessage": "Rendering frame 12/30",
  "eventCount": 47,
  "createdAt": "2026-03-04T20:30:00Z"
}
```

## Phases

### Phase 1: Event + Protocol Foundation

> **🎯 Objective:** `WaitForProcessingEvent` round-trips through the event tee
> and `OperationStore` protocol.
>
> ```python
> # In a test:
> store = InMemoryOperationStore()
> store.create("op-1")
> async for event in opal_backend.run(
>     objective=objective,
>     backend=mock_backend,
>     store=store,
>     operation_id="op-1",
> ):
>     pass
>
> assert store.get_status("op-1") == "completed"
> assert len(store.get_events("op-1")) > 0
> assert any("waitForProcessing" in e for e in store.get_events("op-1"))
> ```

#### 1a: `WaitForProcessingEvent` Dataclass

- [ ] Add `WaitForProcessingEvent` to `events.py` with `to_dict()` → camelCase
      JSON
- [ ] Add to `AgentEvent` union type
- [ ] Do **not** add to `SuspendEvent` (different semantics — loop doesn't
      pause)
- [ ] Add `is_processing_event()` helper (resolve
      [B4](#b4-processing_types--frozenset-or-helper-phase-1))
- [ ] Unit test: `to_dict()` output matches wire format

#### 1b: `OperationStore` Protocol

- [ ] Rename `interaction_store.py` → `operation_store.py` (resolve
      [B6](#b6-the-rename-coordination-question-phase-1), add re-export shim if
      needed)
- [ ] Keep `InteractionState` dataclass unchanged
- [ ] Replace `InteractionStore` protocol with `OperationStore`:
  - `create(operation_id)`, `get_status(operation_id)`,
    `set_status(operation_id, status)`
  - `append_event(operation_id, event)`, `get_events(operation_id, after_index)`
  - `save_interaction(operation_id, state)`, `load_interaction(operation_id)`
  - `list_operations(status_filter)` — return summaries for active operations
    (resolve [B10](#b10-tiered-reconnection-ux-phase-2))
- [ ] Use `OperationStatus` StrEnum (resolve
      [B5](#b5-status-as-a-type-not-a-string-phase-1))
- [ ] In-memory reference implementation in `local/operation_store_impl.py`
- [ ] Unit tests: create/status/event-append/save/load round-trips

#### 1c: Wire `operation_id` Through `run()` / `resume()`

- [ ] Add `operation_id: str` and `store: OperationStore` params to `run()` and
      `resume()`
- [ ] `_stream_loop`: tee every event into `store.append_event()`
- [ ] `_stream_loop`: update `store.set_status()` on complete/error
- [ ] Suspend handling: use `operation_id` instead of generating
      `interaction_id`
- [ ] `resume()`: collapse `interaction_id` → `operation_id`
- [ ] Resolve [B1](#b1-operation-id-visibility-phase-1): decide whether
      `StartEvent` carries `operation_id`
- [ ] Update existing `test_run.py` tests
- [ ] New tests: event tee captures all events, status transitions

### Phase 2: Processing Gap + Client Reconnection

> **🎯 Objective:** A function handler emits `WaitForProcessingEvent`, the dev
> server detects it, closes the SSE stream, and the client reconnects and
> catches up on missed events.
>
> ```
> curl -X POST http://localhost:8080/v1beta1/streamRunAgent \
>   -H "Content-Type: application/json" \
>   -H "Authorization: Bearer $(gcloud auth print-access-token)" \
>   -d '{"kind":"content","objective":{"parts":[{"text":"Generate a video of a sunset"}]}}'  \
>   --no-buffer
>
> # → SSE stream → WaitForProcessingEvent → stream closes
> # → poll GET /v1beta1/operations/{id}/events?after=5
> # → remaining events including complete
> ```

#### 2a: Dev Server Processing Flow

- [ ] Dev server: detect `WaitForProcessingEvent` in SSE loop, switch to
      background task mode
- [ ] Background task: continue consuming events, appending to store
- [ ] `GET /v1beta1/operations/{id}/events?after=N` endpoint
- [ ] `GET /v1beta1/operations/{id}/status` endpoint (lightweight summary:
      status, message, event count, timestamp)
- [ ] `GET /v1beta1/operations` endpoint (list active operations, optional
      status filter)
- [ ] Resolve [B7](#b7-ttl-semantics-for-completed-operations-phase-2): decide
      TTL/expiry behavior

#### 2b: Function Handler Integration

- [ ] `functions/video.py`: emit `WaitForProcessingEvent` before `execute_step`
      call
- [ ] Resolve [B2](#b2-estimated_seconds--hint-not-promise-phase-1): document
      `estimated_seconds` semantics
- [ ] Resolve [B3](#b3-progress-updates-via-repeated-events-phase-2): document
      repeated-event pattern as a convention
- [ ] Audit other slow functions for Penguin candidacy (image generation, code
      execution)

#### 2c: Client-Side Reconnection + Page Refresh Recovery

- [ ] `SSEAgentEventSource`: detect `WaitForProcessingEvent` in stream
- [ ] New polling loop: `GET /v1beta1/operations/{id}/events?after=lastIndex`
- [ ] Replay missed events through existing `AgentEventConsumer`
- [ ] Status polling: check `completed`/`failed`/`cancelled` to know when to
      stop
- [ ] UI: progress indicator during background processing
- [ ] Persist `operation_id` across page loads (URL param or `localStorage`)
- [ ] On page load: lightweight status check for active operations (resolve
      [B9](#b9-page-refresh-recovery-phase-2),
      [B10](#b10-tiered-reconnection-ux-phase-2))
- [ ] UI: toast/banner for background operations, expand to full console on
      click

#### 2d: Operation Cancellation

- [ ] `POST /v1beta1/operations/{id}:cancel` endpoint (One Platform convention)
- [ ] `OperationStore.cancel(operation_id)` — sets status to `cancelled`
- [ ] Loop integration: check `get_status()` in event tee; if `cancelled`, raise
      `CancelledError` for graceful shutdown
- [ ] Resolve [B8](#b8-cancellation-token-design-phase-2): decide store-only vs.
      store + asyncio.Event
- [ ] Client: cancel button in background-processing UI
- [ ] Partial results: cancelled operations keep their accumulated events in the
      store (user can see "what it did before stopping")
- [ ] Tests: cancel mid-processing, verify loop stops and events are preserved

### Phase 3: Production Readiness

> **🎯 Objective:** LRO support works identically through the production One
> Platform backend. A video generation task that exceeds SSE timeout completes
> successfully and the client catches up.

- [ ] google3 `OperationStore` implementation (Firestore or equivalent)
- [ ] One Platform: `GET /v1beta1/operations/{id}` endpoint
- [ ] One Platform: background task management (keep loop alive after SSE close)
- [ ] Load testing: concurrent LROs, store throughput
- [ ] TTL policy for completed operations
- [ ] Monitoring: operation status metrics, stuck-operation alerts
- [ ] Client: graceful degradation when Operation endpoints unavailable

### Future Considerations

- **Partial results on failure**: if the loop fails mid-processing, should
  accumulated events be available? (Yes, they're in the store — just need a
  client UX for "failed at step N, here's what we got.")
- **Multi-step LROs**: a single run might hit `WaitForProcessingEvent` multiple
  times (e.g., generate video then generate music). Each emits a separate
  `request_id`. The client reconnects once and gets all updates.
