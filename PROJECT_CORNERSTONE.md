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

## Dev Backend Pipeline

> **How to run end-to-end**: `npm run dev:backend -w packages/unified-server`
>
> This starts **both** the unified-server (port 3000, serves the frontend) and
> the Python dev backend (port 8080, runs the agent loop). Open
> `localhost:3000`, create or open an Opal, and run it — the full wire protocol
> will be exercised.

**Activation**: The frontend enters remote mode when
`CLIENT_DEPLOYMENT_CONFIG.DEV_BACKEND_MODE` is set. This calls
`agentService.configureRemote(OPAL_BACKEND_API_PREFIX, fetchWithCreds)` in
`packages/visual-editor/src/sca/services/services.ts`.

**Data flow**:

```
Frontend (browser)                          Dev backend (Python)
─────────────────────                       ────────────────────
1. User runs Opal
2. resolveToSegments(objective, params)
   → segments[] + flags
3. SSEAgentRun POSTs to /api/agent/run
   body: {kind, segments, flags}
                                    ──→  4. to_pidgin(segments, file_system)
                                            → pidgin text + capabilities
                                         5. Wrap: <objective>text</objective>
                                         6. Loop.run(objective) → Gemini
                                    ←──  7. SSE events stream back
8. AgentEventConsumer dispatches
   events to SCA controllers
```

**Key files**:

- `packages/visual-editor/src/a2/agent/resolve-to-segments.ts` — template →
  segments
- `packages/visual-editor/src/a2/agent/sse-agent-run.ts` — POST body
  construction
- `packages/opal-backend-dev/opal_backend_dev/main.py` — receives and processes
  body
- `packages/opal-backend-shared/opal_backend_shared/pidgin.py` — `to_pidgin` +
  `from_pidgin_string`

## Phases

### How Objectives Work

Objectives (🎯) are the **real** milestones — concrete, executable tests that
prove the system works. They go at the top of each phase. Everything below them
is in service of reaching them.

**Plan backward from the objective.** Write the objective first as a specific
action with an observable result ("run this command, see this output"). Then
work backward: what items are needed to make that action succeed? If the items
don't add up to a reachable objective, the plan is wrong — restructure it.

**A checked-off list is not an objective.** Individual items can be correct
(code compiles, tests pass) without adding up to the objective. Before marking a
phase complete, trace the full path from the user's action to the expected
result. If any link is missing, the objective is not reached — add the missing
work to the plan rather than redefining the objective.

**Restructuring is progress.** Discovering that the plan doesn't reach the
objective is valuable information. Add new phases, split existing ones, move
items — whatever makes the path to the objective honest.

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

##### 4.4d: Resumable Stream Protocol ✅

> **🎯 Objective:** Backend pipeline works end-to-end without the frontend.
>
> ```
> curl -X POST http://localhost:8080/api/agent/run \
>   -H "Content-Type: application/json" \
>   -H "Authorization: Bearer $(gcloud auth print-access-token)" \
>   -d '{"kind":"content","objective":{"parts":[{"text":"Make a joke"}],"role":"user"}}' \
>   --no-buffer
> ```
>
> → SSE stream of events → ends with `system_objective_fulfilled`.

**Architecture pivot:** Single `POST /api/agent/run` → SSE stream replaces the
multi-endpoint pattern.

```
POST /api/agent/run  →  SSE stream (start or resume)
Body (start):  {kind, objective}
Body (resume): {interactionId, response}
```

- [x] Redesign `api_surface.py` — single `POST /run` → `EventSourceResponse`
- [x] Update `DevAgentBackend` — POST handler starts loop, streams inline
- [x] Update frontend `SSEAgentEventSource` — POST with body instead of GET
- [x] Update frontend `AgentService` — pass config into SSEAgentRun
- [x] Remove `SSEAgentRun.resolveInput()` side-channel
- [x] Auth: access token from `Authorization` header → `Loop`
- [x] Wire `configureRemote()` in app init via `BACKEND_API_ENDPOINT`
- [x] Fix proxy `Content-Encoding` header stripping

##### 4.4e: Wire Content Runs Through AgentService ✅

> **🎯 Objective:** Run an opal through the dev backend and see the result.
>
> ```
> npm run dev:backend -w packages/unified-server
> ```
>
> Open the app, run an opal with a simple text task like "make a joke". The
> agent calls Gemini via the Python backend, streams events back, and the result
> appears in the UI.

- [x] `DEV_BACKEND_MODE` deploy-time flag (like `FAKE_MODE`)
- [x] `configureRemote()` gated on flag in `services.ts`
- [x] Early `instanceof SSEAgentRun` branch in `main.ts` → `invokeRemoteAgent()`
- [x] Lightweight `ConsoleProgressManager` for remote UI reporting
- [x] `complete` event carries `AgentResult.outcomes` (don't break on `finish`)
- [x] Tests: SSE event sequence, outcome extraction, error handling (11 tests)

##### 4.4f: Agent File System + System Functions

- [x] Port `AgentFileSystem` (in-memory virtual FS)
- [x] Port `TaskTreeManager` (task tree schema + status tracking)
- [x] Port `PidginTranslator.fromPidginString` (resolve `<file>` tags → data
      parts from FS — needed by `system_write_file` and `onSuccess` callback)
- [x] Port remaining system functions (list/read/write files, task tree)
- [x] Add `intermediate` / `FileData` to `AgentResult`
- [x] Wire file system + task tree into loop setup

#### 4.5: Wire Protocol + Objective Handling

> **Design:** Structured segments, not raw `LLMContent`. The client sends
> semantic intent; the server owns the entire pidgin vocabulary.
>
> `toPidgin` splits in two: the client resolves templates into typed segments
> (`text`, `asset`, `input`). The server walks segments, registers data parts in
> `AgentFileSystem`, and emits all pidgin tags. `pidgin.py` is the single source
> of truth for the pidgin language.
>
> Capabilities (`useMemory`, `useNotebookLM`) are discovered by the client
> during template resolution — they emerge from encountering template chips, not
> from runtime flags. Custom tools run on the server: the client sends board
> URLs, the server loads and invokes them.

- [x] Define segment types: `text` (literal), `asset` (titled content group),
      `input` (agent-output content group), `tool` (routes, memory, NLM, custom)
- [x] Client-side pre-resolution: `resolve-to-segments.ts` extracts template
      resolution from `toPidgin` into a step that runs before `startRun()`
- [x] Wire metadata: `flags.useNotebookLM` sideband; `useMemory`, routes, and
      custom tools discovered from `tool` segments server-side
- [x] Server-side `to_pidgin(segments)`: walk segments, register data parts in
      FS, emit `<asset>`, `<input>`, `<file>`, `<content>`, `<objective>` tags
- [x] Server-side `onSuccess` callback: `from_pidgin_string` (done ✅) +
      intermediate file collection (done ✅)
- [x] End-to-end: `npm run dev:backend` → frontend resolves segments → POST →
      `to_pidgin` → Loop → SSE stream back to browser

#### 4.6: Data Transform Plumbing

> The shared substrate: resolving `storedData`/`fileData` references to
> Gemini-consumable formats. All media generation and content functions depend
> on this.
>
> Key insight: the D2F (Drive → Gemini File) and B2F (Blob → Gemini File)
> transforms already go through _backend_ endpoints
> (`/v1beta1/uploadGeminiFile`, `/v1beta1/uploadBlobFile`). The dev backend
> proxies to the same One Platform server. The Python agent loop can call these
> endpoints directly.

- [x] `conform_body` on the server: `conform_body.py` walks `LLMContent` parts,
      resolves `storedData`/`fileData` to Gemini File API URLs via
      `/v1beta1/uploadGeminiFile` (HTTP calls to One Platform)
- [x] `json` parts → `{text: json.dumps()}` (inline transform)
- [x] `NotebookLM` storedData → `{text: url}` passthrough
- [x] `_upload_gemini_file` helper: authenticated POST to One Platform,
      `upstream_base` threaded from dev backend → `Loop.__init__`
- [x] Tests: 21 tests covering all 6 transforms, error handling, mixed content

#### 4.7: Function Groups

> With the wire protocol and data plumbing in place, function groups are thin
> handlers on top.

##### 4.7a: Text Generation

> **🎯 Objective:** Send an image into the agent and ask it to describe it. The
> image flows through segments → pidgin → `from_pidgin_string` → `conform_body`
> (resolves `storedData` to Gemini File API) → `generate_text` → text
> description streams back over SSE. Full multimodal pipeline end-to-end.

- [x] Port `generate_text` function (pidgin → conformBody → streamContent →
      merge text)
- [x] Grounding tools: Google Search, Google Maps, URL context
- [x] Wire `get_generate_function_group` into dev backend `main.py`
- [x] Tests: 20 tests — handler, grounding, model resolution, error handling

##### 4.7b: Image Generation

> **🎯 Objective:** Ask the agent to "generate an image of a cat" through the
> dev backend. The agent calls `generate_image` → `executeStep` with
> `ai_image_tool` → One Platform returns inline image data → saved to agent FS.

- [x] Port `executeStep` client (POST to `/v1beta1/executeStep`, collect output
      chunks)
- [x] Port `generate_image` function (prompt + optional input images + aspect
      ratio → `executeStep` → save to FS)
- [x] Wire into dev backend `main.py`
- [x] Tests

##### 4.7c: Video Generation

> **🎯 Objective:** Ask the agent to "make a short video of waves crashing." The
> agent calls `generate_video` → `executeStep` with Veo model → `storedData`
> part saved to agent FS.

- [x] Port `generate_video` function (prompt + optional reference images →
      `executeStep` with `generate_video` API + Veo model selection)
- [x] Port `expandVeoError` safety-code mapping
- [x] Wire into dev backend `main.py`
- [x] Tests

##### 4.7d: Speech Generation

> **🎯 Objective:** Ask the agent to "read this paragraph aloud." The agent
> calls `generate_speech_from_text` → `executeStep` → audio `storedData` saved
> to agent FS.

- [x] Port `generate_speech_from_text` function (text + voice selection →
      `executeStep` → save audio to FS)
- [x] Wire into dev backend `main.py`
- [x] Tests

##### 4.7e: Music Generation

> **🎯 Objective:** Ask the agent to "compose upbeat background music." The
> agent calls `generate_music_from_text` → `executeStep` → audio `storedData`
> saved to agent FS.

- [x] Port `generate_music_from_text` function (prompt → `executeStep` → save
      audio to FS)
- [x] Wire into dev backend `main.py`
- [x] Tests

##### 4.7f: Code Generation & Execution

> **🎯 Objective:** Ask the agent to "calculate the first 20 Fibonacci numbers."
> The agent calls `generate_and_execute_code` → `conformBody` → `streamContent`
> with `codeExecution` tool → streams text + inline file results back.

- [x] Port `generate_and_execute_code` function (prompt → `conformBody` →
      `streamContent` with code execution tool → merge text + file results)
- [x] Wire into dev backend `main.py`
- [x] Tests

#### 4.8: Suspend/Resume for Interactive Agents

> **🎯 Objective:** Open graph editor, use AI chat to edit a graph through the
> dev backend. Each interaction round-trips as: POST → stream → suspend → POST →
> stream → complete.
>
> **Design decision: reconnect, not keepalive.** The SSE stream closes when the
> loop suspends. The client POSTs again with `{interactionId, response}` to
> resume. This is the only viable approach — suspends can last seconds, hours,
> or days. A keepalive stream cannot stay open that long, and the production
> backend is stateless. The dev backend must match this model.

##### 4.8a: Suspend/Resume Protocol ✅

- [x] `SuspendError` + `SuspendResult` in `opal-backend-shared`
- [x] `InteractionStore` — in-memory state store keyed by `interactionId`
- [x] Loop catches `SuspendError`, returns `SuspendResult`
- [x] Dev backend: `_start()` / `_resume()` / `_stream_loop()` with state
      save/load
- [x] Client `SSEAgentEventSource`: reconnect loop — suspend → await handler →
      POST resume → new stream
- [x] Tests: 11 Python (suspend/resume round-trip) + TS reconnect test

##### 4.8b: Chat Suspend Functions

- [x] Port `chat_request_user_input` + `chat_present_choices` to Python (raises
      `SuspendError` with `waitForInput` / `waitForChoice`)
- [x] `waitForInput` handler in `invokeRemoteAgent` — prompt display + input
- [x] Loop: suppress `on_finish` on suspend, suppress `on_start` on resume
- [x] End-to-end: Generate step (Agent mode, prompt: "ask user to provide their
      name") through `dev:backend` — suspend → user types → resume → complete

##### 4.8c: Unified Suspend Handler Rendering

> **🎯 Objective:** Both `waitForInput` and `waitForChoice` work identically
> through local and remote paths. The rendering logic (prompt display, input
> collection, choice presentation) is shared — not duplicated between `AgentUI`
> and `invokeRemoteAgent`.

- [ ] Extract `#addChatOutput` pattern into a shared utility usable by both
      local (`AgentUI`) and remote (`invokeRemoteAgent`) paths
- [ ] `waitForInput` remote handler uses the shared utility (deduplicate)
- [ ] Design + implement `waitForChoice` remote handler with proper choice
      buttons / checkboxes (not enum dropdown hack)
- [ ] End-to-end: choice-based interaction through `dev:backend`

##### 4.8d: Graph-Editing Functions (deferred)

- [ ] Port graph-editing chat functions to Python (uses suspend protocol for
      `readGraph`, `applyEdits`, etc.)

#### 4.9: Production Readiness

> **🎯 Objective:** Full parity with the in-process agent. Everything that works
> locally works identically through the dev backend.

- [ ] `MemoryManager` + `StoredData`/`FileData` resolution in Python FS
- [ ] Status metadata plumbing — `expectedDurationInSec` from handlers → loop →
      SSE → frontend progress bar
- [ ] `url_context` consent flow — suspend for `queryConsent` before enabling
      `urlContext` tool (currently auto-approved in dev)
- [ ] Consolidate generate function groups — merge image, video, audio into one
      group with one instruction (matching TS `generate.ts`)
- [ ] State store for production (Redis/Firestore instead of in-memory)
- [ ] Reconnection — client re-POSTs with last interaction ID on drop
- [ ] Cancel concurrent function caller tasks on suspend — avoids benign "emit()
      called on closed sink: functionCallUpdate" warning
- [ ] Remove `LocalAgentRun` path (or keep for offline dev)
