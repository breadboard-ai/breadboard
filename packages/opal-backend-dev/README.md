# opal-backend-dev

Local development backend for Opal. Proxies existing One Platform APIs and wires
new agent APIs directly to `opal-backend-shared`.

## Quick Start

### One-time setup (from repo root)

```bash
npm run setup:python
```

This creates Python virtual environments for all three backend packages.

### Development

**Dev backend** (proxies all v1beta1/\* to One Platform via staging):

```bash
npm run dev:backend -w packages/unified-server
```

This starts both the static server (`:3000`) and the dev Python backend
(`:8080`). The client at `http://localhost:3000` will route all backend API
calls through the local proxy.

**Fake backend** (canned scenarios, no real API calls):

```bash
npm run dev:fake -w packages/unified-server
```

If the Python venv hasn't been set up, you'll see a helpful message — the static
server still starts, just without the Python backend.

### Running Tests

```bash
cd packages/opal-backend-dev
.venv/bin/python -m pytest tests/ -v
```

Or run all Python package tests from the repo root:

```bash
npm run test:python
```

## Package Structure

```
packages/
  opal-backend-shared/    ← Shared protocol primitives (synced to prod)
    opal_backend_shared/
      events.py           ← AgentEvent Pydantic models
      sse_sink.py         ← SSEAgentEventSink
      pending_requests.py ← PendingRequestMap
      local/              ← NOT synced — local-only shared API surface
        api_surface.py    ← Router factory + protocols

  opal-backend-fake/      ← Canned-scenario server
    opal_backend_fake/
      main.py             ← FakeAgentBackend via shared router
      scenarios.py        ← echo, chat, graph-edit, consent
    tests/

  opal-backend-dev/       ← Dev server (this package)
    opal_backend_dev/
      main.py             ← DevProxyBackend via shared router
    tests/
```
