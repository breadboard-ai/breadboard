# Phase 2a — Dead Code Removal

Make `ENABLE_BACKEND_CLIENT` permanent: collapse every flag-gated `if/else` to
the `OpalBackendClient` path only, remove the `fetchWithCreds` fallback branches
for backend calls, and delete the flag.

## End State

- No application code calls `fetchWithCreds` with a backend URL.
  `HttpBackendClient` continues to wrap `fetchWithCreds` internally as an
  implementation detail — that is unaffected.
- The `ENABLE_BACKEND_CLIENT` flag no longer exists.
- `OPAL_BACKEND_API_PREFIX` (and its companion `geminiApiPrefix()`) are removed
  from the codebase. This constant is a hard-coded canonical URL that gets
  remapped to `BACKEND_API_ENDPOINT` by the fetch-allowlist — its value is
  functionally meaningless and leaks an internal service name into this
  open-source frontend. After all direct `fetchWithCreds` backend calls are
  removed, `HttpBackendClient` is the sole consumer of this prefix. It can be
  refactored to use `BACKEND_API_ENDPOINT` directly (from
  `CLIENT_DEPLOYMENT_CONFIG`), eliminating the prefix and the allowlist's
  remapping entry.
- Third-party `fetchWithCreds` calls (Google Drive, Docs, Sheets, Calendar,
  NotebookLM Partner API, etc.) are completely unaffected.

## Prerequisites

Before starting this phase, the `ENABLE_BACKEND_CLIENT` flag must be verified
across all environments. This phase collapses the fallback paths — once merged,
there is no rollback to `fetchWithCreds` for backend calls.

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

## Verification Invariant

Every change must satisfy: **zero change to application behavior.** The only
path that was executing (the `ENABLE_BACKEND_CLIENT = true` path) is the path
that remains. The removed code was already unreachable.

---

## Work Items

### 2a.0 — Migrate the `theme-utils.ts` straggler

**File:**
[`packages/visual-editor/src/sca/actions/theme/theme-utils.ts`](../../packages/visual-editor/src/sca/actions/theme/theme-utils.ts)

This file calls `fetchWithCreds(endpointURL(IMAGE_GENERATOR), ...)` where
`endpointURL` constructs `${geminiApiPrefix()}/${model}:generateContent`. This
is an Opal Backend call that was missed during Phase 1 — it has no
`ENABLE_BACKEND_CLIENT` flag gate.

**What to do:**

- Plumb `backendClient` to where `theme-utils.ts` can access it. This is an SCA
  action, so it accesses dependencies via the module-level `bind` object. The
  action's service or controller binding needs to provide `backendClient`.
- Replace the `fetchWithCreds` call with
  `backendClient.sendHttpRequest(\`models/${model}:generateContent\`, { method:
  "POST", body, signal })`.
- Since the flag is being removed in this phase, do **not** add a flag gate —
  migrate directly to `sendHttpRequest`.
- Add tests for the new code path.
- Update `backend_reference.md` if this endpoint is not already listed.

---

### 2a.1 — Collapse flag gates (10 files)

For each file below, apply the same mechanical transformation:

1. Remove the `if (CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT)` check.
2. Keep only the body of the `if` branch (the `sendHttpRequest` path).
3. Remove the `else` branch (the `fetchWithCreds` path).
4. Remove the `CLIENT_DEPLOYMENT_CONFIG` import if no longer used.
5. Remove the `OPAL_BACKEND_API_PREFIX` import if no longer used (it was only
   needed for URL construction in the `fetchWithCreds` path).

**The pattern:**

```ts
// BEFORE:
let response: Response;
if (CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT) {
  const client = await this.#backendClientPromise;
  response = await client.sendHttpRequest("methodName", {
    method: "POST",
    body: bodyObject,
  });
} else {
  response = await this.#fetchWithCreds(
    new URL("v1beta1/methodName", this.#apiBaseUrl),
    { method: "POST", body: JSON.stringify(bodyObject) }
  );
}

// AFTER:
const client = await this.#backendClientPromise;
const response = await client.sendHttpRequest("methodName", {
  method: "POST",
  body: bodyObject,
});
```

#### Files and gate counts

| #   | File                                                                                                             | Flag gates | Notes                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| 1   | [`app-catalyst.ts`](../../packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)                                | 8          | Largest file. `chatStream` has a shared gate for 3 SSE endpoints.                      |
| 2   | [`gemini.ts`](../../packages/visual-editor/src/a2/a2/gemini.ts)                                                  | 3          | `callAPI` (~L594), `generateContent` (~L868), `streamGenerateContent` (~L943).         |
| 3   | [`sse-agent-event-source.ts`](../../packages/visual-editor/src/a2/agent/sse-agent-event-source.ts)               | 4          | `cancel` (~L88), `#createSession` (~L120), `#streamEvents` (~L160), `#resume` (~L230). |
| 4   | [`data-transforms.ts`](../../packages/visual-editor/src/a2/a2/data-transforms.ts)                                | 1          | Inside `callBackend` helper (~L208). Covers `uploadGeminiFile` and `uploadBlobFile`.   |
| 5   | [`cached-content.ts`](../../packages/visual-editor/src/a2/a2/cached-content.ts)                                  | 1          | ~L64                                                                                   |
| 6   | [`singleton-cache.ts`](../../packages/visual-editor/src/a2/a2/singleton-cache.ts)                                | 1          | ~L47                                                                                   |
| 7   | [`step-executor.ts`](../../packages/visual-editor/src/a2/a2/step-executor.ts)                                    | 1          | ~L248                                                                                  |
| 8   | [`generate-webpage-stream.ts`](../../packages/visual-editor/src/a2/a2/generate-webpage-stream.ts)                | 1          | ~L221                                                                                  |
| 9   | [`opal-adk-stream.ts`](../../packages/visual-editor/src/a2/a2/opal-adk-stream.ts)                                | 1          | ~L288                                                                                  |
| 10  | [`stream-run-agent-event-source.ts`](../../packages/visual-editor/src/a2/agent/stream-run-agent-event-source.ts) | 1          | ~L92                                                                                   |
| 11  | [`gallery-graph-collection.ts`](../../packages/visual-editor/src/board-server/gallery-graph-collection.ts)       | 1          | ~L123                                                                                  |

**Already migrated (no flag gate, no changes needed):**

- [`proxy-backed-client.ts`](../../packages/visual-editor/src/mcp/proxy-backed-client.ts)
  — uses `sendHttpRequest` exclusively.
- [`notebooklm-api-client.ts`](../../packages/visual-editor/src/sca/services/notebooklm-api-client.ts)
  — the one backend call (`nlmRetrieveRelevantChunks`) uses `sendHttpRequest`
  exclusively. The other 5 methods in this file call the NotebookLM Partner API
  via `fetchWithCreds` — those are third-party calls and stay unchanged.

---

### 2a.2 — Remove `fetchWithCreds` backend plumbing

After collapsing the flag gates, many classes and functions still accept
`fetchWithCreds` as a parameter even though they no longer use it for backend
calls. Remove it where it is no longer needed.

**Audit each consumer.** Some consumers use `fetchWithCreds` for **both**
backend and third-party calls. Only remove `fetchWithCreds` from consumers that
used it **exclusively** for backend calls (now removed). Consumers with
third-party usages keep it.

#### `A2ModuleArgs` / `A2ModuleFactoryArgs`

**File:**
[`packages/visual-editor/src/a2/runnable-module-factory.ts`](../../packages/visual-editor/src/a2/runnable-module-factory.ts)

```ts
export type A2ModuleFactoryArgs = {
  // ...
  fetchWithCreds: typeof globalThis.fetch; // ← REMOVE
  backendClient: Promise<OpalBackendClient>;
  // ...
};
```

`fetchWithCreds` on these types is used **only for backend calls** (confirmed by
audit — Google Drive calls go through `googleDriveClient`, not
`fetchWithCreds`). Remove `fetchWithCreds` from both `A2ModuleFactoryArgs` and
`A2ModuleArgs`.

After removing, use `npm run build` to find all compile errors. Fix each site
that was passing `fetchWithCreds` into these args — remove the field from the
construction site.

#### Event source constructors

Both event source classes take `fetchWithCreds` as a constructor parameter:

- [`sse-agent-event-source.ts`](../../packages/visual-editor/src/a2/agent/sse-agent-event-source.ts)
  — constructor param `fetchWithCreds: typeof fetch` (L40)
- [`stream-run-agent-event-source.ts`](../../packages/visual-editor/src/a2/agent/stream-run-agent-event-source.ts)
  — constructor param `fetchWithCreds: typeof fetch` (L38)

After 2a.1 collapses the flag gates, `fetchWithCreds` is no longer used in
either class. Remove the constructor param. Also make `backendClient` required
(currently optional `?`).

#### `sse-agent-run.ts` pass-through

**File:**
[`packages/visual-editor/src/a2/agent/sse-agent-run.ts`](../../packages/visual-editor/src/a2/agent/sse-agent-run.ts)

This file passes `fetchWithCreds` positionally to both event source constructors
(~L68, L85, L93). After removing the param from the constructors, update these
call sites.

#### `gallery-graph-collection.ts` constructor

**File:**
[`packages/visual-editor/src/board-server/gallery-graph-collection.ts`](../../packages/visual-editor/src/board-server/gallery-graph-collection.ts)

Constructor takes `fetchWithCreds` — only used in the `else` branch of the flag
gate (now removed). Remove from constructor.

#### `app-catalyst.ts` constructor

**File:**
[`packages/visual-editor/src/ui/flow-gen/app-catalyst.ts`](../../packages/visual-editor/src/ui/flow-gen/app-catalyst.ts)

The `AppCatalystApiClient` constructor takes both `fetchWithCreds` and
`backendClient`. After 2a.1, `fetchWithCreds` is no longer used. Remove from
constructor.

#### `services.ts` wiring

**File:**
[`packages/visual-editor/src/sca/services/services.ts`](../../packages/visual-editor/src/sca/services/services.ts)

This is the central wiring point. After removing `fetchWithCreds` from the
consumers above, update the construction sites in `services()`. Stop passing
`fetchWithCreds` to consumers that no longer need it.

**Consumers that still need `fetchWithCreds`** (third-party calls):

- `GoogleDriveClient` — Google Drive API
- `McpClientManager` — MCP Google/Calendar APIs
- `AgentContext` — audit; may pass it downstream
- `NotebookLmApiClient` — NotebookLM Partner API (5 methods)
- `GraphRunService` — audit; may pass it downstream
- `AppServices` interface — exposes `fetchWithCreds` for consumers

**Key principle:** Use the compiler. Remove `fetchWithCreds` from a type/param,
build, and let TypeScript surface every site that needs updating. Do not try to
enumerate all sites manually.

---

### 2a.3 — Remove the `ENABLE_BACKEND_CLIENT` flag

After all flag gates are collapsed and all tests updated, remove the flag from
its 3 definition sites:

1. **Type definition:**
   [`packages/types/src/deployment-configuration.ts`](../../packages/types/src/deployment-configuration.ts)
   — remove `ENABLE_BACKEND_CLIENT: boolean` from
   `ClientDeploymentConfiguration`.

2. **Server-side flag read:**
   [`packages/unified-server/src/flags.ts`](../../packages/unified-server/src/flags.ts)
   (~L43) — remove
   `export const ENABLE_BACKEND_CLIENT = getBoolean("ENABLE_BACKEND_CLIENT")`.

3. **Config injection:**
   [`packages/unified-server/src/config.ts`](../../packages/unified-server/src/config.ts)
   (~L41) — remove `ENABLE_BACKEND_CLIENT: flags.ENABLE_BACKEND_CLIENT` from
   `createClientConfig`.

After removing from the type, build to find and remove any remaining references
to `CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT`.

---

### 2a.4 — Update tests

**9 test files** reference `ENABLE_BACKEND_CLIENT`:

1. [`tests/app-catalyst.test.ts`](../../packages/visual-editor/tests/app-catalyst.test.ts)
2. [`tests/a2/cached-content.test.ts`](../../packages/visual-editor/tests/a2/cached-content.test.ts)
3. [`tests/a2/data-transforms.test.ts`](../../packages/visual-editor/tests/a2/data-transforms.test.ts)
4. [`tests/a2/gemini.test.ts`](../../packages/visual-editor/tests/a2/gemini.test.ts)
5. [`tests/a2/generate-webpage-stream.test.ts`](../../packages/visual-editor/tests/a2/generate-webpage-stream.test.ts)
6. [`tests/a2/opal-adk-stream.test.ts`](../../packages/visual-editor/tests/a2/opal-adk-stream.test.ts)
7. [`tests/a2/singleton-cache.test.ts`](../../packages/visual-editor/tests/a2/singleton-cache.test.ts)
8. [`tests/a2/step-executor.test.ts`](../../packages/visual-editor/tests/a2/step-executor.test.ts)
9. [`tests/agent/stream-run-agent-event-source.test.ts`](../../packages/visual-editor/tests/agent/stream-run-agent-event-source.test.ts)

For each test file:

1. Remove the flag save/restore pattern
   (`const saved = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT; ... restored in afterEach`).
2. Remove tests that only exercise the flag-off (`fetchWithCreds`) path.
3. Keep tests that exercise the flag-on (`sendHttpRequest`) path — these become
   the canonical tests.
4. Remove `fetchWithCreds` mocks that are no longer called.
5. Update `backendClientMock` setup if it was conditional on the flag.

Also update constructor calls in tests to match the new signatures (e.g., remove
`fetchWithCreds` param from `AppCatalystApiClient` construction in tests).

---

### 2a.5 — Update documentation

1. **`docs/dev/backend_reference.md`** — Remove "when `ENABLE_BACKEND_CLIENT` is
   on; falls back to `fetchWithCreds` otherwise" language from every endpoint.
   Replace with "uses `OpalBackendClient`" or similar.

2. **`.agent/skills/opal-backend-api/SKILL.md`** — Update the migration section.
   Remove references to the flag and the dual-path pattern. The migration is
   complete; new calls should use `OpalBackendClient` directly.

3. **Phase 1 plan** — No changes needed (it's historical).

---

### 2a.6 — Remove `OPAL_BACKEND_API_PREFIX`

After all direct `fetchWithCreds` backend calls are removed,
`OPAL_BACKEND_API_PREFIX` should have no remaining consumers in application
code. The sole remaining consumer is `HttpBackendClient`, which uses it for URL
construction.

**What to do:**

1. **Refactor `HttpBackendClient`** to construct URLs using
   `CLIENT_DEPLOYMENT_CONFIG.BACKEND_API_ENDPOINT` directly, instead of
   `OPAL_BACKEND_API_PREFIX` (which gets remapped to `BACKEND_API_ENDPOINT` by
   the allowlist anyway). This eliminates the indirection.

2. **Remove `OPAL_BACKEND_API_PREFIX`** from
   [`packages/types/src/canonical-endpoints.ts`](../../packages/types/src/canonical-endpoints.ts).

3. **Remove `geminiApiPrefix()`** from
   [`packages/types/src/gemini-endpoint.ts`](../../packages/types/src/gemini-endpoint.ts)
   — after `theme-utils.ts` and `gemini.ts` are migrated to `backendClient`,
   this helper has no consumers.

4. **Clean up the fetch-allowlist** — remove the `OPAL_BACKEND_API_PREFIX`
   remapping entry from
   [`packages/visual-editor/src/ui/utils/fetch-allowlist.ts`](../../packages/visual-editor/src/ui/utils/fetch-allowlist.ts).
   Other allowlist entries (Google Drive, Docs, etc.) remain.

5. **Verify removal** — `grep -r "OPAL_BACKEND_API_PREFIX" packages/` and
   `grep -r "geminiApiPrefix" packages/` should return zero results in
   application code (test files may still reference them if they test URL
   construction — update those too).

---

## Verification

1. `npm run build` — must compile cleanly.
2. `npm run test` in `packages/visual-editor` — all tests pass.
3. `grep -r "ENABLE_BACKEND_CLIENT" packages/` — returns zero results.
4. `grep -r "fetchWithCreds" packages/visual-editor/src/` — audit results. Every
   remaining usage should be for third-party APIs (Google Drive, NotebookLM
   Partner API, etc.), not for `BACKEND_API_ENDPOINT`.
5. `grep -r "OPAL_BACKEND_API_PREFIX" packages/` — returns zero results in
   production code.
6. `grep -r "geminiApiPrefix" packages/` — returns zero results.

---

## Progress Tracker

| Work Item | Scope                                             | Status |
| --------- | ------------------------------------------------- | ------ |
| 2a.0      | Migrate `theme-utils.ts` straggler                |        |
| 2a.1      | Collapse flag gates (11 files, 23 gates)          |        |
| 2a.2      | Remove `fetchWithCreds` backend plumbing          |        |
| 2a.3      | Remove `ENABLE_BACKEND_CLIENT` flag (3 locations) |        |
| 2a.4      | Update tests (9 files)                            |        |
| 2a.5      | Update documentation                              |        |
| 2a.6      | Remove `OPAL_BACKEND_API_PREFIX`                  |        |
