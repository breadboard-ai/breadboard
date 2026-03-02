# Provenance: TypeScript → Python Port Mapping

> **The TypeScript code is the production path.** Everything in this Python
> package is a port, gated behind the `enableOpalBackend` flag. Until the flag
> is removed, TS is the source of truth and Python must track TS changes.
>
> TypeScript source: `packages/visual-editor/src/a2/agent/`

## Synced Core (`opal_backend/`)

| Python module            | TypeScript source                                | Notes                                          |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| `run.py`                 | `local-agent-run.ts`, `loop-setup.ts`            | Public API; wires deps + starts loop           |
| `loop.py`                | `loop.ts`                                        | Core function-calling orchestrator             |
| `events.py`              | `agent-event.ts`                                 | Wire format — both sides must match            |
| `agent_events.py`        | `loop-setup.ts` (`buildHooksFromSink`)           | Event sink + hooks adapter                     |
| `gemini_client.py`       | _(inline in loop.ts)_                            | Extracted into own module in Python            |
| `conform_body.py`        | `resolve-to-segments.ts`, data transform helpers | Data part transforms                           |
| `pidgin.py`              | `pidgin-translator.ts`                           | Segment → pidgin text translation              |
| `step_executor.py`       | `step-executor.ts`                               | executeStep client for media gen               |
| `agent_file_system.py`   | `file-system.ts`                                 | In-memory virtual file system                  |
| `task_tree_manager.py`   | `task-tree-manager.ts`                           | Hierarchical task tree                         |
| `suspend.py`             | _(no direct counterpart)_                        | New for Python; TS handles suspend inline      |
| `interaction_store.py`   | _(no direct counterpart)_                        | New protocol for Python's reconnect model      |
| `backend_client.py`      | _(no direct counterpart)_                        | Backend + Gemini abstraction for sync boundary |
| `function_definition.py` | `function-definition.ts`                         | FunctionDefinition / FunctionGroup types       |
| `function_caller.py`     | `function-caller.ts`                             | Async function dispatch                        |
| `shared_schemas.py`      | _(spread across function files in TS)_           | Centralized in Python                          |

## Function Groups (`opal_backend/functions/`)

| Python module | TypeScript source                         | Notes                                    |
| ------------- | ----------------------------------------- | ---------------------------------------- |
| `system.py`   | `functions/system.ts`                     | 7 system functions                       |
| `generate.py` | `functions/generate.ts`                   | generate_text, generate_and_execute_code |
| `image.py`    | `functions/generate.ts` (generate_images) | Split into own module in Python          |
| `video.py`    | `functions/generate.ts`                   | Split into own module in Python          |
| `audio.py`    | `functions/generate.ts`                   | Split into own module in Python          |
| `chat.py`     | `functions/chat.ts`                       | Suspend-based user input                 |

## Not Ported (TS-only)

These TS modules have no Python counterpart (yet). They are either client-only,
not needed server-side, or planned for a future phase:

| TypeScript module                | Why not ported                           |
| -------------------------------- | ---------------------------------------- |
| `agent-context.ts`               | Client-side run state tracking           |
| `agent-service.ts`               | SCA service — frontend-only              |
| `agent-event-consumer.ts`        | Client-side SSE consumer                 |
| `agent-event-sink.ts`            | Client-side event sink                   |
| `agent-function-configurator.ts` | Client-side function config              |
| `console-*.ts`, `progress-*.ts`  | UI progress tracking                     |
| `a2ui/*.ts`                      | A2 UI rendering — frontend-only          |
| `graph-editing/*.ts`             | Graph editing — planned for future phase |
| `functions/a2ui.ts`              | A2 UI functions — frontend-only          |
| `functions/google-drive.ts`      | Drive functions — planned                |
| `functions/memory.ts`            | Memory functions — planned               |
| `functions/notebooklm.ts`        | NotebookLM functions — planned           |
| `functions/no-ui.ts`             | No-UI functions — planned                |

## How to Use This Table

When you modify a TS file listed above, check whether the Python port needs the
same change. When you modify a Python file, check whether you're diverging from
the TS source intentionally.

See `.agent/skills/port-fidelity/SKILL.md` for the full audit workflow.
