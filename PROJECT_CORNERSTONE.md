# Project Cornerstone: One Platform Backend Migration

> Moving agent execution from the browser to the One Platform backend, connected
> over Server-Sent Events.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (visual-editor, browser)                            │
│                                                             │
│   SCA Actions ──→ AgentService.startRun()                   │
│                       │                                     │
│              ┌────────┴────────┐                            │
│              │ AgentRunHandle  │                             │
│              │   .events      │ (AgentEventConsumer)        │
│              │   .abort()     │                             │
│              └────────┬───────┘                             │
│                       │                                     │
│              SSEAgentEventSource                            │
│                       │ fetch + iteratorFromStream           │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                       ▼                                     │
│               OPAL_BACKEND_API_PREFIX                       │
│              (appcatalyst.pa.googleapis.com)                │
└─────────────────────────────────────────────────────────────┘
                        │
                ┌───────┴────────────────────────────────────┐
                │  ONE PLATFORM (google3, production)         │
                │                                             │
                │  Wraps opal-backend-shared with             │
                │  One Platform API surface                   │
                │                                             │
                │  ← copybara from packages/opal-backend-shared
                └─────────────────────────────────────────────┘

  LOCAL DEV:
  ┌─────────────────────────────────────────────────────────┐
  │  packages/opal-backend-dev (Python, FastAPI)            │
  │    - New APIs → wire to opal-backend-shared directly    │
  │    - Existing APIs → proxy to One Platform              │
  └─────────────────────────────────────────────────────────┘

  INTEGRATION TESTING:
  ┌─────────────────────────────────────────────────────────┐
  │  packages/opal-backend-fake (Python, FastAPI)           │
  │    - Canned scenarios, in-memory state                  │
  │    - No real API calls                                  │
  └─────────────────────────────────────────────────────────┘
```

## Packages

| Package               | Language   | Purpose                            |
| --------------------- | ---------- | ---------------------------------- |
| `opal-backend-shared` | Python     | Copybara-sharable agent logic      |
| `opal-backend-dev`    | Python     | Dev server (proxy + direct wiring) |
| `opal-backend-fake`   | Python     | Fake server (canned scenarios)     |
| `unified-server`      | TypeScript | Static content + blobs (unchanged) |
| `visual-editor`       | TypeScript | Client (SSE consumer, unchanged)   |

## Wire Format

21 `AgentEvent` types defined in
[agent-event.ts](packages/visual-editor/src/a2/agent/agent-event.ts) and
mirrored as Pydantic models in `opal-backend-shared`.

| Event                | Direction | Purpose                  |
| -------------------- | --------- | ------------------------ |
| `start`              | → client  | Loop began               |
| `thought`            | → client  | Model reasoning          |
| `functionCall`       | → client  | Tool invocation started  |
| `functionCallUpdate` | → client  | Tool status update       |
| `functionResult`     | → client  | Tool result              |
| `subagentAddJson`    | → client  | Nested progress          |
| `subagentError`      | → client  | Nested error             |
| `subagentFinish`     | → client  | Nested progress complete |
| `content`            | → client  | Model output             |
| `turnComplete`       | → client  | Full turn finished       |
| `sendRequest`        | → client  | Gemini request sent      |
| `waitForInput`       | ⇄ suspend | Needs user text          |
| `waitForChoice`      | ⇄ suspend | Needs user choice        |
| `readGraph`          | ⇄ suspend | Read graph data          |
| `inspectNode`        | ⇄ suspend | Inspect a node           |
| `applyEdits`         | ⇄ suspend | Confirmed edits          |
| `queryConsent`       | ⇄ suspend | User consent             |
| `graphEdit`          | → client  | Fire-and-forget edits    |
| `complete`           | → client  | Loop finished            |
| `error`              | → client  | Loop error               |
| `finish`             | → client  | Cleanup signal           |

## Phases

### Phase 1: Client-Side Event Coverage ✅

- [x] Event types, sink, consumer, bridge
- [x] `buildHooksFromSink`
- [x] `AgentService` + `AgentRunHandle`
- [x] Strangler-fig `GraphEditingAgentService` → Actions

### Phase 2: Content Generation Agent ✅

- [x] Content generation agent uses `AgentService`
- [x] `ConsoleProgressManager` + `RunStateManager` as consumer handlers
- [x] Subagent reporter events + proxy `ProgressReporter`
- [x] `FunctionCallEvent` carries `args` for custom work item titles

### Phase 3: Suspend/Resume via Events ✅

- [x] `waitForInput` / `waitForChoice` suspend events
- [x] Consumer handlers: `requestInput()`, `ChoicePresenter`
- [x] Graph-editing agent: `sink.suspend()` in chat-functions

### Phase 3.5: Generalize Client Calls ✅

- [x] `SuspendEvent` union, widened `suspend()` signature
- [x] `readGraph`, `inspectNode`, `applyEdits`, `queryConsent` suspend events
- [x] Consumer handlers for each new suspend event

### Phase 3.75: Client-Side SSE Transport ✅

- [x] `SSEAgentEventSource` — `fetch` + `iteratorFromStream`
- [x] `SSEAgentRun` / `LocalAgentRun` — split run implementations
- [x] `AgentService.configureRemote(baseUrl, fetchFn)`

### Phase 4: Python Backend Packages ← **we are here**

#### 4.1: Scaffolding ✅

- [x] `packages/opal-backend-shared/` — protocol primitives (events, sink,
      pending requests)
- [x] `packages/opal-backend-fake/` — canned scenarios + FastAPI endpoints
      (absorbed mock-agent-server)
- [x] `packages/opal-backend-dev/` — stub with proxy for existing APIs
- [x] Remove `packages/mock-agent-server/`
- [x] Migrate and verify all existing tests (13/13 passing)

#### 4.2: Local Dev Workflow ✅

- [x] Root `npm run setup:python` (creates venvs for all Python packages)
- [x] `PIP_INDEX_URL` baked into all setup scripts
- [x] `dev:fake` starts fake Python backend alongside static server (with venv
      check)
- [x] `BACKEND_API_ENDPOINT=http://localhost:8000` set in `serve:fake` env
- [x] Developer docs in `opal-backend-dev/README.md`

#### 4.3: Port Agent Loop to Python

- [ ] Port `Loop` (agent loop core) to `opal-backend-shared`
- [ ] Port `FunctionCaller` (tool dispatch) to `opal-backend-shared`
- [ ] Port function definitions (generate, graph-editing, a2ui, etc.)
- [ ] Wire agent-run endpoints in `opal-backend-dev`
- [ ] End-to-end: `SSEAgentEventSource` ↔ `opal-backend-dev` round-trip

#### 4.4: Graph-Editing Agent Over the Wire

- [ ] Graph-editing functions use suspend events for all client calls
- [ ] End-to-end graph editing via SSE

#### 4.5: Content Generation Agent Over the Wire

- [ ] Content gen agent runs on Python backend
- [ ] Subagent progress events (image/video/audio gen) over SSE

### Phase 5: Integration & Polish

- [ ] File upload flow via `LLMContent` `inlineData`/`storedData`
- [ ] Reconnection with event replay (`EventReplayBuffer`)
- [ ] Remove `LocalAgentRun` path (or keep for offline dev)
- [ ] `opal-backend-dev` proxies all APIs as they land on One Platform
