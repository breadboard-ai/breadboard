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

## Prerequisite: Comlink Boundary Verification

> **Before starting implementation**, verify that `AsyncIterable<T>` can cross
> the Comlink host→guest boundary. The `OpalBackendClient` is instantiated on
> the host side and provided to the guest via Comlink through
> `getOpalBackendClient()`. If `AsyncIterable` (backed by a `ReadableStream`)
> cannot be transferred, this design will need to be revisited — streaming
> methods may need to live on the guest side only, or the interface may need to
> be split into sync + streaming portions.
>
> This must be tested with a concrete prototype before committing to the typed
> interface design.

---

## Interface Design

### Design Decisions

1. **Typed return values — no raw HTTP types.** Methods return the concrete
   domain type that callers actually need, not `Response`. The client handles
   `.ok` checking, `.json()` parsing, and `.body` extraction internally. Callers
   never see `Response`, `ReadableStream`, or any HTTP primitive.
   - Non-streaming methods return `Promise<T>` where `T` is the JSON response
     type (e.g., `Promise<CheckAppAccessResponse>`).
   - Void methods (no response body needed) return `Promise<void>`.
   - Streaming methods return `Promise<AsyncIterable<T>>` where `T` is the
     parsed SSE chunk type.

2. **Single `request` parameter with named types.** Every method takes a single
   parameter called `request`, typed with a named `<MethodName>Request`
   interface. These types are defined in
   `packages/types/src/opal-backend-client.ts`. All request types include an
   optional `signal?: AbortSignal` field. Dynamic-path fields (`model`,
   `sessionId`) are top-level required fields on the request.

3. **Error handling: throw on non-OK.** The client checks `response.ok` and
   throws a plain `Error` with the status code and body text in the message. No
   streaming caller branches on the HTTP status code — all existing sites just
   interpolate the status into an error message. A plain `Error` is sufficient;
   no structured `BackendError` type is needed.

   For callers with special error handling (e.g., `gemini.ts` retry logic that
   classifies status codes), the retry logic stays in the caller. The client
   method does one shot: HTTP call → check ok → return parsed result. The caller
   wraps it in its own retry loop with try/catch.

4. **SSE internals encapsulated.** The `alt=sse` query param, SSE line parsing
   (`iteratorFromStream`), and body-existence checks are implementation details
   of `HttpBackendClient`. Callers see only `AsyncIterable<T>`.

5. **SessionEnvelope filtered internally.** The `getSessionStream` method
   filters out protocol envelope events (`{sessionId}` start markers and `{}`
   done markers) and returns a clean `AsyncIterable<AgentEvent>`. The caller in
   `sse-agent-event-source.ts` currently skips these unconditionally.

6. **`declare` keyword.** The existing interface uses `export declare interface`
   (required by Closure Compiler). New methods and types follow this convention.

7. **Arrow function methods.** `HttpBackendClient` uses arrow function syntax
   for methods (required for Comlink serialization via `postMessage`).

---

### Proposed Interface

The interface file is
[`packages/types/src/opal-backend-client.ts`](../../packages/types/src/opal-backend-client.ts).

#### Request Types

```ts
// --- Common ---

/** Base fields shared by all requests. */
export declare interface BaseRequest {
  signal?: AbortSignal;
}

// --- app-catalyst.ts ---

export declare interface CheckAppAccessRequest extends BaseRequest {}

export declare interface GetG1SubscriptionStatusRequest extends BaseRequest {
  include_credit_data: boolean;
}

export declare interface GetG1CreditsRequest extends BaseRequest {}

export declare interface ChatGenerateAppRequest extends BaseRequest {
  messages: AppCatalystContentChunk[];
  appOptions: {
    format: "FORMAT_GEMINI_FLOWS";
    featureFlags?: Record<string, boolean>;
  };
}

export declare interface AcceptToSRequest extends BaseRequest {
  termsOfServiceVersion: number;
  acceptTos: boolean;
}

export declare interface GetEmailPreferencesRequest extends BaseRequest {
  preferenceKeys: readonly string[];
}

export declare interface SetEmailPreferencesRequest extends BaseRequest {
  preferenceEntries: EmailPreference[];
}

export declare interface GenerateOpalStreamRequest extends BaseRequest {
  intent: string;
  appOptions: {
    format: "FORMAT_GEMINI_FLOWS";
    featureFlags?: Record<string, boolean>;
  };
}

export declare interface EditOpalStreamRequest extends BaseRequest {
  reviseIntent: string;
  appOptions: {
    format: "FORMAT_GEMINI_FLOWS";
    featureFlags?: Record<string, boolean>;
  };
  app?: { parts: FlowGenLLMContentPart[] };
}

export declare interface RewriteOpalPromptStreamRequest extends BaseRequest {
  intent?: string;
  appOptions: {
    format: "FORMAT_GEMINI_FLOWS";
    featureFlags?: Record<string, boolean>;
  };
}

// --- A2 execution ---

export declare interface ExecuteStepRequest extends BaseRequest {
  planStep: PlanStep;
  execution_inputs: ContentMap;
  enableG1Quota?: boolean;
}

export declare interface CreateCachedContentRequest extends BaseRequest {
  cachedContent: {
    model: string;
    contents: GeminiBody["contents"];
    tools?: GeminiBody["tools"];
    toolConfig?: GeminiBody["toolConfig"];
    systemInstruction?: GeminiBody["systemInstruction"];
  };
}

export declare interface GetSingletonPrefixCacheRequest extends BaseRequest {
  useMemory: boolean;
  useNotebookLM: boolean;
  useGoogleDrive: boolean;
}

export declare type UploadGeminiFileRequest = BaseRequest &
  ({ driveFileId: string; driveResourceKey?: string } | { blobId: string });

export declare interface UploadBlobFileRequest extends BaseRequest {
  driveFileId: string;
}

export declare interface GenerateWebpageStreamRequest extends BaseRequest {
  body: WebpageStreamingRequestBody;
}

export declare interface ExecuteAgentNodeStreamRequest extends BaseRequest {
  body: AdkStreamingRequestBody;
}

// --- Gemini model endpoints ---

export declare interface GenerateContentRequest extends BaseRequest {
  model: string;
  body: GeminiBody;
}

export declare interface StreamGenerateContentRequest extends BaseRequest {
  model: string;
  body: GeminiBody;
}

// --- MCP ---

export declare interface CallMcpToolRequest extends BaseRequest {
  mcpServerConfig: {
    streamableHttp: {
      url: string;
      headers?: Record<string, string>;
    };
  };
  functionCall: {
    id: string;
    name: string;
    args: Record<string, unknown>;
  };
}

export declare interface ListMcpToolsRequest extends BaseRequest {
  mcpServerConfig: {
    streamableHttp: {
      url: string;
      headers?: Record<string, string>;
    };
  };
}

// --- NotebookLM ---

export declare interface NlmRetrieveRelevantChunksRequest extends BaseRequest {
  /** Notebook resource name, e.g. "notebooks/{id}". */
  name: string;
  /** The query to search for relevant chunks. */
  query: string;
  /** Optional token budget for context. */
  contextTokenBudget?: number;
}

// --- Agent sessions ---

export declare interface CreateSessionRequest extends BaseRequest {
  body: Record<string, unknown>; // session config (kind stripped by caller)
}

export declare interface CancelSessionRequest extends BaseRequest {
  sessionId: string;
}

export declare interface ResumeSessionRequest extends BaseRequest {
  sessionId: string;
  body: Record<string, unknown>; // user response payload
}

export declare interface StreamRunAgentRequest extends BaseRequest {
  body: Record<string, unknown>; // start config or resume payload
}

export declare interface GetSessionStreamRequest extends BaseRequest {
  sessionId: string;
  after?: number; // event cursor for reconnection
}

// --- Location ---

export declare interface GetLocationRequest extends BaseRequest {}
```

#### Response Types

Most response types already exist in their respective source files. They need to
be moved to (or re-exported from) `packages/types` so the interface can
reference them. Types marked "→ move" need migration; types marked "→ exists"
are already in `packages/types`.

```ts
// --- app-catalyst responses ---

/** → move from app-catalyst.ts L48–57 */
export type CheckAppAccessResponse =
  | {
      canAccess: false;
      accessStatus: string;
      termsOfService?: { version: number; terms: string };
    }
  | { canAccess: true; accessStatus: string };

/** → move from app-catalyst.ts L39–42 */
export declare interface G1SubscriptionStatusResponse {
  isMember: boolean;
  remainingCredits: number;
}

/** → move from app-catalyst.ts L44–46 */
export declare interface G1CreditsResponse {
  remainingCredits: number;
}

/** → move from app-catalyst.ts L31–33 */
export declare interface ChatGenerateAppResponse {
  messages: AppCatalystContentChunk[];
}

/** → move from app-catalyst.ts L92–94 */
export declare interface GetEmailPreferencesResponse {
  preferenceResponses?: EmailPreference[];
}

// --- A2 execution responses ---

/** → move from step-executor.ts L89–93 */
export declare interface ExecuteStepResponse {
  executionOutputs: ContentMap;
  errorMessage?: string;
  quotaMetadata?: QuotaMetadata;
}

/** → move from cached-content.ts L30–33 */
export declare interface CreateCachedContentResponse {
  cachedContent: CachedContent & { name: string };
  errorMessage?: string;
}

/** → move from singleton-cache.ts L23–26 */
export declare interface SingletonPrefixCacheResponse {
  cachedContent?: { name: string };
  errorMessage?: string;
}

/** → move from data-transforms.ts L62–65 */
export declare interface UploadGeminiFileResponse {
  fileUrl: string;
  mimeType: string;
}

/** → move from data-transforms.ts L46–49 */
export declare interface UploadBlobFileResponse {
  blobId: string;
  mimeType: string;
}

// --- MCP responses ---

/** → exists in @breadboard-ai/types */
// FunctionResponseCapabilityPart — already in packages/types

/** → move from proxy-backed-client.ts L36–42 */
export declare interface ListMcpToolsResponse {
  functionDeclarations: {
    name: string;
    description: string;
    parameters: unknown;
  }[];
}

// --- NotebookLM responses ---

/** → move from notebooklm-api-client.ts L271–273 */
export declare interface NlmRetrieveRelevantChunksResponse {
  sourceContexts: SourceContext[];
}

// --- Session responses ---

export declare interface CreateSessionResponse {
  sessionId: string;
}

// --- Location responses ---

export declare interface GetLocationResponse {
  countryCode: string;
}

// --- Gemini responses ---

/** → move from gemini.ts L305–309 */
export declare interface GeminiAPIOutputs {
  candidates: Candidate[];
  usageMetadata?: UsageMetadata;
  errorMessage?: string;
}

// --- Streaming chunk types ---

/** → move from generate-webpage-stream.ts L40–48 */
export declare interface WebpageStreamChunk {
  parts?: Array<{
    text?: string;
    partMetadata?: { chunk_type?: string };
  }>;
  role?: string;
}

/** → move from opal-adk-stream.ts L31–53 */
export declare interface AdkStreamChunk {
  chunk?: {
    parts?: Array<{
      text?: string;
      partMetadata?: { chunk_type?: string };
      part_metadata?: { chunk_type?: string };
    }>;
  };
  parts?: Array<{
    text?: string;
    partMetadata?: { chunk_type?: string };
    part_metadata?: { chunk_type?: string };
  }>;
  role?: string;
}

// AgentEvent — → move from agent-event.ts (complex oneof union type)
```

#### The Interface

```ts
export declare interface OpalBackendClient {
  // -----------------------------------------------------------------------
  // Non-streaming GET endpoints
  // -----------------------------------------------------------------------

  /** Validates user access levels and Terms of Service status. */
  checkAppAccess(
    request: CheckAppAccessRequest
  ): Promise<CheckAppAccessResponse>;

  /** Fetches the user's geographic location (country code). */
  getLocation(request: GetLocationRequest): Promise<GetLocationResponse>;

  // -----------------------------------------------------------------------
  // Non-streaming POST endpoints — return parsed JSON
  // -----------------------------------------------------------------------

  /** Fetches Google One subscription status. */
  getG1SubscriptionStatus(
    request: GetG1SubscriptionStatusRequest
  ): Promise<G1SubscriptionStatusResponse>;

  /** Fetches available Google One credits balance. */
  getG1Credits(request: GetG1CreditsRequest): Promise<G1CreditsResponse>;

  /** Non-streaming chat/generate application layout. */
  chatGenerateApp(
    request: ChatGenerateAppRequest
  ): Promise<ChatGenerateAppResponse>;

  /** Retrieves email notification preferences. */
  getEmailPreferences(
    request: GetEmailPreferencesRequest
  ): Promise<GetEmailPreferencesResponse>;

  /** Creates a Gemini cached content resource. */
  createCachedContent(
    request: CreateCachedContentRequest
  ): Promise<CreateCachedContentResponse>;

  /** Fetches a shared system-level Gemini cache resource. */
  getSingletonPrefixCache(
    request: GetSingletonPrefixCacheRequest
  ): Promise<SingletonPrefixCacheResponse>;

  /** Executes an AI agent step (media generation, etc.). */
  executeStep(request: ExecuteStepRequest): Promise<ExecuteStepResponse>;

  /** Uploads a Drive file as a Gemini file reference. */
  uploadGeminiFile(
    request: UploadGeminiFileRequest
  ): Promise<UploadGeminiFileResponse>;

  /** Uploads a Drive file as a persistent blob reference. */
  uploadBlobFile(
    request: UploadBlobFileRequest
  ): Promise<UploadBlobFileResponse>;

  /** Dispatches an MCP tool call via the backend proxy. */
  callMcpTool(
    request: CallMcpToolRequest
  ): Promise<FunctionResponseCapabilityPart>;

  /** Queries available remote MCP tools via the backend proxy. */
  listMcpTools(request: ListMcpToolsRequest): Promise<ListMcpToolsResponse>;

  /** Retrieves relevant chunks from a NotebookLM notebook. */
  nlmRetrieveRelevantChunks(
    request: NlmRetrieveRelevantChunksRequest
  ): Promise<NlmRetrieveRelevantChunksResponse>;

  // -----------------------------------------------------------------------
  // Non-streaming POST endpoints — void (only .ok check, no body read)
  // -----------------------------------------------------------------------

  /** Accepts Terms of Service. */
  acceptToS(request: AcceptToSRequest): Promise<void>;

  /** Updates email notification preferences. */
  setEmailPreferences(request: SetEmailPreferencesRequest): Promise<void>;

  // -----------------------------------------------------------------------
  // Session management — non-streaming
  // -----------------------------------------------------------------------

  /** Creates a new agent session. Returns the session ID. */
  createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;

  /** Cancels a running agent session. Fire-and-forget. */
  cancelSession(request: CancelSessionRequest): Promise<void>;

  /** Resumes a suspended agent session. */
  resumeSession(request: ResumeSessionRequest): Promise<void>;

  // -----------------------------------------------------------------------
  // Gemini model endpoints — non-streaming
  // -----------------------------------------------------------------------

  /**
   * Non-streaming Gemini inference.
   * RPC: `models/${model}:generateContent`.
   *
   * Note: callers (callAPI, generateContent in gemini.ts) wrap this in
   * their own retry loops. The client does one shot.
   */
  generateContent(request: GenerateContentRequest): Promise<GeminiAPIOutputs>;

  // -----------------------------------------------------------------------
  // SSE streaming endpoints — return AsyncIterable<T>
  //
  // The client handles: HTTP status check, body existence check,
  // SSE parsing (iteratorFromStream), and query: { alt: "sse" }.
  // Callers get a clean typed stream.
  // -----------------------------------------------------------------------

  /** Streams a newly generated Opal. Chunk type: LLMContent. */
  generateOpalStream(
    request: GenerateOpalStreamRequest
  ): Promise<AsyncIterable<LLMContent>>;

  /** Streams edits to an existing Opal. Chunk type: LLMContent. */
  editOpalStream(
    request: EditOpalStreamRequest
  ): Promise<AsyncIterable<LLMContent>>;

  /** Streams a rewritten Opal prompt. Chunk type: LLMContent. */
  rewriteOpalPromptStream(
    request: RewriteOpalPromptStreamRequest
  ): Promise<AsyncIterable<LLMContent>>;

  /** Streams webpage generation (HTML + thought trace). */
  generateWebpageStream(
    request: GenerateWebpageStreamRequest
  ): Promise<AsyncIterable<WebpageStreamChunk>>;

  /** Streams ADK agent node execution trace. */
  executeAgentNodeStream(
    request: ExecuteAgentNodeStreamRequest
  ): Promise<AsyncIterable<AdkStreamChunk>>;

  /** Streams legacy agent execution trace. */
  streamRunAgent(
    request: StreamRunAgentRequest
  ): Promise<AsyncIterable<AgentEvent>>;

  /**
   * Connects to an agent session SSE stream.
   * RPC: `sessions/${id}?alt=sse`.
   *
   * SessionEnvelope events ({sessionId} start markers and {} done markers)
   * are filtered internally — callers receive only AgentEvent objects.
   */
  getSessionStream(
    request: GetSessionStreamRequest
  ): Promise<AsyncIterable<AgentEvent>>;

  /**
   * Streaming Gemini inference.
   * RPC: `models/${model}:streamGenerateContent`.
   *
   * Note: the peek-and-retry logic in gemini.ts stays in the caller.
   * The client returns the raw stream; the caller uses
   * [Symbol.asyncIterator]().next() to peek at the first chunk.
   */
  streamGenerateContent(
    request: StreamGenerateContentRequest
  ): Promise<AsyncIterable<GeminiAPIOutputs>>;
}
```

**Total: 28 typed methods.**

---

### `HttpBackendClient` Implementation Patterns

All methods delegate to the private `#sendHttpRequest` (which remains unchanged
internally). Three patterns cover all 28 methods:

#### Pattern 1 — Non-streaming with JSON response

Covers: `checkAppAccess`, `getLocation`, `getG1SubscriptionStatus`,
`getG1Credits`, `chatGenerateApp`, `getEmailPreferences`, `createCachedContent`,
`getSingletonPrefixCache`, `executeStep`, `uploadGeminiFile`, `uploadBlobFile`,
`callMcpTool`, `listMcpTools`, `nlmRetrieveRelevantChunks`, `createSession`,
`generateContent`.

```ts
checkAppAccess = async (
  request: CheckAppAccessRequest
): Promise<CheckAppAccessResponse> => {
  const response = await this.#sendHttpRequest("checkAppAccess", {
    method: "GET",
    signal: request.signal,
  });
  if (!response.ok) {
    throw new Error(
      `checkAppAccess failed: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as CheckAppAccessResponse;
};

// Dynamic path example:
generateContent = async (
  request: GenerateContentRequest
): Promise<GeminiAPIOutputs> => {
  const response = await this.#sendHttpRequest(
    `models/${request.model}:generateContent`,
    { method: "POST", body: request.body, signal: request.signal }
  );
  if (!response.ok) {
    throw new Error(
      `generateContent failed: ${response.status} ${await response.text()}`
    );
  }
  return (await response.json()) as GeminiAPIOutputs;
};
```

#### Pattern 2 — Non-streaming void (only .ok check)

Covers: `acceptToS`, `setEmailPreferences`, `cancelSession`, `resumeSession`.

```ts
acceptToS = async (request: AcceptToSRequest): Promise<void> => {
  const { signal, ...body } = request;
  const response = await this.#sendHttpRequest("acceptToS", {
    method: "POST",
    body,
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `acceptToS failed: ${response.status} ${response.statusText}`
    );
  }
};

// Dynamic path + fire-and-forget example:
cancelSession = async (request: CancelSessionRequest): Promise<void> => {
  const response = await this.#sendHttpRequest(
    `sessions/${request.sessionId}:cancel`,
    { method: "POST", signal: request.signal }
  );
  if (!response.ok) {
    throw new Error(
      `cancelSession failed: ${response.status} ${response.statusText}`
    );
  }
};
```

#### Pattern 3 — SSE streaming (return AsyncIterable)

Covers: `generateOpalStream`, `editOpalStream`, `rewriteOpalPromptStream`,
`generateWebpageStream`, `executeAgentNodeStream`, `streamRunAgent`,
`getSessionStream`, `streamGenerateContent`.

```ts
generateOpalStream = async (
  request: GenerateOpalStreamRequest
): Promise<AsyncIterable<LLMContent>> => {
  const { signal, ...body } = request;
  const response = await this.#sendHttpRequest("generateOpalStream", {
    method: "POST",
    body,
    query: { alt: "sse" },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `generateOpalStream failed: ${response.status} ${response.statusText}`
    );
  }
  if (!response.body) {
    throw new Error("No response body from streaming API");
  }
  return iteratorFromStream<LLMContent>(response.body);
};

// SessionEnvelope-filtering example:
getSessionStream = async (
  request: GetSessionStreamRequest
): Promise<AsyncIterable<AgentEvent>> => {
  const query: Record<string, string> = { alt: "sse" };
  if (request.after !== undefined && request.after >= 0) {
    query.after = String(request.after);
  }
  const response = await this.#sendHttpRequest(
    `sessions/${request.sessionId}`,
    { method: "GET", query, signal: request.signal }
  );
  if (!response.ok) {
    throw new Error(
      `getSessionStream failed: ${response.status} ${response.statusText}`
    );
  }
  if (!response.body) {
    throw new Error("SSE response has no body");
  }
  // Filter out session protocol envelope events.
  const raw = iteratorFromStream<AgentEvent | SessionEnvelope>(response.body);
  return {
    async *[Symbol.asyncIterator]() {
      for await (const event of raw) {
        if (!isSessionEnvelope(event)) {
          yield event as AgentEvent;
        }
      }
    },
  };
};
```

**Arrow function syntax is required** — `HttpBackendClient` methods are passed
over Comlink (`postMessage`), which requires them to be bound to the instance.

---

### Type Migration

The `OpalBackendClient` interface lives in `packages/types`. All types
referenced in method signatures must also be accessible from `packages/types`
(to avoid circular dependencies between `packages/types` and
`packages/visual-editor`).

**Types already in `packages/types`:** `LLMContent`,
`FunctionResponseCapabilityPart`.

**Types that need to move to `packages/types`:**

#### Response types

| Type                                | Current location                                          | Notes                                    |
| ----------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| `CheckAppAccessResponse`            | `app-catalyst.ts` L48–57                                  | Leaf type — no deps                      |
| `G1SubscriptionStatusResponse`      | `app-catalyst.ts` L39–42                                  | Leaf type                                |
| `G1CreditsResponse`                 | `app-catalyst.ts` L44–46                                  | Leaf type                                |
| `ChatGenerateAppResponse`           | `app-catalyst.ts` L31–33                                  | Depends on `AppCatalystContentChunk`     |
| `GetEmailPreferencesResponse`       | `app-catalyst.ts` L92–94                                  | Depends on `EmailPreference`             |
| `ExecuteStepResponse`               | `step-executor.ts` L89–93                                 | Depends on `ContentMap`, `QuotaMetadata` |
| `CreateCachedContentResponse`       | `cached-content.ts` L30–33                                | Depends on `CachedContent` (local)       |
| `SingletonPrefixCacheResponse`      | `singleton-cache.ts` L23–26                               | Leaf type                                |
| `UploadGeminiFileResponse`          | `data-transforms.ts` L62–65                               | Leaf type                                |
| `UploadBlobFileResponse`            | `data-transforms.ts` L46–49                               | Leaf type                                |
| `ListMcpToolsResponse`              | `proxy-backed-client.ts` L36–42                           | Leaf type                                |
| `NlmRetrieveRelevantChunksResponse` | `notebooklm-api-client.ts` L271–273                       | Depends on `SourceContext` → deep tree   |
| `GeminiAPIOutputs`                  | `gemini.ts` L305–309                                      | Depends on `Candidate`, `UsageMetadata`  |
| `GetLocationResponse`               | new type (inline at gallery-graph-collection.ts L139–141) | `{ countryCode: string }` — define fresh |
| `CreateSessionResponse`             | new type (inline at sse-agent-event-source.ts L143)       | `{ sessionId: string }` — define fresh   |

#### Request-side types

| Type                          | Current location                    | Notes                                                           |
| ----------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| `AppCatalystContentChunk`     | `app-catalyst.ts` L59–62            | `{ mimetype: "text/plain" \| "text/breadboard"; data: string }` |
| `EmailPreference`             | `app-catalyst.ts` L79–84            | + enums `NotifyPreference`, `NotifyConsentState`                |
| `FlowGenLLMContentPart`       | `flow-generator.ts`                 | Used by `EditOpalStreamRequest`                                 |
| `PlanStep`                    | `step-executor.ts` L55–69           | Fields: `stepName`, `modelApi`, etc.                            |
| `ContentMap`                  | `step-executor.ts` L51–53           | `{ [key: string]: Content }`, + `Content`, `Chunk`              |
| `QuotaMetadata`               | `step-executor.ts` L83–87           | Leaf type                                                       |
| `GeminiBody`                  | `gemini.ts` L150–158                | Large sub-type tree — `contents`, `tools`, `toolConfig`, etc.   |
| `WebpageStreamingRequestBody` | `generate-webpage-stream.ts` L57–65 | + `StreamingRequestPart`                                        |
| `AdkStreamingRequestBody`     | `opal-adk-stream.ts` L95–113        | + `StreamingRequestPart` (ADK variant)                          |

#### Streaming chunk types

| Type                 | Current location                    | Notes                                              |
| -------------------- | ----------------------------------- | -------------------------------------------------- |
| `WebpageStreamChunk` | `generate-webpage-stream.ts` L40–48 | Leaf type                                          |
| `AdkStreamChunk`     | `opal-adk-stream.ts` L31–53         | Leaf type                                          |
| `AgentEvent`         | `agent-event.ts`                    | Complex oneof union + all payload types            |
| `SessionEnvelope`    | `sse-agent-event-source.ts` L262    | Internal to `HttpBackendClient` — no export needed |

#### Migration strategy

1. **Start with leaf types** — types with no dependencies (e.g.,
   `G1SubscriptionStatusResponse`, `UploadBlobFileResponse`, `QuotaMetadata`).
   These can be moved to `packages/types` with zero friction.

2. **Then types with shallow deps** — types that depend on one or two other
   types (e.g., `ChatGenerateAppResponse` → `AppCatalystContentChunk`). Move the
   dependency first, then the dependent type.

3. **Defer deep trees** — `GeminiBody`, `AgentEvent`, and
   `NlmRetrieveRelevantChunksResponse` have large sub-type dependency trees.
   These should be tackled last, potentially using the `export type` re-export
   pattern to avoid breaking downstream imports during the transition.

4. **Use `export type` re-exports** — When a type is moved from its original
   file to `packages/types`, leave behind a re-export in the original file:
   ```ts
   export type { ExecuteStepResponse } from "@breadboard-ai/types";
   ```
   This ensures existing imports keep working during the incremental migration.

---

## Work Items

### 2b.R — Research request types ✅ COMPLETE

All 28 methods now have concrete request types with fully specified field
definitions. See the **Proposed Interface → Request Types** section above.

**Summary of findings:**

- 8 request types are simple (empty body or 1–2 fields): `CheckAppAccess`,
  `GetLocation`, `GetG1Credits`, `AcceptToS`, `CancelSession`, `ResumeSession`,
  `GetSessionStream`, `GetG1SubscriptionStatus`.
- 9 request types have medium complexity (3–6 fields): `ChatGenerateApp`,
  `GetEmailPreferences`, `SetEmailPreferences`, `GenerateOpalStream`,
  `EditOpalStream`, `RewriteOpalPromptStream`, `GetSingletonPrefixCache`,
  `UploadBlobFile`, `NlmRetrieveRelevantChunks`.
- 7 request types reference existing domain types: `ExecuteStep` (→ `PlanStep`,
  `ContentMap`), `CreateCachedContent` (→ `GeminiBody`), `GenerateContent` /
  `StreamGenerateContent` (→ `GeminiBody`), `GenerateWebpageStream` (→
  `WebpageStreamingRequestBody`), `ExecuteAgentNodeStream` (→
  `AdkStreamingRequestBody`).
- 3 request types have composite structures: `CallMcpTool` (mcpServerConfig +
  functionCall), `ListMcpTools` (mcpServerConfig), `UploadGeminiFile` (union
  type: driveFileId | blobId).
- 1 request type (`StreamRunAgent`, `CreateSession`) uses
  `Record<string, unknown>` because the caller constructs the payload
  dynamically from session config.

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

The caller-side migration has two dimensions: (a) replacing `sendHttpRequest`
with the typed method, and (b) removing the HTTP handling code that the client
now does internally.

**Non-streaming JSON endpoint:**

```ts
// BEFORE:
const client = await this.#backendClientPromise;
const response = await client.sendHttpRequest("checkAppAccess", {
  method: "GET",
});
const result = (await response.json()) as CheckAppAccessResponse;

// AFTER — client does .ok check + .json() + cast internally:
const client = await this.#backendClientPromise;
const result = await client.checkAppAccess({});
```

**Void endpoint (only .ok check):**

```ts
// BEFORE:
response = await client.sendHttpRequest("acceptToS", {
  method: "POST",
  body: { termsOfServiceVersion, acceptTos },
});
if (!response.ok) {
  throw new Error(`Failed to accept TOS: ${response.statusText}`);
}

// AFTER — client throws on non-OK internally:
await client.acceptToS({ termsOfServiceVersion, acceptTos });
```

**Dynamic path endpoint:**

```ts
// BEFORE:
response = await client.sendHttpRequest(`models/${model}:generateContent`, {
  method: "POST",
  body: conformedBody,
  signal,
});
if (!response.ok) {
  throw new Error(`...failed: ${response.status} ${await response.text()}`);
}
const outputs = (await response.json()) as GeminiAPIOutputs;

// AFTER — model becomes a request field:
const outputs = await client.generateContent({
  model,
  body: conformedBody,
  signal,
});
```

**SSE streaming endpoint:**

```ts
// BEFORE:
response = await client.sendHttpRequest("generateOpalStream", {
  method: "POST",
  body: request,
  query: { alt: "sse" },
});
if (!response.ok || !response.body) {
  throw new Error(`Failed to start stream: ${response.statusText}`);
}
yield * iteratorFromStream<LLMContent>(response.body);

// AFTER — client does .ok check, body check, iteratorFromStream internally:
const stream = await client.generateOpalStream({ intent, appOptions });
yield * stream;
```

---

#### 2b.1 — `app-catalyst.ts`

**File:**
[`packages/visual-editor/src/ui/flow-gen/app-catalyst.ts`](../../packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

**8 call sites → 8 typed method calls:**

| `sendHttpRequest` call                            | Typed method                       |
| ------------------------------------------------- | ---------------------------------- |
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
it to `sendHttpRequest(endpoint, ...)`. With typed methods that return
`AsyncIterable<LLMContent>`, this shared method becomes unnecessary.

**Recommended: eliminate `chatStream` entirely.** Each wrapper method calls the
typed client method directly:

```ts
// BEFORE — shared chatStream with dynamic dispatch:
async *generateOpalStream(intent: string): AsyncGenerator<LLMContent> {
  const request = { intent, appOptions: { ... } };
  yield* this.chatStream(request, "generateOpalStream");
}

async *chatStream(request, endpoint): AsyncGenerator<LLMContent> {
  response = await client.sendHttpRequest(endpoint, { ... });
  yield* iteratorFromStream<LLMContent>(response.body);
}

// AFTER — direct typed call, no shared method needed:
async *generateOpalStream(intent: string): AsyncGenerator<LLMContent> {
  const client = await this.#backendClientPromise;
  const stream = await client.generateOpalStream({
    intent,
    appOptions: { format: "FORMAT_GEMINI_FLOWS", featureFlags: { ... } },
  });
  yield* stream;
}
```

This removes the string-dispatch pattern and the `iteratorFromStream` import
from `app-catalyst.ts`.

---

#### 2b.2 — `gemini.ts`

**File:**
[`packages/visual-editor/src/a2/a2/gemini.ts`](../../packages/visual-editor/src/a2/a2/gemini.ts)

**3 call sites → 2 typed methods:**

| `sendHttpRequest` call                                                                 | Typed method                     |
| -------------------------------------------------------------------------------------- | -------------------------------- |
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

| `sendHttpRequest` call                                    | Typed method                |
| --------------------------------------------------------- | --------------------------- |
| `sendHttpRequest(\`sessions/${id}:cancel\`, ...)` (~L90)  | `cancelSession(request)`    |
| `sendHttpRequest("sessions/new", ...)` (~L122)            | `createSession(request)`    |
| `sendHttpRequest(\`sessions/${id}\`, ...)` (~L164)        | `getSessionStream(request)` |
| `sendHttpRequest(\`sessions/${id}:resume\`, ...)` (~L232) | `resumeSession(request)`    |

The session ID is already a local variable (`this.#sessionId`). It becomes a
field on the request object. The `after` cursor for `getSessionStream` is
already constructed from `this.#lastEventId`.

**Key simplification for `getSessionStream`:** The caller currently does:

```ts
const events = iteratorFromStream<AgentEvent | SessionEnvelope>(response.body);
for await (const event of events) {
  if (isSessionEnvelope(event)) continue;
  // ... process AgentEvent
}
```

After migration, the `SessionEnvelope` filtering is internal to the client:

```ts
const events = await client.getSessionStream({ sessionId, after });
for await (const event of events) {
  // ... process AgentEvent directly — no envelope filtering needed
}
```

This removes the `iteratorFromStream`, `isSessionEnvelope`, and
`SessionEnvelope` imports from the file.

---

#### 2b.4 — `data-transforms.ts`

**File:**
[`packages/visual-editor/src/a2/a2/data-transforms.ts`](../../packages/visual-editor/src/a2/a2/data-transforms.ts)

**1 call site in `callBackend` helper → 2 typed methods:**

The `callBackend` generic helper currently strips `/v1beta1/` from an endpoint
string and calls `sendHttpRequest(methodName, ...)`. With typed methods, this
helper can no longer dispatch by string.

**Recommended approach:** Remove `callBackend` entirely. Have each caller invoke
the typed method directly. Since typed methods now throw on non-OK responses and
return parsed JSON, the shared error handling collapses to a try/catch:

```ts
// BEFORE — shared callBackend with string dispatch:
const response: Outcome<UploadGeminiFileResponse> = await callBackend(
  moduleArgs,
  request,
  BACKEND_UPLOAD_GEMINI_FILE_ENDPOINT
);

// AFTER — direct typed call:
try {
  const client = await moduleArgs.backendClient;
  const response = await client.uploadGeminiFile(request);
  return response; // already typed as UploadGeminiFileResponse
} catch (e) {
  return err(formatAgentError(e));
}
```

The `Outcome` wrapping moves to the individual callers' try/catch blocks.

---

#### 2b.5 — `cached-content.ts`

**File:**
[`packages/visual-editor/src/a2/a2/cached-content.ts`](../../packages/visual-editor/src/a2/a2/cached-content.ts)

**1 call site:**

| `sendHttpRequest` call                               | Typed method                   |
| ---------------------------------------------------- | ------------------------------ |
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

| `sendHttpRequest` call                          | Typed method              |
| ----------------------------------------------- | ------------------------- |
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
methods instead of `sendHttpRequest`. Since methods now return typed values (not
`Response`), mocks become simpler:

```ts
// BEFORE:
const backendClientMock = {
  sendHttpRequest: mock.fn(async () => new Response(JSON.stringify({...}))),
};

// AFTER — mock returns the typed value directly:
const backendClientMock = {
  checkAppAccess: mock.fn(async () => ({ canAccess: true, accessStatus: "OK" })),
  // ... only the methods the test actually calls
} as unknown as OpalBackendClient;

// AFTER — streaming mock returns AsyncIterable:
const backendClientMock = {
  generateOpalStream: mock.fn(async () => (async function* () {
    yield { parts: [{ text: "chunk1" }], role: "model" };
  })()),
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
| 2b.R      | Research request types (define `<MethodName>Request` for all 28 methods)                                     | ✅     |
| 2b.0      | Add typed methods to interface + implementation (interface first)                                            |        |
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
