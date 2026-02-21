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
                │  ONE PLATFORM (production backend)          │
                │                                             │
                │  Wraps opal-backend-shared with             │
                │  One Platform API surface                   │
                │                                             │
                │  ← synced from packages/opal-backend-shared
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

| Package               | Language   | Purpose                             |
| --------------------- | ---------- | ----------------------------------- |
| `opal-backend-shared` | Python     | Shared agent logic (synced to prod) |
| `opal-backend-dev`    | Python     | Dev server (proxy + direct wiring)  |
| `opal-backend-fake`   | Python     | Fake server (canned scenarios)      |
| `unified-server`      | TypeScript | Static content + blobs (unchanged)  |
| `visual-editor`       | TypeScript | Client (SSE consumer, unchanged)    |

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

#### 4.3: Proxy-First Backend ✅

- [x] `opal_backend_shared/local/` — local-only shared API surface
- [x] `api_surface.py` — router factory with `AgentBackend` + `ProxyBackend`
      protocols
- [x] `opal-backend-dev` reverse proxy via `httpx` (forwards auth headers)
- [x] `opal-backend-fake` refactored to shared API surface (13 tests passing)
- [x] `dev:backend` wireit entry (serves at `:3000`, proxy at `:8080`)
- [x] `start-dev-backend.sh` with venv check

#### 4.4: Port Agent Loop to Python

##### 4.4a: Loop Core ✅

- [x] `gemini_client.py` — streaming Gemini API via `httpx`
- [x] `function_definition.py` — `FunctionDefinition`, `FunctionGroup` types
- [x] `function_caller.py` — async function dispatch + result collection
- [x] `loop.py` — while-loop orchestrator with `LoopHooks`
- [x] Unit tests with mocked Gemini responses (14 tests)

##### 4.4b: Termination Functions ✅

- [x] Port `system_objective_fulfilled` (terminates loop with success)
- [x] Port `system_failed_to_fulfill_objective` (terminates loop with failure)
- [x] System instruction (meta-plan prompt — verbatim port)
- [x] Unit tests (13 tests)

##### 4.4c: DevAgentBackend + End-to-End ✅

- [x] `AgentEventSink` + `build_hooks_from_sink` in `opal-backend-shared`
- [x] `DevAgentBackend` in `opal-backend-dev` (implements `AgentBackend`)
- [x] Agent endpoint wiring (always active, access token from request headers)
- [x] Unit tests (15 tests for event sink + hooks)

##### 4.4d: Real Objective + Auth Wiring

- [ ] `StartRunRequest` takes objective (`LLMContent`) + access token (not
      "scenario")
- [ ] `DevAgentBackend.start_run` forwards access token to `Loop`
- [ ] Frontend `SSEAgentRun` can connect and receive events from dev backend

> **🧪 Checkpoint:** Start frontend + dev backend, give it a simple text task
> like "make a joke". The agent calls Gemini, classifies it as simple domain,
> and returns the result via `system_objective_fulfilled`. Full SSE round-trip
> proven: frontend → backend → Gemini → SSE → UI. More complex tasks that need
> tools (file system, image gen) will fail gracefully.

##### 4.4e: Agent File System + Remaining System Functions

- [ ] Port `AgentFileSystem` (in-memory virtual FS)
- [ ] Port remaining system functions (list/read/write files, task tree)
- [ ] Add `intermediate` / `FileData` to `AgentResult`

##### 4.4f: Content Generation Functions

- [ ] Port `conformGeminiBody` (data-part transforms for file upload)
- [ ] Port `SimplifiedToolManager` / `customTools` support in Loop
- [ ] Port generate functions (image/video/audio/music)
- [ ] Port `PidginTranslator` (objective translation)

> **🧪 Checkpoint:** Frontend + dev backend, give a simple prompt like "generate
> an image of a cat". The agent uses real Gemini APIs, calls generate functions,
> emits subagent progress events, and returns the result through
> `system_objective_fulfilled`. Full content gen flow end-to-end.

#### 4.5: Graph-Editing Agent Over the Wire

- [ ] Port suspend/resume plumbing (`sink.suspend()` ↔ `/input` endpoint)
- [ ] Graph-editing functions use suspend events for all client calls
- [ ] End-to-end graph editing via SSE

> **🧪 Checkpoint:** Frontend + dev backend, open graph editor and use the AI
> chat to edit a graph. Suspend/resume events flow over SSE, graph edits appear
> in the UI in real time.

#### 4.6: Content Generation Agent Over the Wire

- [ ] Content gen agent runs on Python backend
- [ ] Subagent progress events (image/video/audio gen) over SSE

### Phase 5: Integration & Polish

- [ ] File upload flow via `LLMContent` `inlineData`/`storedData`
- [ ] Reconnection with event replay (`EventReplayBuffer`)
- [ ] Remove `LocalAgentRun` path (or keep for offline dev)
- [ ] `opal-backend-dev` proxies all APIs as they land on One Platform

> **🧪 Checkpoint:** Full parity with the in-process agent. Everything that
> works locally works identically through the dev backend. `LocalAgentRun` can
> be removed or kept as a fallback.
