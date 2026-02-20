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

A union of 21 event types covering the full agent lifecycle:

| Event                | Direction | Purpose                        |
| -------------------- | --------- | ------------------------------ |
| `start`              | → client  | Loop began                     |
| `thought`            | → client  | Model reasoning                |
| `functionCall`       | → client  | Tool invocation started        |
| `functionCallUpdate` | → client  | Tool status update             |
| `functionResult`     | → client  | Tool result                    |
| `subagentAddJson`    | → client  | Nested progress from function  |
| `subagentError`      | → client  | Nested error from function     |
| `subagentFinish`     | → client  | Nested progress complete       |
| `content`            | → client  | Model output content           |
| `turnComplete`       | → client  | Full turn finished             |
| `sendRequest`        | → client  | Gemini request sent            |
| `waitForInput`       | ⇄ suspend | **Suspend**: needs user text   |
| `waitForChoice`      | ⇄ suspend | **Suspend**: needs user choice |
| `readGraph`          | ⇄ suspend | **Suspend**: read graph data   |
| `inspectNode`        | ⇄ suspend | **Suspend**: inspect a node    |
| `applyEdits`         | ⇄ suspend | **Suspend**: confirmed edits   |
| `queryConsent`       | ⇄ suspend | **Suspend**: user consent      |
| `graphEdit`          | → client  | Apply edit specs (fire-forget) |
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

For `onFunctionCall`, the adapter returns a **proxy `ProgressReporter`** that
emits `subagentAddJson`/`subagentError`/`subagentFinish` events through the
sink. Function handlers (image gen, video gen, etc.) call reporter methods as
usual — the events travel through the event layer to the consumer, which
dispatches them to the real `ConsoleWorkItem` reporter.

## How It's Wired Today

Both agents flow through the event layer end-to-end:

**Graph-editing agent:**

1. User types in `GraphEditingChat`
2. `startGraphEditingAgent` action creates a run via `AgentService`
3. Consumer handlers wire events → `GraphEditingAgentController`
4. `buildHooksFromSink(handle.sink)` creates hooks for the loop
5. Events flow: Loop → sink → bridge → consumer → controller → UI

**Content generation agent:**

1. `invokeAgent` creates a run via `AgentService`
2. Consumer handlers wire events → `ConsoleProgressManager` + `RunStateManager`
3. `buildHooksFromSink(handle.sink)` creates hooks (including proxy reporters)
4. Subagent events (image/video/audio gen) dispatch to stashed reporters via
   `reporterMap`
5. `waitForInput` handler calls `requestInput()` to collect user text/file input
6. `waitForChoice` handler calls `choicePresenter.presentChoices()` for A2UI
   choices
7. Events flow: Loop → sink → bridge → consumer → progress + run state

## Roadmap: What's Next

### Phase 1: Complete Client-Side Event Coverage ✅ (done)

- [x] Event types, sink, consumer, bridge
- [x] `buildHooksFromSink`
- [x] `AgentService` + `AgentRunHandle`
- [x] Strangler-fig `GraphEditingAgentService` → Actions

### Phase 2: Content Generation Agent ✅ (done)

- [x] Strangler-fig the content generation agent to use `AgentService`
- [x] Wire `ConsoleProgressManager` + `RunStateManager` as consumer handlers
- [x] Subagent reporter events (`subagentAddJson`, `subagentError`,
      `subagentFinish`)
- [x] Proxy `ProgressReporter` preserves nested progress for media gen functions
- [x] `FunctionCallEvent` carries `args` for custom work item titles

### Phase 3: Suspend/Resume via Events ✅ (done)

- [x] `AgentUI.chat()` → `sink.suspend<ChatResponse>()` with `waitForInput`
- [x] `AgentUI.presentChoices()` → `sink.suspend<ChatChoicesResponse>()` with
      `waitForChoice`
- [x] Consumer handlers: `requestInput()` for text, `ChoicePresenter` for
      choices
- [x] `buildAgentRun` returns `choicePresenter` (clean backend/consumer split)
- [x] Graph-editing agent: `sink.suspend()` in chat-functions + consumer handler

### Phase 3.5: Generalize Client Calls (in progress)

Formalize all server→client function calls through `sink.suspend()` so Phase 4
is a transport swap, not a refactor.

- [x] Extract `SuspendEvent` union from `AgentEvent`
- [x] Widen `suspend()` to accept any `SuspendEvent`
- [x] Add typed suspend events: `ReadGraphEvent`, `InspectNodeEvent`,
      `ApplyEditsEvent`, `QueryConsentEvent`
- [x] Graph-editing functions: replace direct `editor.raw()` / `inspect()` calls
      with `sink.suspend("readGraph")` / `sink.suspend("inspectNode")`
- [x] Graph-editing functions: replace direct `applyTransform()` with
      `sink.suspend("applyEdits")` for confirmed graph writes
- [x] Generate functions: replace direct `queryConsent()` with
      `sink.suspend("queryConsent")`
- [x] Consumer handlers for each new suspend event

### Phase 3.75: Mock Server Protocol Validation (complete)

Standalone Python mock server (`packages/mock-agent-server/`) that implements
the SSE wire format, so `SSEAgentEventSource` can be developed against a real
HTTP endpoint before the TypeScript server exists.

- [x] Pydantic models for all 21 `AgentEvent` types (`events.py`)
- [x] `SSEAgentEventSink` — serializes events to SSE stream via async queue
- [x] `PendingRequestMap` — asyncio suspend/resume keyed by `requestId`
- [x] FastAPI endpoints: `POST /run`, `GET /events`, `POST /input`,
      `POST /abort`
- [x] Canned scenarios: `echo`, `chat`, `graph-edit`, `consent`
- [x] End-to-end verification: 13 tests in 0.4s (`npm test`)
- [x] `SSEAgentEventSource` — `fetch` + `iteratorFromStream` → consumer
- [x] `SSEAgentRun` / `LocalAgentRun` — split run implementations
- [x] `AgentService.configureRemote(baseUrl, fetchFn)` — remote mode flag
- [x] `sink` removed from `AgentRunHandle` (local-only detail on
      `LocalAgentRun`)

### Phase 3.85: Integration Test

Round-trip integration test that starts the mock server, runs a scenario via
`SSEAgentEventSource` over real HTTP, and validates the full event flow
including suspend/resume.

- [ ] Integration test: `SSEAgentEventSource` ↔ mock server round-trip

### Phase 4: Server-Side Implementation

- [ ] `SSEAgentEventSink` — writes events to SSE response stream
- [ ] `PendingRequestMap` — server-side suspend/resume keyed by `requestId`
- [ ] Server endpoints: `POST /run`, `GET /events`, `POST /input`, `POST /abort`
- [ ] `EventReplayBuffer` — per-run log for reconnection / "tab closed" replay
- [ ] Move `Loop`, `FunctionCaller`, function definitions to unified-server

### Phase 5: Integration & Polish

Phase 3.5 + 4 enable graph editing over the wire automatically. This phase
covers edge cases, testing, and any remaining integration work.

- [ ] End-to-end testing of graph editing via SSE
- [ ] File upload flow via `LLMContent` `inlineData`/`storedData`
- [ ] Reconnection with event replay
