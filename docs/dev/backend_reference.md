# Opal Backend Reference Documentation

---

## API Endpoints and Operations

### `POST /v1beta1/getG1SubscriptionStatus`
- **Description:** Fetches the status of the current user's Google One subscription membership.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/getG1Credits`
- **Description:** Fetches the user's available Google One credits balance.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/chatGenerateApp`
- **Description:** Calls the backend to generate/chat an application layout using flow generation models.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/generateOpalStream?alt=sse`
- **Description:** Streams a newly generated Opal application based on user intent.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/editOpalStream?alt=sse`
- **Description:** Edits an existing Opal graph layout by streaming revisions based on user feedback.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/rewriteOpalPromptStream?alt=sse`
- **Description:** Re-evaluates/rewrites an Opal prompt intent.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/checkAppAccess`
- **Description:** Validates user access levels and Terms of Service status for the app.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/acceptToS`
- **Description:** Acknowledges and saves acceptance of the application's Terms of Service.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/getEmailPreferences`
- **Description:** Retrieves notification preferences for standard system events.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/setEmailPreferences`
- **Description:** Updates standard email notification preferences.
- **Call Location:** [packages/visual-editor/src/ui/flow-gen/app-catalyst.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

### `POST /v1beta1/sessions/new`
- **Description:** Creates a new remote background AI agent execution session, returning a unique session ID.
- **Call Location:** [packages/visual-editor/src/a2/agent/sse-agent-event-source.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/agent/sse-agent-event-source.ts)

### `GET /v1beta1/sessions/{id}?alt=sse`
- **Description:** Connects to an ongoing AI agent session to stream back execution events via SSE.
- **Call Location:** [packages/visual-editor/src/a2/agent/sse-agent-event-source.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/agent/sse-agent-event-source.ts)

### `POST /v1beta1/sessions/{id}:resume`
- **Description:** Re-injects user interaction responses back into a suspended AI agent session so it can resume processing.
- **Call Location:** [packages/visual-editor/src/a2/agent/sse-agent-event-source.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/agent/sse-agent-event-source.ts)

### `POST /v1beta1/sessions/{id}:cancel`
- **Description:** Aborts a running AI agent background task on the backend.
- **Call Location:** [packages/visual-editor/src/a2/agent/sse-agent-event-source.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/agent/sse-agent-event-source.ts)

### `POST /v1beta1/streamRunAgent?alt=sse`
- **Description:** The legacy single-endpoint connection method for streaming an AI agent trace. Awaits suspension responses and repeatedly re-POSTs state to resume.
- **Call Location:** [packages/visual-editor/src/a2/agent/stream-run-agent-event-source.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/agent/stream-run-agent-event-source.ts)

### `POST /v1beta1/nlmRetrieveRelevantChunks`
- **Description:** Retrieves relevant context chunks from a specific NotebookLM notebook using semantic search queries on the Opal Backend.
- **Call Location:** [packages/visual-editor/src/sca/services/notebooklm-api-client.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/sca/services/notebooklm-api-client.ts)

### `POST /v1beta1/callMcpTool`
- **Description:** Dispatches execution of a Model Context Protocol (MCP) tool call via the Opal Backend proxy layer.
- **Call Location:** [packages/visual-editor/src/mcp/proxy-backed-client.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/mcp/proxy-backed-client.ts)

### `POST /v1beta1/listMcpTools`
- **Description:** Queries the Opal Backend proxy layer to retrieve and discover all remote MCP tools available.
- **Call Location:** [packages/visual-editor/src/mcp/proxy-backed-client.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/mcp/proxy-backed-client.ts)

### `POST /v1beta1/executeStep`
- **Description:** Executes an AI agent step or tool on the backend. Sends a structured request containing plan details and base64-encoded input contents.
- **Call Location:** [packages/visual-editor/src/a2/a2/step-executor.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/a2/step-executor.ts)

### `POST /v1beta1/generateWebpageStream?alt=sse`
- **Description:** Triggers streaming generation of a webpage (HTML output + thought reasoning). Uses Server-Sent Events (SSE) to stream the output back to the UI as it is generated.
- **Call Location:** [packages/visual-editor/src/a2/a2/generate-webpage-stream.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/a2/generate-webpage-stream.ts)

### `POST /v1beta1/executeAgentNodeStream?alt=sse`
- **Description:** Executes an Opal ADK agent node (e.g. `node-agent` or `deep_research`) and streams its execution trace, thoughts, and responses back to the visual editor as Server-Sent Events.
- **Call Location:** [packages/visual-editor/src/a2/a2/opal-adk-stream.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/a2/opal-adk-stream.ts)

### `POST /v1beta1/createCachedContent`
- **Description:** Calls the backend to create a Gemini cached content resource, passing the model, prompt contents, and tools as payload. Returns a cache resource name.
- **Call Location:** [packages/visual-editor/src/a2/a2/cached-content.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/a2/cached-content.ts)

### `POST /v1beta1/getSingletonPrefixCache`
- **Description:** Fetches a shared system-level Gemini cache resource from the backend based on feature configuration (e.g., Memory, Drive, or NotebookLM flags).
- **Call Location:** [packages/visual-editor/src/a2/a2/singleton-cache.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/a2/singleton-cache.ts)

### `POST /v1beta1/uploadGeminiFile`
- **Description:** Converts a Google Drive file or persistent blob into a Gemini file API reference by calling the backend's upload endpoint.
- **Call Location:** [packages/visual-editor/src/a2/a2/data-transforms.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/a2/data-transforms.ts)

### `POST /v1beta1/uploadBlobFile`
- **Description:** Converts a Google Drive file into a persistent blob storage reference hosted on the backend.
- **Call Location:** [packages/visual-editor/src/a2/a2/data-transforms.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/a2/a2/data-transforms.ts)

### `GET /v1beta1/getLocation`
- **Description:** Fetches the current user's geographic location (country code) to tailor available featured gallery graphs to their region.
- **Call Location:** [packages/visual-editor/src/board-server/gallery-graph-collection.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/board-server/gallery-graph-collection.ts)

---

## Appendix: Configuration and Definitions

### [canonical-endpoints.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/types/src/canonical-endpoints.ts)
- **Reference:** `OPAL_BACKEND_API_PREFIX = "https://appcatalyst.pa.googleapis.com"`
- **Description:** Hardcoded canonical prefix for the Opal Backend, used as a baseline for API calls.

### [fetch-allowlist.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/visual-editor/src/ui/utils/fetch-allowlist.ts)
- **Reference:** Remaps `OPAL_BACKEND_API_PREFIX` to `CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT`
- **Description:** Configures `checkFetchAllowlist` to intercept requests directed to the canonical `OPAL_BACKEND_API_PREFIX` and route them to the environment-specific endpoint defined by `BACKEND_API_ENDPOINT`. Also designates which endpoints should automatically have the user's access token appended to their JSON body.

### [gemini-endpoint.ts](https://github.com/breadboard-ai/breadboard/tree/main/packages/types/src/gemini-endpoint.ts)
- **Reference:** `geminiApiPrefix()` returns `${OPAL_BACKEND_API_PREFIX}/v1beta1/models`
- **Description:** A helper function providing the base URL for proxying Gemini model calls through the Opal Backend.
