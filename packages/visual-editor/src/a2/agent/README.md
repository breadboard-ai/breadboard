# Agent Event Architecture

> The event-driven layer that enables the client-server cut for agentic code.

## The Big Picture

Today, agent loops (content generation, graph editing) run **in the browser**.
They call Gemini, execute functions, and mutate UI state directly.

The goal is to move agent loops to the **backend** (unified-server),
communicating with the client over **Server-Sent Events (SSE)**. This makes
agents faster (server-side API calls), enables server-only capabilities, and
keeps prompts and logic out of the client bundle.

## The Cut Line

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (browser)                                           │
│                                                             │
│   GraphEditingChat ──→ SCA Actions ──→ AgentService         │
│                                           │                 │
│                                     AgentRunHandle          │
│                                       │         │           │
│                              AgentEventConsumer  AbortCtrl   │
│                                       │                     │
│                              Handler dispatch               │
│                              (→ Controllers)                │
│                                       ▲                     │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ ─ ─ ─ ─ ─ ─ │
│  TODAY: LocalAgentEventBridge          │                     │
│  TOMORROW: SSEAgentEventSource ───(SSE stream)──┐           │
└─────────────────────────────────────────────────│───────────┘
                                                  │
┌─────────────────────────────────────────────────│───────────┐
│  SERVER (unified-server)                        │           │
│                                                 │           │
│   POST /api/agent/run ──→ AgentService          │           │
│                              │                  │           │
│                        Loop + Functions         │           │
│                              │                  │           │
│                   buildHooksFromSink(sink)       │           │
│                              │                  │           │
│                     SSEAgentEventSink ───────────┘           │
│                                                             │
│   POST /api/agent/{runId}/input  ──→ PendingRequestMap      │
│   POST /api/agent/{runId}/abort  ──→ AbortController        │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### Wire Format: `AgentEvent` ([agent-event.ts](./agent-event.ts))

A union of 14 event types covering the full agent lifecycle:

| Event                | Direction | Purpose                        |
| -------------------- | --------- | ------------------------------ |
| `start`              | → client  | Loop began                     |
| `thought`            | → client  | Model reasoning                |
| `functionCall`       | → client  | Tool invocation started        |
| `functionCallUpdate` | → client  | Tool status update             |
| `functionResult`     | → client  | Tool result                    |
| `content`            | → client  | Model output content           |
| `turnComplete`       | → client  | Full turn finished             |
| `sendRequest`        | → client  | Gemini request sent            |
| `waitForInput`       | → client  | **Suspend**: needs user text   |
| `waitForChoice`      | → client  | **Suspend**: needs user choice |
| `graphEdit`          | → client  | Apply edit specs to graph      |
| `complete`           | → client  | Loop finished with result      |
| `error`              | → client  | Loop error                     |
| `finish`             | → client  | Cleanup signal                 |

### Producer: `AgentEventSink` ([agent-event-sink.ts](./agent-event-sink.ts))

The interface the agent loop writes to. Two methods:

- `emit(event)` — fire-and-forget (progress, content)
- `suspend(event)` — blocks until client responds (input, choice)

### Consumer: `AgentEventConsumer` ([agent-event-consumer.ts](./agent-event-consumer.ts))

Dispatches events to registered handlers. The `LocalAgentEventBridge` connects
sink → consumer in-process. Replaced by SSE in the server world.

### Run Manager: `AgentService` ([agent-service.ts](./agent-service.ts))

SCA Service managing concurrent runs. Each `startRun()` returns an
`AgentRunHandle` with its own consumer, sink, and abort controller.

### Hook Adapter: `buildHooksFromSink` ([loop-setup.ts](./loop-setup.ts))

Maps `LoopHooks` callbacks to `AgentEvent` emissions. This is the bridge that
lets existing `Loop.run()` code emit events without changes.

## How It's Wired Today

The graph-editing agent flows through the event layer end-to-end:

1. User types in `GraphEditingChat`
2. `startGraphEditingAgent` action creates a run via `AgentService`
3. Consumer handlers wire `thought`/`functionCall` →
   `GraphEditingAgentController`
4. `buildHooksFromSink(handle.sink)` creates hooks for the loop
5. `invokeGraphEditingAgent` runs with those hooks
6. Events flow: Loop → sink → bridge → consumer → controller → UI

## Roadmap: What's Next

### Phase 1: Complete Client-Side Event Coverage ✅ (done)

- [x] Event types, sink, consumer, bridge
- [x] `buildHooksFromSink`
- [x] `AgentService` + `AgentRunHandle`
- [x] Strangler-fig `GraphEditingAgentService` → Actions

### Phase 2: Content Generation Agent

- [ ] Strangler-fig the content generation agent to use `AgentService`
- [ ] Wire `ConsoleProgressManager` + `RunStateManager` as consumer handlers

### Phase 3: Suspend/Resume via Events

- [ ] Replace `waitForInput` callback with `sink.suspend()` + consumer handler
- [ ] Replace `#pendingResolve` pattern with `AgentRunHandle.resolveInput()`

### Phase 4: Server-Side Implementation

- [ ] `SSEAgentEventSink` — writes events to SSE response stream
- [ ] `SSEAgentEventSource` — client reads SSE stream → consumer
- [ ] `PendingRequestMap` — server-side suspend/resume keyed by `requestId`
- [ ] Server endpoints: `POST /run`, `GET /events`, `POST /input`, `POST /abort`
- [ ] Move `Loop`, `FunctionCaller`, function definitions to unified-server

### Phase 5: Graph Editing Over the Wire

- [ ] `GraphEditApplicator` interface — client applies `EditSpec[]` from events
- [ ] Graph read operations (overview, inspect) via server-side graph access
- [ ] `ChatInputBroker` — client handles input/choice UI from events
