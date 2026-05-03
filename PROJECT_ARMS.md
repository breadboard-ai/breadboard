# Project ARMS — Authenticated Remote MCP Servers

The MCP bridge in Bees connects to external tool providers via stdio or HTTP.
Today, HTTP servers can authenticate with static headers (API keys). But
Google Workspace MCP servers — Gmail, Drive, Calendar, Chat, People — require
**OAuth 2.0 Authorization Code + PKCE** with user consent, token refresh,
and per-server scopes. Project ARMS adds OAuth as a first-class auth mode
for remote MCP servers.

## Architecture

```
                     SYSTEM.yaml                     .mcp-tokens/
                 ┌──────────────┐                 ┌──────────────┐
                 │ mcp:         │                 │ gmail.json   │
                 │   - name:    │                 │ drive.json   │
                 │     url:     │                 │ calendar.json│
                 │     oauth:   │                 └──────┬───────┘
                 │       scopes │                        │
                 └──────┬───────┘                        │
                        │                                │
         ┌──────────────▼───────────────────────────────▼──────────┐
         │                    MCPRegistry                           │
         │                                                         │
         │  _connect_http()          _connect_http_oauth()          │
         │  ┌───────────────┐        ┌──────────────────────────┐  │
         │  │ httpx.AsyncClient      │ httpx.AsyncClient         │  │
         │  │ (headers=...)  │       │ (auth=OAuthClientProvider)│  │
         │  └───────┬───────┘        └───────────┬──────────────┘  │
         │          │                            │                  │
         │          ▼                            ▼                  │
         │     streamable_http_client ──────────────────────────►  │
         └─────────────────────────────────────────────────────────┘
```

Key insight: the MCP Python SDK (v1.27.0) provides `OAuthClientProvider`,
an `httpx.Auth` subclass that handles the full OAuth flow. The integration
point is clean: `httpx.AsyncClient(auth=provider)` passes through
`streamable_http_client` unchanged.

### Auth Mode Selection

The SYSTEM.yaml entry determines the auth mode for each MCP server:

| Config present | Auth mode | Route |
|---|---|---|
| `oauth` | OAuth 2.0 | `_connect_http_oauth()` |
| `headers` (or neither) | Static headers / anonymous | `_connect_http()` |
| `command` | Stdio subprocess | `_connect_stdio()` |
| Both `oauth` + `headers` | **Validation error** | — |

### Token Ownership

Hivetool owns the OAuth consent flow (it's already in a browser). The box
is a token *consumer* — on startup, if tokens are missing for an OAuth
server, it logs a message and skips that server gracefully.

### Storage

Token storage lives at `hive/.mcp-tokens/`, a top-level directory the
box's `classify_change` already ignores — no cold restarts, no scheduler
triggers. Client credentials are always `${ENV_VAR}` references.

## SYSTEM.yaml Schema

```yaml
mcp:
  - name: gmail
    description: Gmail MCP Server
    url: https://gmailmcp.googleapis.com/mcp/v1
    oauth:
      client_id: "${GOOGLE_OAUTH_CLIENT_ID}"
      client_secret: "${GOOGLE_OAUTH_CLIENT_SECRET}"
      scopes:
        - https://www.googleapis.com/auth/gmail.readonly
        - https://www.googleapis.com/auth/gmail.compose

  - name: drive
    description: Google Drive MCP Server
    url: https://drivemcp.googleapis.com/mcp/v1
    oauth:
      client_id: "${GOOGLE_OAUTH_CLIENT_ID}"
      client_secret: "${GOOGLE_OAUTH_CLIENT_SECRET}"
      scopes:
        - https://www.googleapis.com/auth/drive.readonly
        - https://www.googleapis.com/auth/drive.file
```

Multiple servers share the same client credentials (same env vars),
each with its own scopes and token set.

| Field | Type | Required | Description |
|---|---|---|---|
| `oauth` | object | no | OAuth 2.0 configuration. Mutually exclusive with `headers`. |
| `oauth.client_id` | string | yes | `${ENV_VAR}` reference to the OAuth client ID. |
| `oauth.client_secret` | string | yes | `${ENV_VAR}` reference to the OAuth client secret. |
| `oauth.scopes` | list\<string\> | yes | OAuth scopes to request during consent. |

---

## Phase 1 — OAuth Connection Path (Python)

### 🎯 Objective

The box connects to a Google Workspace MCP server using pre-existing
OAuth tokens. When tokens are missing, it skips the server gracefully
instead of crashing.

**Observable proof:** Configure a Gmail MCP server with `oauth` in
SYSTEM.yaml. Place a valid token file in `.mcp-tokens/gmail.json`.
Start the box. The scheduler connects, discovers Gmail tools
(`create_draft`, `search_threads`, etc.), and an agent successfully
calls a Gmail tool. Remove the token file, restart — the box logs
"authenticate via hivetool" and starts without Gmail.

### Changes

- [x] `bees/functions/mcp_bridge.py` — add `OAuthConfig` dataclass
      (client_id, client_secret, scopes).
- [x] `bees/functions/mcp_bridge.py` — add `HiveTokenStorage` class
      implementing the MCP SDK's `TokenStorage` protocol. Reads/writes
      `hive/.mcp-tokens/<name>.json`.
- [x] `bees/functions/mcp_bridge.py` — add `_connect_http_oauth()` on
      `MCPRegistry`. Constructs `OAuthClientProvider` with
      `HiveTokenStorage` and no redirect handler. Wraps in
      `httpx.AsyncClient(auth=provider)`.
- [x] `bees/functions/mcp_bridge.py` — update `connect_all()`: validate
      `oauth` + `url` required together, `oauth` + `headers` forbidden.
      Route to `_connect_http_oauth()` when `oauth` present.
- [x] `bees/functions/mcp_bridge.py` — graceful skip: if `_connect_http_oauth`
      fails due to missing tokens, log a warning and continue startup
      (don't raise).
- [x] `docs/system-config.md` — document the `oauth` field and token
      storage location.
- [x] Tests: `HiveTokenStorage` read/write round-trip, config validation
      (oauth without url, oauth with headers), graceful skip on missing
      tokens. 39 total, 20 new.

---

## Phase 2 — Hivetool OAuth Config UI

### 🎯 Objective

Hivetool understands the `oauth` schema and lets users configure it
visually. Token status is visible per MCP server.

**Observable proof:** Open hivetool, go to System tab. An MCP server
with `oauth` config shows scopes and client_id reference in view mode.
Edit mode has an "OAuth" toggle that reveals client_id, client_secret,
and scopes fields. Token status (authenticated / not authenticated)
is shown based on whether `.mcp-tokens/<name>.json` exists.

### Changes

- [x] `hivetool/src/data/system-store.ts` — add `OAuthConfig` type
      (`client_id`, `client_secret`, `scopes`). Add `oauth?` field to
      `MCPServerConfig`. Parse from YAML in `scan()`, serialize in
      `save()`.
- [ ] `hivetool/src/data/system-store.ts` — add `tokenStatus` signal
      or method. Read `.mcp-tokens/` directory to determine per-server
      auth status (file exists → "authenticated", missing → "not
      authenticated"). *(Deferred to Phase 3 — pairs with consent flow.)*
- [x] `hivetool/src/ui/system-detail.ts` — MCP view cards: show oauth
      scopes, client_id env var reference, and OAuth badge.
- [x] `hivetool/src/ui/system-detail.ts` — MCP edit cards: add auth
      mode toggle (Headers/OAuth, mutually exclusive). OAuth mode shows
      client_id, client_secret (env var input fields), and scopes
      (list editor). Headers hidden when OAuth active.

---

## Phase 3 — Hivetool Consent Flow

### 🎯 Objective

Users can complete the full OAuth consent flow from within hivetool,
eliminating the need for manual token provisioning.

**Observable proof:** Open hivetool. Add a Gmail MCP server with OAuth
config in the System tab. Click "Authenticate". A popup opens Google's
consent page. Approve. The popup closes, token status changes to
"Connected" with granted scopes. Restart the box — it picks up the
token and connects without prompting.

### Changes

- [x] `hivetool/src/data/oauth-flow.ts` — **[NEW]** OAuth consent
      orchestrator:
      - Build authorization URL (from client_id, scopes, redirect URI,
        PKCE code verifier/challenge).
      - Open popup window to Google's consent page.
      - Catch redirect via `postMessage` from
        `oauth-callback.html`.
      - Exchange authorization code for tokens via `fetch` to Google's
        token endpoint.
      - Write token file to `hive/.mcp-tokens/<name>.json` via File
        System Access API.
      - Read `.env` from hive root to expand `${VAR}` credential refs.
- [x] `hivetool/public/oauth-callback.html` — **[NEW]** Static callback
      page served by Vite. Extracts code/state from URL params,
      `postMessage`s to opener, auto-closes.
- [x] `hivetool/src/ui/system-detail.ts` — "Authenticate" button per
      OAuth-configured MCP server. Token status indicator (Connected /
      Not Authenticated / Pending). Wires to oauth-flow. Re-authenticate
      support.
- [x] `hivetool/src/data/system-store.ts` — Token status via
      `checkTokenStatus()` (deferred from Phase 2).
- [x] `hivetool/src/ui/app.ts` — Pass `stateAccess` to system-detail.
- [x] Handle edge cases: popup blocked, user cancels consent, token
      exchange fails, state mismatch, timeout (5 min).

---

## Non-Goals

- **Box-initiated consent.** The box is a headless watcher. OAuth consent
  is inherently interactive — hivetool owns it. The box consumes tokens.
- **MCP server-initiated auth.** The MCP spec defines server-side OAuth
  discovery (`.well-known/oauth-authorization-server`). We don't rely on
  it — the client drives auth from explicit config.
- **Automatic scope negotiation.** Scopes are declared in SYSTEM.yaml.
  We don't query the server for required scopes.
- **Multi-user tokens.** One token set per server per hive. The token
  belongs to whoever approved the consent screen.

## File Map

```
packages/bees/
  bees/functions/
    mcp_bridge.py              ← OAuthConfig, HiveTokenStorage,
                                 _connect_http_oauth()
  hivetool/
    public/
      oauth-callback.html      ← [NEW] Static OAuth redirect page
    src/
      data/
        system-store.ts        ← OAuthConfig type
        oauth-flow.ts          ← [NEW] Browser-side OAuth consent
      ui/
        system-detail.ts       ← OAuth fields, Authenticate button,
                                 token status indicator
        app.ts                 ← stateAccess wiring
  docs/
    system-config.md           ← oauth field documentation
  tests/
    test_mcp_bridge.py         ← OAuth path tests
```
