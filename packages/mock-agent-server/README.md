# Mock Agent Server

A standalone Python server that implements the Breadboard agent event SSE
protocol. Used to validate the wire format before building the real TypeScript
transport.

## Quick Start

```bash
cd packages/mock-agent-server

# One-time setup: creates .venv and installs deps
npm run setup

# Start the dev server (auto-reloads on changes)
npm run dev

# Run all tests
npm test
```

### Other scripts

| Script                     | What it does                                |
| -------------------------- | ------------------------------------------- |
| `npm run setup`            | Creates `.venv` and installs deps           |
| `npm run dev`              | Starts uvicorn on port 8000 with `--reload` |
| `npm test`                 | Runs all pytest tests                       |
| `npm run test:unit`        | Runs `PendingRequestMap` unit tests only    |
| `npm run test:integration` | Runs scenario integration tests only        |

## Endpoints

| Method | Path                        | Purpose                         |
| ------ | --------------------------- | ------------------------------- |
| POST   | `/api/agent/run`            | Start a canned scenario         |
| GET    | `/api/agent/{runId}/events` | SSE stream of AgentEvent NDJSON |
| POST   | `/api/agent/{runId}/input`  | Resume a suspended request      |
| POST   | `/api/agent/{runId}/abort`  | Abort the run                   |

## Scenarios

Pass `{"scenario": "<name>"}` to `POST /run`:

- **echo** — fire-and-forget events only (start → thought → functionCall →
  functionResult → content → finish)
- **chat** — includes a `waitForInput` suspend event
- **graph-edit** — includes `readGraph` + `applyEdits` suspend events
- **consent** — includes a `queryConsent` suspend event

## Wire Format

Each SSE `data:` line contains a JSON-encoded `AgentEvent`:

```
data: {"type":"start","objective":{"parts":[{"text":"Hello"}],"role":"user"}}

data: {"type":"thought","text":"Thinking..."}
```

Suspend events include a `requestId`. Resume via POST:

```bash
curl -X POST http://localhost:8000/api/agent/{runId}/input \
  -H "Content-Type: application/json" \
  -d '{"requestId":"abc-123","response":{"input":{"parts":[{"text":"Hi"}]}}}'
```
