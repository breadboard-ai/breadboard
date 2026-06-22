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
| [`canonical-endpoints.ts`](../../../packages/types/src/canonical-endpoints.ts)                        | Canonical URL prefixes for third-party Google APIs (Drive, Docs, Sheets, etc.). Used by the fetch allowlist.                                                                             |

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
2. No flag gating is needed — `OpalBackendClient` is the standard path for all
   backend calls.
3. If the endpoint needs the access token in the JSON body (not just the
   `Authorization` header), add a condition to `shouldAddAccessTokenToJsonBody`
   in `fetch-allowlist.ts`.
4. Add the endpoint to `docs/dev/backend_reference.md`.

## `OpalBackendClient`

All backend API calls go through `OpalBackendClient`. The migration from direct
`fetchWithCreds` call sites is complete — there is no feature flag or fallback
path.

| File                                                                                            | Role                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`opal-backend-client.ts`](../../../packages/types/src/opal-backend-client.ts)                  | `OpalBackendClient` interface. `sendHttpRequest(methodName, options)` constructs `${BACKEND_API_ENDPOINT}/v1beta1/${methodName}`. |
| [`http-backend-client.ts`](../../../packages/visual-editor/src/ui/utils/http-backend-client.ts) | `HttpBackendClient` — default implementation wrapping `fetchWithCreds`.                                                           |

### How it works

- The host instantiates `HttpBackendClient` and exposes it to the guest via
  `getOpalBackendClient()` (Comlink).
- Guest code calls
  `backendClient.sendHttpRequest("methodName", { method, body })`. The client
  handles origin resolution and API versioning internally.
- `HttpBackendClient` wraps `fetchWithCreds` under the hood, so the host/guest
  credential plumbing (allowlist, token attachment) still applies transparently.
