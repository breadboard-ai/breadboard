# `dev/` — Development Backend Server

FastAPI server that runs the real Python agent loop against live Gemini APIs.
Not synced to production.

## How to Run

### With the full stack (recommended)

```bash
# From repo root — starts unified-server (port 3000) + dev backend (port 8080)
npm run dev:backend -w packages/unified-server
```

### Standalone

```bash
npm run dev -w packages/opal-backend
# Or directly:
.venv/bin/uvicorn opal_backend.dev.main:app --reload --port 8080
```

## What It Does

`main.py` defines a FastAPI app with two backend implementations:

### `DevAgentBackend`

Handles `POST /v1beta1/streamRunAgent`:

1. Parses the request body (start or resume)
2. Creates per-request `HttpBackendClient` with the caller's OAuth token
3. Delegates to `opal_backend.run()` or `opal_backend.resume()`
4. Wraps the async event iterator as an `EventSourceResponse` (SSE)

### `DevProxyBackend`

Catch-all proxy for `v1beta1/*` requests:

- Forwards to One Platform (`PROXY_UPSTREAM_URL` env var)
- Preserves auth headers, strips `Content-Encoding` to avoid double-gzip

### Gemini Cache Endpoint

`POST /v1beta1/cachedContents` — proxies to the Gemini cache API using
`GEMINI_KEY` (API key auth, since OAuth is not supported for this endpoint).

## Environment Variables

| Variable             | Default                                 | Purpose                          |
| -------------------- | --------------------------------------- | -------------------------------- |
| `PROXY_UPSTREAM_URL` | `https://appcatalyst.pa.googleapis.com` | One Platform server for proxying |
| `GEMINI_KEY`         | (empty)                                 | API key for Gemini cache API     |
