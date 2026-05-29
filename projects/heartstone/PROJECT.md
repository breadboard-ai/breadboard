# Project Heartstone: Server-Side Graph Execution (v4)

> Moving graph execution from the browser to the backend, enabling both
> headed (interactive) and headless (scheduled/triggered) graph runs.

## Status: Design Phase — v4 (Consolidated)

---

## Executive Summary

Heartstone moves Breadboard graph execution to the Python backend. Graphs are
loaded, topologically sorted, and executed node-by-node as independent server
tasks. Each node task is short-lived: it runs, saves its outputs, and triggers
downstream nodes. No long-lived orchestrator thread. Coordination uses an
**atomic dependency counter** in the database to handle concurrent node
completion without races.

---

## All Resolved Decisions

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Graph loading | Option C — both inline graph and Drive file ID |
| 2 | Disconnect behavior | Headed stays headed, headless stays headless |
| 3 | Frontend presence | Mode set at start, never changes |
| 4 | Intermediate storage | In-memory (injectable protocol) |
| 5 | Asset outputs | Keep as LLMContent |
| 6 | Condensation | Port `condense()` — backend condenses |
| 7 | Go-over-list / deep-research | Ignore (legacy) |
| 8 | Asset nodes | Handle explicitly |
| 9 | Event source | New `GraphRunEventSource` (per-node dispatch) |
| 10 | Suspension model | Sessions pattern — save state, end task, new task on resume |
| 11 | Error propagation | Continue running non-dependent paths |
| 12 | Rename `run()` | → `run_agent()` |
| 13 | Concurrency model | **Task-per-node** with atomic dependency counter |
| 14 | Orchestrator lifetime | **No long-lived orchestrator** — plan is in the database |
| 15 | Non-agent text gen | **Direct Gemini call** — no agent loop |
| 16 | HTML auto-layout | Reuse `BackendClient.stream_generate_content()` |
| 17 | Output node porting | Incremental — manual first, then Docs/Sheets/Slides |
| 18 | Endpoint prefix | `/v1beta1/graphSessions/` |
| 19 | Abstraction boundary | Extract `EventBus` protocol from `Subscribers` |
| 20 | Task dispatch | **`TaskScheduler` protocol** — injectable node task dispatch |

---

## Architecture

### Execution Model: Task-Per-Node

There is no single long-lived orchestrator task. Instead:

1. The plan (dependency graph) is stored in the database
2. Each node runs as an independent short-lived task
3. When a task completes, it saves outputs and atomically checks which
   downstream nodes are now ready
4. Ready nodes are kicked off as new tasks
5. When a task suspends (needs user input), it saves state and ends

```
                          ┌─────────────────────────────┐
                          │  GraphSessionStore           │
                          │  (database)                  │
                          │                              │
                          │  plan: dependency graph      │
                          │  pending_deps: {C: 2, D: 1} │
                          │  node_outputs: {A: ..., ...} │
                          │  node_status: {A: done, ...} │
                          └─────────┬───────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
    ┌────┴────┐               ┌─────┴────┐              ┌─────┴────┐
    │ Task: A │               │ Task: B  │              │ Task: C  │
    │ (gen)   │               │ (gen)    │              │ (output) │
    │         │               │          │              │          │
    │ execute │               │ execute  │              │ execute  │
    │ save    │               │ save     │              │ save     │
    │ atomic  │──┐            │ atomic   │──┐           │ atomic   │
    │ check   │  │            │ check    │  │           │ check    │
    └─────────┘  │            └──────────┘  │           └──────────┘
                 │                          │
                 │  A done: C.pending = 1   │  B done: C.pending = 0
                 │  (don't start C)         │  → START C!
                 └──────────────────────────┘
```

### The Atomic Counter

Each node in the plan has a `pending_deps` count. When a node completes:

```python
ready_nodes = await store.complete_node(session_id, node_id, outputs)
for node_id in ready_nodes:
    await scheduler.schedule(session_id, node_id)
```

`complete_node()` is the **single coordination point**. It atomically:
1. Saves the node's outputs
2. Decrements `pending_deps` for each downstream node
3. Returns the list of nodes whose count just hit 0

The atomic operation guarantees that even if A and B complete simultaneously
(on different servers), only ONE of them sees C's count reach 0 and triggers it.

**In-memory (dev server):** asyncio is single-threaded, so no actual race.
But the interface is the same.

**Database (production):** Transaction or atomic decrement with RETURNING clause.

### Lifecycle of a Graph Run

```
POST /graphSessions/new
  ├─ Load graph (inline or from Drive)
  ├─ condense(graph) → DAG
  ├─ Build dependency graph + pending_deps counts
  ├─ Store plan in GraphSessionStore
  ├─ Find initial ready nodes (pending_deps == 0)
  ├─ Kick off a task per ready node
  └─ Return {sessionId}

GET /graphSessions/{id}
  └─ SSE stream: replay stored events + subscribe for live events

Each node task:
  ├─ Load inputs (upstream node outputs from store)
  ├─ Execute (Gemini call, agent loop, etc.)
  │   ├─ Emit events via EventBus (nodeStart, agentEvents, etc.)
  │   └─ On suspend: save state → emit suspend → task ends
  ├─ Save outputs to store
  ├─ Emit nodeEnd event
  ├─ store.complete_node(node_id) → newly-ready nodes
  ├─ Kick off tasks for newly-ready nodes
  └─ If store.is_graph_complete() → emit graphComplete

POST /graphSessions/{id}:resume
  ├─ Load suspended node state
  ├─ Kick off new task that continues the node
  └─ On completion: same flow (save, complete_node, trigger downstream)
```

### SSE Event Flow

```
Client                              Server
──────                              ──────
POST /graphSessions/new
  {graph, mode: "headed"}
  ← {sessionId: "s1"}          →   Store plan
                                    Kick off tasks A, B (ready)

GET /graphSessions/s1           →   Subscribe to EventBus
  ← {type: "graphStart",           Replay + live
      plan: {...}}
  ← {type: "nodeStart",
      nodeId: "A"}                  Task A running
  ← {type: "nodeStart",
      nodeId: "B"}                  Task B running (concurrent)
  ← {type: "agentEvent",
      nodeId: "A", event: ...}
  ← {type: "agentEvent",
      nodeId: "B", event: ...}
  ← {type: "nodeEnd",
      nodeId: "A", outputs: ...}    A done → C.pending = 1
  ← {type: "nodeEnd",
      nodeId: "B", outputs: ...}    B done → C.pending = 0 → start C
  ← {type: "nodeStart",
      nodeId: "C"}                  Task C kicked off
  ← {type: "nodeEnd",
      nodeId: "C", outputs: ...}
  ← {type: "graphComplete",
      outputs: {...}}
```

### Suspend / Resume Flow

```
  ← {type: "nodeStart",
      nodeId: "input-1"}
  ← {type: "inputRequired",
      nodeId: "input-1",
      interactionId: "abc",
      schema: {...}}                 Task ends, state saved

  [Other nodes may still be          Their events keep streaming
   running concurrently]

  [User provides input]

POST /graphSessions/s1:resume
  {interactionId: "abc",
   response: {...}}
  ← {ok: true}                 →   New task: resume input-1

  ← {type: "nodeEnd",
      nodeId: "input-1",
      outputs: {...}}                Input done → trigger downstream
  ← {type: "nodeStart",
      nodeId: "gen-1"}               Downstream kicked off
  ...
```

> [!NOTE]
> The SSE stream stays open throughout — it's subscribed to the session's
> EventBus. Events from all concurrent node tasks flow through it. When a
> node suspends, only that node's task ends. Other nodes and the SSE stream
> are unaffected.

### Reconnection

```
  [Browser tab closed/refreshed]

GET /graphSessions/s1?after=N   →   Replay events after N from store
  ← [replayed events]               Reconstruct UI state
  ← [live events continue]          If tasks still running
```

---

## Protocols

### New: `EventBus` (replaces `Subscribers`)

Extracted from the concrete `Subscribers` class currently in `sessions/api.py`.
This fixes an existing abstraction boundary violation — `Subscribers` is an
in-memory-only implementation living in synced code.

```python
# opal_backend/event_bus.py (synced)

@runtime_checkable
class EventBus(Protocol):
    """Live event delivery from background tasks to clients.

    Implementations:
    - InMemoryEventBus (local/) — asyncio.Queue, single-process
    - Production — database change streams or pub/sub
    """

    def subscribe(
        self, session_id: str,
    ) -> AsyncIterator[dict[str, Any]]:
        """Subscribe to live events. Yields None as sentinel."""
        ...

    async def publish(
        self, session_id: str, event: dict[str, Any],
    ) -> None:
        """Publish an event to all subscribers."""
        ...

    async def close(self, session_id: str) -> None:
        """Signal end-of-stream to all subscribers."""
        ...
```

### New: `TaskScheduler`

The operation of starting a node task must be injectable. In the dev server,
it's `asyncio.create_task()`. In production, it queues an RPC to ensure
proper load balancing across server instances.

```python
# opal_backend/task_scheduler.py (synced)

@runtime_checkable
class TaskScheduler(Protocol):
    """Protocol for dispatching node tasks.

    Abstracts HOW a node task is started. The graph runner calls
    ``schedule()`` whenever a node becomes ready; the implementation
    decides where and how the task runs.

    Implementations:
    - ``LocalTaskScheduler`` (``local/task_scheduler_impl.py``)
      — ``asyncio.create_task()`` in the same process.
    - Production — enqueues an RPC to a load-balanced task worker.
    """

    async def schedule(
        self,
        session_id: str,
        node_id: str,
    ) -> None:
        """Dispatch a node task for execution.

        The implementation is responsible for:
        1. Loading node inputs from GraphSessionStore
        2. Running the node handler
        3. Calling complete_node() on completion
        4. Scheduling newly-ready downstream nodes

        Or alternatively, just enqueuing the work for a worker
        that does all of the above.
        """
        ...

    async def cancel(
        self, session_id: str, node_id: str | None = None,
    ) -> None:
        """Cancel a running node task (or all tasks in a session)."""
        ...
```

**Dev server implementation:**

```python
# opal_backend/local/task_scheduler_impl.py

class LocalTaskScheduler:
    """Runs node tasks as asyncio tasks in the same process."""

    def __init__(self, node_runner, store, event_bus):
        self._runner = node_runner
        self._store = store
        self._event_bus = event_bus
        self._tasks: dict[str, asyncio.Task] = {}

    async def schedule(self, session_id, node_id):
        task = asyncio.create_task(
            self._runner.run(session_id, node_id),
            name=f"node-{session_id}-{node_id}",
        )
        self._tasks[f"{session_id}:{node_id}"] = task

    async def cancel(self, session_id, node_id=None):
        if node_id:
            task = self._tasks.pop(f"{session_id}:{node_id}", None)
            if task and not task.done():
                task.cancel()
        else:
            prefix = f"{session_id}:"
            for key in list(self._tasks):
                if key.startswith(prefix):
                    task = self._tasks.pop(key)
                    if not task.done():
                        task.cancel()
```

> [!IMPORTANT]
> Extracting `EventBus` also fixes the existing agent sessions API for
> multi-server deployments. This isn't Heartstone-specific — it's a
> prerequisite that benefits both agent sessions and graph sessions.

### New: `GraphSessionStore`

Stores graph execution state and coordinates node scheduling.

```python
# opal_backend/graph_session_store.py (synced)

@runtime_checkable
class GraphSessionStore(Protocol):
    """Graph execution state and node scheduling coordination.

    Implementations:
    - InMemoryGraphSessionStore (local/) — dict-backed, dev server
    - Production — database with atomic operations
    """

    # ── Plan Storage ──

    async def create(
        self, session_id: str, plan: GraphPlan,
    ) -> None:
        """Store plan with initial dependency counts."""
        ...

    async def get_plan(
        self, session_id: str,
    ) -> GraphPlan | None:
        """Load the stored plan."""
        ...

    # ── Node Lifecycle ──

    async def complete_node(
        self, session_id: str, node_id: str, outputs: dict[str, Any],
    ) -> list[str]:
        """Atomically mark node complete, return newly-ready node IDs.

        This is THE coordination point. Must guarantee:
        - Outputs are persisted before downstream checks
        - When concurrent nodes complete, each downstream is
          triggered exactly once (when its last dep completes)

        Implementation:
        - In-memory: direct dict ops (asyncio = no race)
        - SQL: UPDATE ... SET pending = pending - 1 RETURNING pending
        - Firestore: Transaction read-decrement-write
        """
        ...

    async def get_node_inputs(
        self, session_id: str, node_id: str,
    ) -> dict[str, list[Any]]:
        """Load upstream node outputs that are this node's inputs.

        Returns a dict mapping input port → LLMContent[] gathered
        from upstream node outputs connected to this port.
        """
        ...

    async def get_node_config(
        self, session_id: str, node_id: str,
    ) -> dict[str, Any]:
        """Load node configuration from the stored plan."""
        ...

    # ── Suspend / Resume ──

    async def suspend_node(
        self, session_id: str, node_id: str,
        interaction_id: str,
        state: SuspendedNodeState,
    ) -> None:
        """Save suspended node state. Task ends after this."""
        ...

    async def load_suspended_node(
        self, session_id: str, interaction_id: str,
    ) -> tuple[str, SuspendedNodeState] | None:
        """Load suspended node by interaction ID. Returns (nodeId, state)."""
        ...

    # ── Graph Lifecycle ──

    async def is_graph_complete(
        self, session_id: str,
    ) -> bool:
        """True when all nodes are completed (or skipped)."""
        ...

    async def get_graph_outputs(
        self, session_id: str,
    ) -> dict[str, Any]:
        """Load final outputs from all completed nodes."""
        ...

    async def mark_node_failed(
        self, session_id: str, node_id: str, error: str,
    ) -> list[str]:
        """Mark node failed, skip dependents, return newly-ready nodes.

        When a node fails, its dependents that have no other path
        are marked as skipped. Dependents that have alternative
        completed paths may still become ready.
        """
        ...

    # ── Event Log ──

    async def append_event(
        self, session_id: str, event: dict[str, Any],
    ) -> int:
        """Append event to the session log. Returns event index."""
        ...

    async def get_events(
        self, session_id: str, *, after: int = -1,
    ) -> list[dict[str, Any]]:
        """Return events with index > after."""
        ...

    # ── Status ──

    async def get_status(
        self, session_id: str,
    ) -> str | None:
        """Return session status (running, suspended, completed, etc.)."""
        ...

    async def set_status(
        self, session_id: str, status: str,
    ) -> None:
        """Set session status."""
        ...
```

### Existing (unchanged)

| Protocol | Purpose | Used by Heartstone? |
|----------|---------|---------------------|
| `BackendClient` | Gemini + One Platform | Yes — generate nodes call it |
| `InteractionStore` | Agent suspend/resume | Yes — internal to agent loop |
| `SessionStore` | Agent session lifecycle | No — agent sessions only |
| `DriveOperationsClient` | Drive file ops | Yes — graph loading, output saves |

> [!TIP]
> `GraphSessionStore` is separate from `SessionStore`. Agent sessions and
> graph sessions have different lifecycle models (agent sessions use the
> existing `sessions/api.py`; graph sessions use task-per-node coordination).
> They share `EventBus` for live event delivery.

---

## Node Type → Backend Handler

| Node Type | Mode | Backend Handler |
|-----------|------|----------------|
| **ask-user** | — | Emit `inputRequired`, save state, end task |
| **generate** | agent | `run_agent()` (full agent loop) |
| **generate** | text-* | Direct `BackendClient.stream_generate_content()` |
| **generate** | image | Direct call to image function |
| **generate** | video/audio/music | Direct call to media function |
| **asset** | — | Resolve `storedData`/`fileData` → LLMContent |
| **render-outputs** | manual | Passthrough — return LLMContent |
| **render-outputs** | HTML auto | `BackendClient.stream_generate_content()` |
| **render-outputs** | Google Docs/Sheets/Slides | `DriveOperationsClient` (port) |

### Agent Mode Generate Nodes

When a generate node in agent mode runs:

```python
async def run_agent_node(session_id, node_id, inputs, config, ...):
    # Emit nodeStart
    await event_bus.publish(session_id, {
        "type": "nodeStart", "nodeId": node_id, "nodeType": "generate"
    })

    # Build segments from node config + upstream inputs
    segments = build_segments(config, inputs)

    # Run the agent loop — events forwarded with nodeId envelope
    async for event in run_agent(segments=segments, backend=backend, ...):
        await event_bus.publish(session_id, {
            "type": "agentEvent", "nodeId": node_id, "event": event.to_dict()
        })
        await store.append_event(session_id, {...})

        if is_suspend_event(event):
            # Agent needs user input — save and end
            await store.suspend_node(session_id, node_id, ...)
            return  # Task ends

    # Agent completed — extract outputs
    outputs = extract_outputs(event)
    # ... complete_node, trigger downstream ...
```

The agent loop's internal `InteractionStore` handles the agent's own
suspend/resume state. The graph layer wraps it with node-level state.

### Non-Agent Text Generation

Direct Gemini call — no agent loop, no function-calling overhead:

```python
async def run_text_gen_node(session_id, node_id, inputs, config, ...):
    model = config.get("modelName", "gemini-3-flash-preview")
    si = config.get("systemInstruction", "")

    body = build_gemini_request(inputs, si)
    result_parts = []
    async for chunk in backend.stream_generate_content(model, body):
        # Stream partial results as events
        await event_bus.publish(session_id, {
            "type": "agentEvent", "nodeId": node_id,
            "event": {"type": "content", "parts": chunk.get("parts", [])}
        })
        result_parts.extend(chunk.get("parts", []))

    outputs = {"context": [{"role": "model", "parts": result_parts}]}
    # ... complete_node, trigger downstream ...
```

---

## Headless Mode

### Input Defaults

```json
{
  "graphId": "drive-file-id",
  "mode": "headless",
  "inputs": {
    "input-node-abc": {"parts": [{"text": "Default value"}]},
    "input-node-xyz": {"parts": [{"text": "Another default"}]}
  },
  "agentContext": [
    {"parts": [{"text": "Additional context for agent steps"}]}
  ]
}
```

**`inputs`** — keyed by input node ID. When an input node's task runs:
- If `inputs[nodeId]` exists → use it as output, no suspension
- If absent and not required → empty context
- If absent and required → error

**`agentContext`** — prepended to agent-mode generate node objectives.
Useful for scheduled runs needing time-specific context.

---

## Frontend Integration

### Flag

New flag: `enableBackendGraphRunner`

When ON, the "Run" button branches in the `prepare()` action:

```typescript
if (flags.enableBackendGraphRunner) {
  const handle = graphRunService.startRun(currentGraph, { mode: "headed" });
  // handle.events is a GraphRunEventSource
} else {
  const runner = runService.createRunner(config);
  // Existing PlanRunner path
}
```

### GraphRunEvent → SCA Controller Mapping

```
graphStart(plan)       → RunController.setStatus("running")
nodeStart(nodeId)      → RendererController.setNodeState(nodeId, "working")
agentEvent(nodeId, e)  → per-node AgentEventConsumer (reuse existing)
nodeEnd(nodeId)        → RendererController.setNodeState(nodeId, "succeeded")
                         if output node → ScreenController.createScreen()
inputRequired(nodeId)  → RendererController.setNodeState(nodeId, "waiting")
                         render input UI
graphComplete          → RunController.setStatus("stopped")
graphError             → RunController.setStatus("stopped") + error
```

Same controllers, same visual states. The `GraphRunEventSource` is a thin
adapter.

---

## Endpoints

```
POST /v1beta1/graphSessions/new
  {graph?, graphId?, mode, inputs?, agentContext?, accessToken}
  → {sessionId}

GET /v1beta1/graphSessions/{id}?after=-1
  → SSE stream (replay + live)

POST /v1beta1/graphSessions/{id}:resume
  {interactionId, response, accessToken?}
  → {ok: true}

GET /v1beta1/graphSessions/{id}/status
  → {sessionId, status, nodeStates, progress?}

POST /v1beta1/graphSessions/{id}:cancel
  → {sessionId, status: "cancelled"}
```

---

## Porting Table

### Port from TypeScript

| Component | From (TS) | To (Python) |
|-----------|-----------|-------------|
| `condense()` | `condense.ts` | `graph_condense.py` |
| `createPlan()` | `create-plan.ts` | `graph_plan.py` |
| Control flow | `control.ts` | `graph_control.py` |
| Graph types | `@breadboard-ai/types` | `graph_types.py` |
| Docs/Sheets/Slides save | `connector-save.ts` | `output_actions.py` |

### New Backend Code

| Component | Location | Purpose |
|-----------|----------|---------|
| `event_bus.py` | `opal_backend/` (synced) | EventBus protocol |
| `graph_session_store.py` | `opal_backend/` (synced) | GraphSessionStore protocol |
| `graph_plan.py` | `opal_backend/` (synced) | condense + dependency graph |
| `graph_types.py` | `opal_backend/` (synced) | GraphPlan, GraphRunEvent, etc. |
| `graph_runner.py` | `opal_backend/` (synced) | Node task execution logic |
| `node_handlers.py` | `opal_backend/` (synced) | Per-node-type handlers |
| `output_actions.py` | `opal_backend/` (synced) | Drive save operations |
| `event_bus_impl.py` | `opal_backend/local/` | InMemoryEventBus |
| `graph_session_store_impl.py` | `opal_backend/local/` | InMemoryGraphSessionStore |
| `graph_session_router.py` | `opal_backend/local/` | FastAPI endpoints |

### New Frontend Code

| Component | Location | Purpose |
|-----------|----------|---------|
| `GraphRunService` | `visual-editor/sca/services/` | Backend graph run management |
| `GraphRunEventSource` | `visual-editor/` | SSE consumer for graph events |

### Rename

| Current | New |
|---------|-----|
| `run()` in `run.py` | `run_agent()` |
| `resume()` in `run.py` | `resume_agent()` |

---

## Phasing

### Pre-Phase: EventBus Extraction

Extract `Subscribers` → `EventBus` protocol. Create `InMemoryEventBus`.
Refactor `sessions/api.py` and `session_router.py` to use `EventBus`.

🎯 **Objective:** Existing agent sessions work identically, but
`Subscribers` is now injected via the `EventBus` protocol.

### Phase 1: Core Library — Graph Planning

Port `condense()`, `createPlan()`, and dependency graph construction to
Python. Define `GraphPlan`, `GraphRunEvent` types.

🎯 **Objective:** Unit test: given a `GraphDescriptor`, produce a correct
dependency graph with `pending_deps` counts.

### Phase 2: GraphSessionStore + Node Task Runner

Create `GraphSessionStore` protocol and `InMemoryGraphSessionStore`. Build
the node task runner: load inputs → execute → save outputs → trigger
downstream. Initially only single-shot text generation (direct Gemini call).

🎯 **Objective:** Unit test: a two-node linear graph (text gen → output)
runs via task-per-node, events emitted correctly.

### Phase 3: GraphSession RPC + SSE

Add `graph_session_router.py` with endpoints. Wire `EventBus` for live
event delivery.

🎯 **Objective:** `curl` starts a graph run, receives SSE events for each
node.

### Phase 4: Agent Mode Integration

Wire generate nodes in agent mode to call `run_agent()`. Agent events
wrapped with `nodeId`. Agent suspend/resume saves node state, ends task,
new task on resume.

🎯 **Objective:** A graph with an Agent node runs via backend with agent
events streaming, including waitForInput suspend/resume.

### Phase 5: Input Node Suspend/Resume

Input nodes emit `inputRequired` and end task. Resume endpoint loads
state, provides input as node output, triggers downstream.

🎯 **Objective:** Input → Generate → Output works interactively via RPC.

### Phase 6: Concurrent Nodes

Multiple ready nodes kick off as concurrent tasks. Atomic counter
coordinates downstream triggers.

🎯 **Objective:** A graph with two independent Generate nodes runs both
concurrently, correct events, correct downstream triggering.

### Phase 7: Frontend Integration

Add `enableBackendGraphRunner` flag, `GraphRunService`,
`GraphRunEventSource`. Wire `prepare()` action.

🎯 **Objective:** With flag on, "Run" button executes a simple graph on
the backend with live UI updates.

### Phase 8: Asset Nodes + Media Generation

Asset node resolution. Image, video, audio, music generation (direct
calls to existing function handlers).

🎯 **Objective:** Graph with asset → image gen → output runs end-to-end.

### Phase 9: Output Node Actions

Manual mode (trivial). HTML auto-layout (direct Gemini call). Google
Docs/Sheets/Slides save (port from TS). Incremental.

🎯 **Objective:** Output node with Google Docs mode saves to Drive.

### Phase 10: Drive Graph Loading + Headless Mode

Load graphs from Drive by file ID. Support `mode: "headless"` with
`inputs` defaults and `agentContext`.

🎯 **Objective:** `POST {graphId, mode: "headless", inputs: {...}}` loads
and runs a graph without frontend interaction.

### Phase 11: Reconnection + History

Event replay on reconnect. Read-only history view for completed runs.

🎯 **Objective:** Close/reopen browser — UI reconstructs from replayed
events.

---

## Abstraction Boundary Summary

After Heartstone:

| Protocol | Synced File | Abstracts | Dev Impl | Prod Impl |
|----------|-------------|-----------|----------|-----------|
| `BackendClient` | `backend_client.py` | Gemini + One Platform | HTTP | Direct RPC |
| `InteractionStore` | `interaction_store.py` | Agent suspend/resume | In-memory | Database |
| `SessionStore` | `sessions/store.py` | Agent session lifecycle | In-memory | Database |
| `DriveOperationsClient` | `drive_operations_client.py` | Drive file ops | HTTP | Direct RPC |
| `FileSystem` | `file_system_protocol.py` | Agent file system | Disk/Memory | Disk/Memory |
| **`EventBus`** | **`event_bus.py`** | **Live event delivery** | **asyncio.Queue** | **Pub/Sub** |
| **`GraphSessionStore`** | **`graph_session_store.py`** | **Graph execution state** | **In-memory dict** | **Database** |
| **`TaskScheduler`** | **`task_scheduler.py`** | **Node task dispatch** | **asyncio.create_task** | **RPC queue** |

All protocols in synced code. All implementations in `local/` (or google3).

---

## Resolved Questions (Final)

1. **Production session routing:** Solved by the `EventBus` protocol. The
   SSE stream subscribes to the session's event channel via `EventBus`.
   The `EventBus` production implementation handles cross-server delivery
   (pub/sub, change streams, etc.). The SSE connection doesn't need to hit
   the same server as the node tasks.

2. **Graph run timeout:** Tabled for now. Timeouts and maximum turn limits
   can be added later. **TODO:** Add configurable timeout per node and
   per graph run.

3. **Graph versioning:** Plan snapshot stored in `GraphSessionStore` is
   immutable. Edits to the graph during a run don't affect the running
   plan.

4. **Output node porting priority:** Manual → Webpage (HTML auto-layout) →
   Google Docs → Google Sheets → Google Slides.
