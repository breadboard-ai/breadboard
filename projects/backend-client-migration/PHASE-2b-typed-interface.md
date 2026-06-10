# Phase 2b — Typed Interface

Replace the open-ended `sendHttpRequest(methodName: string, options)` with
per-RPC typed methods on `OpalBackendClient`. Each backend call becomes a named
method with a clear signature. `sendHttpRequest` becomes a private
implementation detail of `HttpBackendClient`.

## End State

- `OpalBackendClient` exposes ~28 typed methods, one per RPC endpoint.
- Each method takes a single `request` parameter with a named type (e.g.,
  `CheckAppAccessRequest`, `GenerateContentRequest`).
- `sendHttpRequest` is not part of the public interface.
- Callers interact with well-defined methods:

  ```ts
  // BEFORE:
  client.sendHttpRequest("checkAppAccess", { method: "GET" });
  client.sendHttpRequest("models/${model}:generateContent", {
    method: "POST",
    body,
  });

  // AFTER:
  client.checkAppAccess(request);
  client.generateContent(request);
  ```

- HTTP details (method, URL construction, query params, body serialization) are
  fully encapsulated inside each typed method.
- Request types are defined alongside `OpalBackendClient` in
  `packages/types/src/opal-backend-client.ts`, forming part of the shared type
  system.

## Key References

- **Skill reference:**
  [`.agent/skills/opal-backend-api/SKILL.md`](../../.agent/skills/opal-backend-api/SKILL.md)
- **Endpoint catalog:**
  [`docs/dev/backend_reference.md`](../../docs/dev/backend_reference.md)
- **Client interface:**
  [`packages/types/src/opal-backend-client.ts`](../../packages/types/src/opal-backend-client.ts)
- **Client implementation:**
  [`packages/visual-editor/src/ui/utils/http-backend-client.ts`](../../packages/visual-editor/src/ui/utils/http-backend-client.ts)
- **Phase 1 plan:** [`PHASE-1-flag-gating.md`](./PHASE-1-flag-gating.md)

## Relationship to Phase 2a

Phase 2b is independent of Phase 2a. Either can be done first.

- **If 2a runs first:** Flag gates are already collapsed. Call sites directly
  call `sendHttpRequest`. Phase 2b replaces those with typed methods.
- **If 2b runs first:** Call sites still have `ENABLE_BACKEND_CLIENT` flag
  gates. Phase 2b replaces `sendHttpRequest` calls inside the flag-on branches.
  The flag-off branches (`fetchWithCreds`) are unaffected. Phase 2a later
  removes the flag-off branches.

## Ordering Constraint

The `OpalBackendClient` interface is shared across multiple implementations.
**The interface must be updated first** (work item 2b.0) before any calling code
is changed. After the interface is updated and all implementations conform to
it, call site migration (2b.1–2b.9) can proceed.

---

## Interface Design

### Design Decisions

1. **Return type: `Promise<Response>`** — All methods return a raw `Response`.
   Callers continue to do `response.json()` or read `response.body` for SSE
   streams. This avoids defining response types for every endpoint and keeps the
   scope focused on encapsulating HTTP details. Typed return values (e.g.,
   `Promise<CheckAppAccessResponse>`) can be a future enhancement.

2. **Single `request` parameter with named types** — Every method takes a single
   parameter called `request`, typed with a named `<MethodName>Request` type
   (e.g., `CheckAppAccessRequest`, `GenerateContentRequest`). These types are
   defined in the same module as `OpalBackendClient`
   (`packages/types/src/opal-backend-client.ts`), forming part of the shared type
   system.

   The request types are **placeholders** (`unknown`) in the initial
   implementation. Work item 2b.R researches the actual body shapes at each call
   site and refines these types. Dynamic-path fields (model names, session IDs)
   and cancellation signals will also be captured in the request type.

3. **SSE streaming** — Streaming methods (those that used
   `query: { alt: "sse" }`) have the same return type (`Promise<Response>`). The
   `alt=sse` query param is an internal implementation detail. The method name
   already communicates that it's a streaming endpoint.

4. **`declare` keyword** — The existing interface uses
   `export declare interface` (required by Closure Compiler). New methods and
   types must follow this convention.

5. **Arrow function methods** — `HttpBackendClient` uses arrow function syntax
   for `sendHttpRequest`. New methods should follow the same pattern for
   consistency (this matters for Comlink serialization).

### Proposed Interface

The interface file is
[`packages/types/src/opal-backend-client.ts`](../../packages/types/src/opal-backend-client.ts).

The request types shown below are **placeholders** (`unknown`). Work item 2b.R
will research the actual types at each call site and refine them.

```ts
// --- Request types (placeholders — refined by 2b.R) ---

export type CheckAppAccessRequest = unknown;
export type GetLocationRequest = unknown;
export type GetG1SubscriptionStatusRequest = unknown;
export type GetG1CreditsRequest = unknown;
export type ChatGenerateAppRequest = unknown;
export type AcceptToSRequest = unknown;
export type GetEmailPreferencesRequest = unknown;
export type SetEmailPreferencesRequest = unknown;
export type CreateCachedContentRequest = unknown;
export type GetSingletonPrefixCacheRequest = unknown;
export type ExecuteStepRequest = unknown;
export type UploadGeminiFileRequest = unknown;
export type UploadBlobFileRequest = unknown;
export type CallMcpToolRequest = unknown;
export type ListMcpToolsRequest = unknown;
export type NlmRetrieveRelevantChunksRequest = unknown;
export type CreateSessionRequest = unknown;
export type CancelSessionRequest = unknown;
export type ResumeSessionRequest = unknown;
export type GenerateOpalStreamRequest = unknown;
export type EditOpalStreamRequest = unknown;
export type RewriteOpalPromptStreamRequest = unknown;
export type GenerateWebpageStreamRequest = unknown;
export type ExecuteAgentNodeStreamRequest = unknown;
export type StreamRunAgentRequest = unknown;
export type GetSessionStreamRequest = unknown;
export type GenerateContentRequest = unknown;
export type StreamGenerateContentRequest = unknown;

export declare interface OpalBackendClient {
  // --- GET endpoints ---

  /** Validates user access levels and Terms of Service status. */
  checkAppAccess(request: CheckAppAccessRequest): Promise<Response>;

  /** Fetches the user's geographic location (country code). */
  getLocation(request: GetLocationRequest): Promise<Response>;

  // --- Simple POST endpoints ---

  /** Fetches Google One subscription status. */
  getG1SubscriptionStatus(
    request: GetG1SubscriptionStatusRequest
  ): Promise<Response>;

  /** Fetches available Google One credits balance. */
  getG1Credits(request: GetG1CreditsRequest): Promise<Response>;

  /** Non-streaming chat/generate application layout. */
  chatGenerateApp(request: ChatGenerateAppRequest): Promise<Response>;

  /** Accepts Terms of Service. */
  acceptToS(request: AcceptToSRequest): Promise<Response>;

  /** Retrieves email notification preferences. */
  getEmailPreferences(request: GetEmailPreferencesRequest): Promise<Response>;

  /** Updates email notification preferences. */
  setEmailPreferences(request: SetEmailPreferencesRequest): Promise<Response>;

  /** Creates a Gemini cached content resource. */
  createCachedContent(request: CreateCachedContentRequest): Promise<Response>;

  /** Fetches a shared system-level Gemini cache resource. */
  getSingletonPrefixCache(
    request: GetSingletonPrefixCacheRequest
  ): Promise<Response>;

  /** Executes an AI agent step (media generation, etc.). */
  executeStep(request: ExecuteStepRequest): Promise<Response>;

  /** Uploads a Drive file as a Gemini file reference. */
  uploadGeminiFile(request: UploadGeminiFileRequest): Promise<Response>;

  /** Uploads a Drive file as a persistent blob reference. */
  uploadBlobFile(request: UploadBlobFileRequest): Promise<Response>;

  /** Dispatches an MCP tool call via the backend proxy. */
  callMcpTool(request: CallMcpToolRequest): Promise<Response>;

  /** Queries available remote MCP tools via the backend proxy. */
  listMcpTools(request: ListMcpToolsRequest): Promise<Response>;

  /** Retrieves relevant chunks from a NotebookLM notebook. */
  nlmRetrieveRelevantChunks(
    request: NlmRetrieveRelevantChunksRequest
  ): Promise<Response>;

  // --- Session endpoints (dynamic session ID) ---

  /** Creates a new agent session. RPC: `sessions/new`. */
  createSession(request: CreateSessionRequest): Promise<Response>;

  /** Cancels a running agent session. RPC: `sessions/${id}:cancel`. */
  cancelSession(request: CancelSessionRequest): Promise<Response>;

  /** Resumes a suspended agent session. RPC: `sessions/${id}:resume`. */
  resumeSession(request: ResumeSessionRequest): Promise<Response>;

  // --- SSE streaming POST endpoints ---

  /** Streams a newly generated Opal. */
  generateOpalStream(request: GenerateOpalStreamRequest): Promise<Response>;

  /** Streams edits to an existing Opal. */
  editOpalStream(request: EditOpalStreamRequest): Promise<Response>;

  /** Streams a rewritten Opal prompt. */
  rewriteOpalPromptStream(
    request: RewriteOpalPromptStreamRequest
  ): Promise<Response>;

  /** Streams webpage generation (HTML + thought trace). */
  generateWebpageStream(
    request: GenerateWebpageStreamRequest
  ): Promise<Response>;

  /** Streams ADK agent node execution trace. */
  executeAgentNodeStream(
    request: ExecuteAgentNodeStreamRequest
  ): Promise<Response>;

  /** Streams legacy agent execution trace. */
  streamRunAgent(request: StreamRunAgentRequest): Promise<Response>;

  // --- SSE streaming GET endpoint ---

  /**
   * Connects to an agent session SSE stream. RPC: `sessions/${id}?alt=sse`.
   */
  getSessionStream(request: GetSessionStreamRequest): Promise<Response>;

  // --- Gemini model endpoints (dynamic model name) ---

  /**
   * Non-streaming Gemini inference. RPC: `models/${model}:generateContent`.
   */
  generateContent(request: GenerateContentRequest): Promise<Response>;

  /**
   * Streaming Gemini inference. RPC: `models/${model}:streamGenerateContent`.
   */
  streamGenerateContent(
    request: StreamGenerateContentRequest
  ): Promise<Response>;
}
```

**Total: 28 typed methods.**

### `HttpBackendClient` Implementation Pattern

Each typed method delegates to the private `#sendHttpRequest`. The request type
is destructured inside the method to extract the fields needed for the HTTP call.

Until 2b.R refines the request types, use `unknown` and cast/destructure as
needed.

```ts
class HttpBackendClient implements OpalBackendClient {
  // Becomes private — no longer on the public interface.
  #sendHttpRequest = async (
    methodName: string,
    options: OpalBackendRequestOptions
  ): Promise<Response> => {
    // ... existing implementation unchanged ...
  };

  // Example: simple GET (request carries signal only, initially)
  checkAppAccess = async (
    request: CheckAppAccessRequest
  ): Promise<Response> => {
    return this.#sendHttpRequest("checkAppAccess", { method: "GET" });
  };

  // Example: simple POST
  acceptToS = async (request: AcceptToSRequest): Promise<Response> => {
    return this.#sendHttpRequest("acceptToS", {
      method: "POST",
      body: request,
    });
  };

  // Example: SSE streaming POST
  generateOpalStream = async (
    request: GenerateOpalStreamRequest
  ): Promise<Response> => {
    return this.#sendHttpRequest("generateOpalStream", {
      method: "POST",
      body: request,
      query: { alt: "sse" },
    });
  };

  // Example: dynamic path (once typed, request includes `model`)
  generateContent = async (
    request: GenerateContentRequest
  ): Promise<Response> => {
    // After 2b.R: const { model, ...body } = request;
    return this.#sendHttpRequest(
      `models/${(request as any).model}:generateContent`,
      { method: "POST", body: request }
    );
  };
}
```

**Arrow function syntax is required** — `HttpBackendClient` methods are passed
over Comlink (`postMessage`), which requires them to be bound to the instance.
Arrow functions in class fields achieve this automatically.

> **Note:** The implementation examples above use casts and partial
> destructuring as temporary scaffolding. Once 2b.R refines the request types,
> each method will cleanly destructure the fields it needs (e.g., `model`,
> `sessionId`, `signal`) from the typed request.

---

## Work Items

### 2b.R — Research request types

**Scope:** Research only — no code changes.

Audit every `sendHttpRequest` call site to determine the concrete body shape,
dynamic path fields, and signal usage for each RPC method. Produce a typed
request interface for each method.

For each of the 28 methods, determine:

1. **Body shape** — what object is passed as `body`? Capture the existing type
   (if named) or define a new one from the literal shape at the call site.
2. **Dynamic path fields** — for methods like `generateContent` and
   `cancelSession`, capture the path parameter (model name, session ID) as a
   required field on the request type.
3. **Signal usage** — does the call site pass an `AbortSignal`? If so, include
   `signal?: AbortSignal` on the request type.
4. **Other fields** — e.g., `getSessionStream` uses an `after` cursor.

The output of this task is a set of refined type definitions to replace the
placeholder `unknown` types. Example:

```ts
export declare interface GenerateContentRequest {
  model: string;
  body: GeminiBody;  // from gemini.ts
  signal?: AbortSignal;
}

export declare interface CancelSessionRequest {
  sessionId: string;
  signal?: AbortSignal;
}

export declare interface CheckAppAccessRequest {
  signal?: AbortSignal;
}
```

All types should be defined in
[`packages/types/src/opal-backend-client.ts`](../../packages/types/src/opal-backend-client.ts)
using `export declare interface` (or `export type` for simple aliases).

---

### 2b.0 — Add typed methods to interface and implementation

**Scope:** Purely additive. No call sites change. `sendHttpRequest` remains on
the interface temporarily.

**The interface must be updated first.** The `OpalBackendClient` interface is
shared across multiple implementations. Update the interface, then update all
implementations to conform, before changing any calling code.

**Files to change:**

1. [`packages/types/src/opal-backend-client.ts`](../../packages/types/src/opal-backend-client.ts)
   — Add all 28 typed method declarations and request type definitions to
   `OpalBackendClient`. Keep `sendHttpRequest` for now.

2. [`packages/visual-editor/src/ui/utils/http-backend-client.ts`](../../packages/visual-editor/src/ui/utils/http-backend-client.ts)
   — Implement all 28 typed methods on `HttpBackendClient`, each delegating to
   the existing `sendHttpRequest` (still public at this point).

**Verification:** `npm run build` must compile. No tests should break since no
call sites changed.

**Note on `OpalBackendRequestOptions`:** This type is currently exported from
the interface file. After `sendHttpRequest` is removed from the public
interface, `OpalBackendRequestOptions` can also be removed from the public
exports (it becomes an internal implementation type). Do this in the final step
(2b.F), not here.

---

### 2b.1–2b.9 — Migrate call sites

Each work item migrates one file's `sendHttpRequest` calls to typed method
calls. These are independent and can be done in any order.

#### Migration Pattern

```ts
// BEFORE:
const client = await this.#backendClientPromise;
const response = await client.sendHttpRequest("checkAppAccess", {
  method: "GET",
});

// AFTER:
const client = await this.#backendClientPromise;
const response = await client.checkAppAccess({});
```

For methods with bodies:

```ts
// BEFORE:
response = await client.sendHttpRequest("acceptToS", {
  method: "POST",
  body: { termsOfServiceVersion, acceptTos },
});

// AFTER:
response = await client.acceptToS({ termsOfServiceVersion, acceptTos });
```

For methods with dynamic paths (after 2b.R refines types):

```ts
// BEFORE:
response = await client.sendHttpRequest(`models/${model}:generateContent`, {
  method: "POST",
  body: conformedBody,
  signal,
});

// AFTER:
response = await client.generateContent({ model, body: conformedBody, signal });
```

---

#### 2b.1 — `app-catalyst.ts`

**File:**
[`packages/visual-editor/src/ui/flow-gen/app-catalyst.ts`](../../packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

**8 call sites → 8 typed method calls:**

| `sendHttpRequest` call                            | Typed method                    |
| ------------------------------------------------- | ------------------------------- |
| `sendHttpRequest("getG1SubscriptionStatus", ...)` | `getG1SubscriptionStatus(request)` |
| `sendHttpRequest("getG1Credits", ...)`            | `getG1Credits(request)`            |
| `sendHttpRequest("chatGenerateApp", ...)`         | `chatGenerateApp(request)`         |
| `sendHttpRequest("checkAppAccess", ...)`          | `checkAppAccess(request)`          |
| `sendHttpRequest("acceptToS", ...)`               | `acceptToS(request)`               |
| `sendHttpRequest("getEmailPreferences", ...)`     | `getEmailPreferences(request)`     |
| `sendHttpRequest("setEmailPreferences", ...)`     | `setEmailPreferences(request)`     |
| `sendHttpRequest(endpoint, ...)` in `chatStream`  | See below                          |

**`chatStream` refactoring:** The `chatStream` method currently takes an
`endpoint` parameter of type
`"generateOpalStream" | "editOpalStream" | "rewriteOpalPromptStream"` and passes
it to `sendHttpRequest(endpoint, ...)`. With typed methods, this dynamic
dispatch needs to change. Two approaches:

**Option A — switch dispatch:**

```ts
let response: Response;
switch (endpoint) {
  case "generateOpalStream":
    response = await client.generateOpalStream(request);
    break;
  case "editOpalStream":
    response = await client.editOpalStream(request);
    break;
  case "rewriteOpalPromptStream":
    response = await client.rewriteOpalPromptStream(request);
    break;
}
```

**Option B — inline into callers:** Remove the `endpoint` parameter from
`chatStream`. Have each wrapper method (`generateOpalStream()`,
`editOpalStream()`, etc. on `AppCatalystApiClient`) call the appropriate
`backendClient` method directly, then pass the `Response` to a shared
`#processStreamResponse()` helper.

Option B is cleaner and removes the string-dispatch pattern entirely.

---

#### 2b.2 — `gemini.ts`

**File:**
[`packages/visual-editor/src/a2/a2/gemini.ts`](../../packages/visual-editor/src/a2/a2/gemini.ts)

**3 call sites → 2 typed methods:**

| `sendHttpRequest` call                                                                 | Typed method                                 |
| -------------------------------------------------------------------------------------- | -------------------------------------------- |
| `sendHttpRequest(\`models/${model}:generateContent\`, ...)`(in`callAPI` ~L596)         | `generateContent(request)`       |
| `sendHttpRequest(\`models/${model}:generateContent\`, ...)`(in`generateContent` ~L870) | `generateContent(request)`       |
| `sendHttpRequest(\`models/${model}:streamGenerateContent\`, ...)` (~L945)              | `streamGenerateContent(request)` |

The model name is already a local variable at each call site. It becomes a field
on the request object.

---

#### 2b.3 — `sse-agent-event-source.ts`

**File:**
[`packages/visual-editor/src/a2/agent/sse-agent-event-source.ts`](../../packages/visual-editor/src/a2/agent/sse-agent-event-source.ts)

**4 call sites → 4 typed methods:**

| `sendHttpRequest` call                                    | Typed method                              |
| --------------------------------------------------------- | ----------------------------------------- |
| `sendHttpRequest(\`sessions/${id}:cancel\`, ...)` (~L90)  | `cancelSession(request)`   |
| `sendHttpRequest("sessions/new", ...)` (~L122)            | `createSession(request)`   |
| `sendHttpRequest(\`sessions/${id}\`, ...)` (~L164)        | `getSessionStream(request)` |
| `sendHttpRequest(\`sessions/${id}:resume\`, ...)` (~L232) | `resumeSession(request)`   |

The session ID is already a local variable (`this.#sessionId`). It becomes a
field on the request object. The `after` cursor for `getSessionStream` is
already constructed from `this.#lastEventId`.

---

#### 2b.4 — `data-transforms.ts`

**File:**
[`packages/visual-editor/src/a2/a2/data-transforms.ts`](../../packages/visual-editor/src/a2/a2/data-transforms.ts)

**1 call site in `callBackend` helper → 2 typed methods:**

The `callBackend` generic helper currently strips `/v1beta1/` from an endpoint
string and calls `sendHttpRequest(methodName, ...)`. With typed methods, this
helper can no longer dispatch by string.

**Recommended approach:** Remove or simplify `callBackend`. Have each caller
invoke the appropriate typed method directly:

```ts
// driveFileToGeminiFile / blobToGeminiFile:
const response = await backendClient.uploadGeminiFile(request);

// driveFileToBlob:
const response = await backendClient.uploadBlobFile(request);
```

Extract the shared error handling / `Outcome` wrapping into a simpler helper
that takes a `Promise<Response>` rather than an endpoint string.

---

#### 2b.5 — `cached-content.ts`

**File:**
[`packages/visual-editor/src/a2/a2/cached-content.ts`](../../packages/visual-editor/src/a2/a2/cached-content.ts)

**1 call site:**

| `sendHttpRequest` call                               | Typed method                        |
| ---------------------------------------------------- | ----------------------------------- |
| `sendHttpRequest("createCachedContent", ...)` (~L66) | `createCachedContent(request)` |

---

#### 2b.6 — `singleton-cache.ts`, `step-executor.ts`

**Files:**

- [`singleton-cache.ts`](../../packages/visual-editor/src/a2/a2/singleton-cache.ts)
  — 1 call site → `getSingletonPrefixCache(request)`
- [`step-executor.ts`](../../packages/visual-editor/src/a2/a2/step-executor.ts)
  — 1 call site → `executeStep(request)`

---

#### 2b.7 — `generate-webpage-stream.ts`, `opal-adk-stream.ts`

**Files:**

- [`generate-webpage-stream.ts`](../../packages/visual-editor/src/a2/a2/generate-webpage-stream.ts)
  — 1 call site → `generateWebpageStream(request)`
- [`opal-adk-stream.ts`](../../packages/visual-editor/src/a2/a2/opal-adk-stream.ts)
  — 1 call site → `executeAgentNodeStream(request)`

---

#### 2b.8 — `stream-run-agent-event-source.ts`

**File:**
[`packages/visual-editor/src/a2/agent/stream-run-agent-event-source.ts`](../../packages/visual-editor/src/a2/agent/stream-run-agent-event-source.ts)

**1 call site:**

| `sendHttpRequest` call                          | Typed method                   |
| ----------------------------------------------- | ------------------------------ |
| `sendHttpRequest("streamRunAgent", ...)` (~L94) | `streamRunAgent(request)` |

---

#### 2b.9 — `proxy-backed-client.ts`, `notebooklm-api-client.ts`, `gallery-graph-collection.ts`

**Files:**

- [`proxy-backed-client.ts`](../../packages/visual-editor/src/mcp/proxy-backed-client.ts)
  — The `#call` helper currently strips `/v1beta1/` and calls `sendHttpRequest`.
  Replace with direct typed method calls:
  - `callTool()` → `backendClient.callMcpTool(request)`
  - `listTools()` → `backendClient.listMcpTools(request)`
  - The `#call` helper can be removed or simplified.

- [`notebooklm-api-client.ts`](../../packages/visual-editor/src/sca/services/notebooklm-api-client.ts)
  — 1 call site: `sendHttpRequest("nlmRetrieveRelevantChunks", ...)` →
  `nlmRetrieveRelevantChunks(request)`.

- [`gallery-graph-collection.ts`](../../packages/visual-editor/src/board-server/gallery-graph-collection.ts)
  — 1 call site: `sendHttpRequest("getLocation", ...)` → `getLocation(request)`.

---

### 2b.F — Remove `sendHttpRequest` from the public interface

**Depends on:** All call site migrations (2b.1–2b.9) complete.

**Files to change:**

1. [`packages/types/src/opal-backend-client.ts`](../../packages/types/src/opal-backend-client.ts)
   — Remove `sendHttpRequest` from the `OpalBackendClient` interface. Also
   remove `OpalBackendRequestOptions` from the public exports (it becomes an
   internal type).

2. [`packages/visual-editor/src/ui/utils/http-backend-client.ts`](../../packages/visual-editor/src/ui/utils/http-backend-client.ts)
   — Change `sendHttpRequest` from a public method to a private field
   (`#sendHttpRequest`). Move `OpalBackendRequestOptions` import to a local type
   or inline it.

**Verification:** `npm run build` must compile. Any remaining reference to
`sendHttpRequest` or `OpalBackendRequestOptions` outside of
`http-backend-client.ts` will be a compile error.

---

### 2b.T — Update tests

For each test file that mocks `OpalBackendClient`, update the mock to use typed
methods instead of `sendHttpRequest`:

```ts
// BEFORE:
const backendClientMock = {
  sendHttpRequest: mock.fn(async () => new Response(JSON.stringify({...}))),
};

// AFTER:
const backendClientMock = {
  checkAppAccess: mock.fn(async () => new Response(JSON.stringify({...}))),
  // ... only the methods the test actually calls
} as unknown as OpalBackendClient;
```

**Test files to update** (same 9 files as Phase 2a, plus any tests for
`proxy-backed-client.ts` and `notebooklm-api-client.ts`):

1. `tests/app-catalyst.test.ts`
2. `tests/a2/cached-content.test.ts`
3. `tests/a2/data-transforms.test.ts`
4. `tests/a2/gemini.test.ts`
5. `tests/a2/generate-webpage-stream.test.ts`
6. `tests/a2/opal-adk-stream.test.ts`
7. `tests/a2/singleton-cache.test.ts`
8. `tests/a2/step-executor.test.ts`
9. `tests/agent/stream-run-agent-event-source.test.ts`
10. `tests/agent/sse-agent-event-source.test.ts` (805 lines, 4 endpoints)

Additionally, add tests for `HttpBackendClient` itself to verify that each typed
method correctly delegates to `#sendHttpRequest` with the right method name,
HTTP method, query params, and body.

---

### 2b.D — Update documentation

1. **`docs/dev/backend_reference.md`** — Update examples to show typed method
   calls instead of `sendHttpRequest`.

2. **`.agent/skills/opal-backend-api/SKILL.md`** — Update the "Migrating an
   endpoint" section to show the typed method pattern. New endpoints should be
   added as typed methods directly.

3. **`packages/types/src/opal-backend-client.ts`** — Ensure JSDoc on each method
   is clear and matches `backend_reference.md`.

---

## Verification

1. `npm run build` — must compile cleanly.
2. `npm run test` in `packages/visual-editor` — all tests pass.
3. `grep -r "sendHttpRequest" packages/` — should only appear inside
   `http-backend-client.ts` (the private implementation).
4. Verify that `OpalBackendRequestOptions` is not exported from
   `packages/types`.

---

## Progress Tracker

| Work Item | Scope                                                                                                        | Status |
| --------- | ------------------------------------------------------------------------------------------------------------ | ------ |
| 2b.R      | Research request types (define `<MethodName>Request` for all 28 methods)                                     |        |
| 2b.0      | Add typed methods to interface + implementation (interface first)                                             |        |
| 2b.1      | Migrate `app-catalyst.ts` (8 call sites)                                                                     |        |
| 2b.2      | Migrate `gemini.ts` (3 call sites)                                                                           |        |
| 2b.3      | Migrate `sse-agent-event-source.ts` (4 call sites)                                                           |        |
| 2b.4      | Migrate `data-transforms.ts` (1 call site)                                                                   |        |
| 2b.5      | Migrate `cached-content.ts` (1 call site)                                                                    |        |
| 2b.6      | Migrate `singleton-cache.ts` + `step-executor.ts` (2 call sites)                                             |        |
| 2b.7      | Migrate `generate-webpage-stream.ts` + `opal-adk-stream.ts` (2 call sites)                                   |        |
| 2b.8      | Migrate `stream-run-agent-event-source.ts` (1 call site)                                                     |        |
| 2b.9      | Migrate `proxy-backed-client.ts` + `notebooklm-api-client.ts` + `gallery-graph-collection.ts` (4 call sites) |        |
| 2b.F      | Remove `sendHttpRequest` from public interface                                                               |        |
| 2b.T      | Update tests                                                                                                 |        |
| 2b.D      | Update documentation                                                                                         |        |
