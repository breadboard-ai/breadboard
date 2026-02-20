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

**Fake backend** (canned scenarios, no real API calls):

```bash
npm run dev:fake -w packages/unified-server
```

This starts both the static server (`:3100`) and the fake Python backend
(`:8000`). The client at `http://localhost:3100` will route all backend API
calls to the fake server.

If the Python venv hasn't been set up, you'll see a helpful message — the static
server still starts, just without the fake backend.

**Dev backend** (stub — will proxy real APIs in Phase 4.3):

```bash
cd packages/opal-backend-dev
npm run dev
```

## Package Structure

```
packages/
  opal-backend-shared/    ← Copybara-sharable protocol primitives
    opal_backend_shared/
      events.py           ← 21 AgentEvent Pydantic models
      sse_sink.py          ← SSEAgentEventSink
      pending_requests.py  ← PendingRequestMap

  opal-backend-fake/      ← Canned-scenario server
    opal_backend_fake/
      main.py              ← FastAPI endpoints
      scenarios.py         ← echo, chat, graph-edit, consent
    tests/

  opal-backend-dev/       ← Dev server (this package)
    opal_backend_dev/
      main.py              ← FastAPI stub + proxy (Phase 4.3)
```
