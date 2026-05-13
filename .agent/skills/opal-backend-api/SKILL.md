---
name: opal-backend-api
description:
  How authenticated HTTP calls to the Opal backend work — the host/guest
  architecture, fetchWithCreds, the fetch allowlist, and the OpalBackendClient
  migration. Read this before adding, modifying, or debugging any backend call.
---

# Backend API

How the Opal frontend makes authenticated HTTP calls to the Opal backend
(`BACKEND_API_ENDPOINT`).

## Comprehensive Reference

All backend endpoints are cataloged in
[`docs/dev/backend_reference.md`](../../../docs/dev/backend_reference.md). That
document lists every RPC method, its call location in the source, and its
`OpalBackendClient` migration status. Consult it before adding a new endpoint or
auditing existing ones, and update it when making any changes that require it.

## Host / Guest Architecture

The browser loads the **host** (also called the "shell"), which loads the
**guest** in a full-page `<iframe>`. When the guest wants to make a backend
call, it calls `fetchWithCreds`. That call propagates from the guest to the host
via Comlink over `postMessage`. The host then makes the actual HTTP request with
credentials attached and returns the result to the guest.

```
┌─────────────────────────────────────────────────────┐
│ Host (oauth-based-opal-shell.ts)                    │
│                                                     │
│  fetchWithCreds(url, init)                          │
│    1. checkFetchAllowlist(url)                      │
│    2. remap origin if configured                    │
│    3. attach Authorization: Bearer <token>          │
│    4. maybe inject accessToken into JSON body       │
│    5. fetch(remappedUrl, { ...init, headers })      │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Guest (iframe)                                │  │
│  │                                               │  │
│  │  fetchWithCreds(canonicalUrl, init)           │  │
│  │    └─── postMessage/Comlink ──► host ─────┘   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Key files

| File                                                                                                  | Role                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`oauth-based-opal-shell.ts`](../../../packages/visual-editor/src/ui/utils/oauth-based-opal-shell.ts) | Host-side `fetchWithCreds` implementation. Also contains a direct `checkAppAccess` call used during sign-in for geo restriction checking.                                                |
| [`fetch-allowlist.ts`](../../../packages/visual-editor/src/ui/utils/fetch-allowlist.ts)               | Allowlist of permitted endpoint prefixes. Remaps canonical origins to environment-specific endpoints. Determines OAuth scopes and whether to inject the access token into the JSON body. |
| [`canonical-endpoints.ts`](../../../packages/types/src/canonical-endpoints.ts)                        | Canonical URL prefixes (e.g., `OPAL_BACKEND_API_PREFIX`). Guest code uses these; the allowlist remaps them at runtime.                                                                   |
| [`gemini-endpoint.ts`](../../../packages/types/src/gemini-endpoint.ts)                                | `geminiApiPrefix()` → `${OPAL_BACKEND_API_PREFIX}/v1beta1/models`. Used by `gemini.ts` for Gemini proxy calls.                                                                           |

## `fetchWithCreds`

All authenticated HTTP calls flow through `fetchWithCreds`, which does two
things:

1. **Allowlist check.** Consults `checkFetchAllowlist` in `fetch-allowlist.ts`.
   If the URL's origin + pathname prefix doesn't match any entry, the call is
   rejected with HTTP 403. Each allowlist entry specifies:
   - `canonicalPrefix` — the origin/path to match
   - `scopes` — OAuth scopes required for the call
   - `remapOrigin` — optional environment-specific origin override
   - `shouldAddAccessTokenToJsonBody` — for endpoints that need the token in the
     request body (e.g., `uploadGeminiFile`, `sessions/new`)

2. **Credential attachment.** Attaches `Authorization: Bearer <token>` to the
   request headers.

### Adding a new backend endpoint

**New backend calls must use `OpalBackendClient`, not `fetchWithCreds`
directly.** The whole point of the migration is to stop accumulating new
`fetchWithCreds` call sites. Adding another one moves us backward.

1. Call `backendClient.sendHttpRequest("yourMethodName", { method, body })`. The
   client handles origin resolution and API versioning — you supply only the RPC
   method name.
2. Gate behind `ENABLE_BACKEND_CLIENT` with a `fetchWithCreds` fallback only if
   the endpoint must ship before the flag is globally enabled. Even then, write
   the `OpalBackendClient` path first and treat the fallback as temporary
   scaffolding.
3. If the endpoint needs the access token in the JSON body (not just the
   `Authorization` header), add a condition to `shouldAddAccessTokenToJsonBody`
   in `fetch-allowlist.ts`.
4. Add the endpoint to `docs/dev/backend_reference.md`.

## `OpalBackendClient` Migration

There is an ongoing effort (gated by `ENABLE_BACKEND_CLIENT`) to replace direct
`fetchWithCreds` calls with a dedicated backend client.

| File                                                                                            | Role                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`opal-backend-client.ts`](../../../packages/types/src/opal-backend-client.ts)                  | `OpalBackendClient` interface. `sendHttpRequest(methodName, options)` constructs `${BACKEND_API_ENDPOINT}/v1beta1/${methodName}`. |
| [`http-backend-client.ts`](../../../packages/visual-editor/src/ui/utils/http-backend-client.ts) | `HttpBackendClient` — default implementation wrapping `fetchWithCreds`.                                                           |

### How it works

- The host instantiates `HttpBackendClient` and exposes it to the guest via
  `getOpalBackendClient()` (Comlink).
- Guest code checks `CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT`. When on,
  it calls `backendClient.sendHttpRequest("methodName", { method, body })`. When
  off, it falls back to `fetchWithCreds` with a manually constructed URL.
- The flag is defined in three places (keep all in sync):
  - `packages/types/src/deployment-configuration.ts`
  - `packages/unified-server/src/flags.ts`
  - `packages/unified-server/src/config.ts`

### Migration status

See `docs/dev/backend_reference.md` for the full per-endpoint status (✅/❌).

### Migrating an endpoint

1. Accept `Promise<OpalBackendClient>` alongside the existing `fetchWithCreds`
   parameter (see `AppCatalystApiClient` constructor for the pattern).
2. Gate the new path: `if (CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT)`.
3. Call `backendClient.sendHttpRequest("rpcMethodName", { method, body })`.
4. Keep the `fetchWithCreds` fallback in the `else` branch.
5. Update `docs/dev/backend_reference.md` — flip ❌ to ✅.
6. Add tests for both paths (see `tests/app-catalyst.test.ts` for examples).
