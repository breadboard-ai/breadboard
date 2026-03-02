# `local/` — Not Synced to Production

This directory contains code shared between the dev and fake servers but **not**
synced to the production backend. The production backend has its own HTTP
plumbing (One Platform API surface, internal RPC).

Everything outside this directory IS synced to production.

## Module Reference

| Module                      | Purpose                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `api_surface.py`            | FastAPI router factory + `AgentBackend`/`ProxyBackend` protocols         |
| `http_client_impl.py`       | `HttpxClient` — `httpx`-based `HttpClient` implementation                |
| `backend_client_impl.py`    | `HttpBackendClient` — HTTP-based `BackendClient` (POSTs to One Platform) |
| `interaction_store_impl.py` | `InMemoryInteractionStore` — dict-based `InteractionStore`               |
| `pending_requests.py`       | `PendingRequestMap` — asyncio futures for fake server suspend/resume     |
| `sse_sink.py`               | `SSEAgentEventSink` — bridges `AgentEvent` → SSE strings for fake server |

## The Resumable Stream Protocol

Both dev and fake servers share the same HTTP endpoint:

```
POST /v1beta1/streamRunAgent → SSE stream

Body (start):  {"kind": "...", "segments": [...], "flags": {...}}
Body (resume): {"interactionId": "...", "response": {...}}
```

`api_surface.py` defines this router. Each server provides its own
`AgentBackend` implementation:

- **Dev server** (`dev/main.py`) → `DevAgentBackend` (real Gemini loop)
- **Fake server** (`fake/main.py`) → `FakeAgentBackend` (canned scenarios)

## Protocol → Implementation Mapping

| Protocol (synced)  | Implementation (local)                                   |
| ------------------ | -------------------------------------------------------- |
| `HttpClient`       | `HttpxClient` (`http_client_impl.py`)                    |
| `BackendClient`    | `HttpBackendClient` (`backend_client_impl.py`)           |
| `InteractionStore` | `InMemoryInteractionStore` (`interaction_store_impl.py`) |
