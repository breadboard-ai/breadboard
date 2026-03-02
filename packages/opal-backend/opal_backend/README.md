# `opal_backend/` — Synced Core

Everything in this directory (and `functions/`) is synced to the production
backend via copybara. **No external dependencies allowed** — only Python
stdlib + typing.

## Module Reference

### Entry Points

| Module   | Purpose                                 |
| -------- | --------------------------------------- |
| `run.py` | `run()` and `resume()` — the public API |

### Orchestration

| Module                   | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `loop.py`                | Gemini function-calling while-loop          |
| `function_caller.py`     | Concurrent async function dispatch          |
| `function_definition.py` | `FunctionDefinition`, `FunctionGroup` types |

### Wire Protocol

| Module            | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `events.py`       | 22 event dataclasses + segments + request models |
| `agent_events.py` | `AgentEventSink` queue + `build_hooks_from_sink` |

### Data Pipeline

| Module             | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `conform_body.py`  | Resolve storedData/fileData → Gemini-native      |
| `pidgin.py`        | Segments → pidgin text (single source of truth)  |
| `step_executor.py` | `/v1beta1/executeStep` client (media generation) |

### Agent State

| Module                 | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `agent_file_system.py` | In-memory virtual FS with `/mnt/` paths     |
| `task_tree_manager.py` | Hierarchical task tree (JSON schema output) |

### Suspend/Resume

| Module                 | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `suspend.py`           | `SuspendError` + `SuspendResult`              |
| `interaction_store.py` | `InteractionStore` protocol (state lifecycle) |

### Transport Protocols

| Module              | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `backend_client.py` | `BackendClient` protocol (executeStep, uploads, Gemini streaming) |

### Shared

| Module              | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `shared_schemas.py` | `STATUS_UPDATE_SCHEMA`, `TASK_ID_SCHEMA`, etc. |

## Dependency Graph

```
run.py
├── loop.py
│   ├── gemini_client.py ← BackendClient
│   ├── function_caller.py
│   │   └── function_definition.py
│   └── suspend.py
├── agent_events.py
│   └── events.py
├── agent_file_system.py
├── task_tree_manager.py
├── conform_body.py ← BackendClient
├── pidgin.py
├── step_executor.py ← BackendClient
├── interaction_store.py
└── functions/
    ├── system.py
    ├── generate.py
    ├── image.py
    ├── video.py
    ├── audio.py
    └── chat.py
```

Arrows (←) show protocol injection points. The synced code never creates
transport objects — it receives them through `run()` / `resume()` parameters.
