> [!NOTE] This is a directional concept, not a finalized design. It captures the
> packaging architecture that emerged from the delegated sessions exploration
> and the "run from GitHub" question.

# Package Split

The goal: `bees` becomes a zero-dependency orchestration library that owns both
task lifecycle _and_ the function layer. Model-provider concerns live in a
separate runner package. CLI and server applications are thin shells that wire
the two together.

## The dependency graph

```
opal_backend (standalone, owns Gemini session runtime)
         ↑
bees-gemini (depends on bees + opal_backend)
  ├── runners/streaming.py  (wraps opal_backend Loop)
  ├── runners/live.py       (Gemini Live API, future)
  └── adapter.py            (bridges bees ↔ opal_backend FunctionGroup)
  ↑              ↑
 box             app
  ↑              ↑
bees (zero external deps)
  ├── orchestration (scheduler, task store, coordination, mutations)
  ├── functions (declarations + handlers)
  └── protocols (FunctionGroup, FunctionFactory, SessionRunner)
```

Four packages, four responsibilities:

| Package           | What it is                        | External deps                       |
| ----------------- | --------------------------------- | ----------------------------------- |
| **`bees`**        | Orchestration library + functions | None (stdlib only)                  |
| **`bees-gemini`** | Gemini model provider             | `google-genai`, `httpx`             |
| **`box`**         | Filesystem-driven CLI runner      | `bees`, `bees-gemini`, `watchfiles` |
| **`app`**         | Reference web application         | `bees`, `bees-gemini`, `fastapi`    |

## What each package owns

### `bees` — the library

**Owns**: Task lifecycle, scheduling, the agent tree, mutations, coordination,
prompt assembly, the hive filesystem format, **and the function layer**.

The functions in `bees/functions/` are framework capabilities:

| Function module   | What it does               | Gemini-specific? |
| ----------------- | -------------------------- | ---------------- |
| `tasks.py`        | Create/manage tasks        | No               |
| `events.py`       | Broadcast/subscribe events | No               |
| `skills.py`       | Load skill instructions    | No               |
| `chat.py`         | Conversation control       | No               |
| `system.py`       | Workspace file operations  | No               |
| `simple_files.py` | File I/O                   | No               |
| `mcp_bridge.py`   | MCP server forwarding      | No               |
| `sandbox.py`      | Sandboxed code execution   | No               |

**Defines**: The `SessionRunner` protocol — a contract for "run this task's
session and report back."

**Dependencies**: None beyond stdlib. Pure `pathlib`, `json`, `asyncio`,
`dataclasses`. This is what makes `pip install bees` lightweight and safe.

### `bees-gemini` — the model provider

**Owns**: The Gemini-specific session runners. Wraps `opal_backend`'s session
runtime behind bees' `SessionRunner` protocol.

```
bees-gemini/
  runners/
    streaming.py     # Wraps opal_backend Loop + GenerateContent
    live.py          # Gemini Live API WebSocket (future)
  adapter.py         # bridges bees ↔ opal_backend FunctionGroup
```

**The adapter** bridges bees' function protocols to `opal_backend`'s types.
Since the protocols are designed to mirror `opal_backend`'s shape, this is
structural compatibility — no translation logic, just type-level bridging.

**Auth lives here.** The runner's constructor takes credentials. Bees never sees
API keys:

```python
runner = StreamingRunner(
    api_key=load_gemini_key(),
    http_client=httpx.AsyncClient(timeout=httpx.Timeout(300.0)),
)

bees = Bees(hive_dir, runner=runner)
```

### `opal_backend` — the session runtime

`opal_backend` is a standalone package that owns the Gemini session runtime
(Loop, streaming, GenerateContent, interaction stores). It's used in production
by an older version of the system and has consumers outside the bees ecosystem.

`bees-gemini` depends on `opal_backend` for its `StreamingRunner`
implementation. `bees` itself never imports from `opal_backend` — the runner
package is the only bridge.

### `box` — the CLI runner

**Owns**: The filesystem-driven development mode. Watches the hive directory,
manages the box-active sentinel, classifies changes, handles the restart loop.

**Is**: A thin shell that wires `bees` + `bees-gemini` + config together:

```python
runner = StreamingRunner(api_key=load_gemini_key(), ...)
bees = Bees(hive_dir, runner=runner)
manager = MutationManager(hive_dir, bees=bees)
manager.activate()
await bees.listen()
async for changes in awatch(hive_dir):
    ...
```

**The user experience**:

```bash
# From anywhere, without cloning the repo:
uv run --from "git+https://github.com/.../box" \
  bees-box --hive ~/my-hive
```

### `app` — the reference application

**Owns**: The web server that demonstrates how to consume `bees` as a library.
REST endpoints for task interaction, SSE for observation, tool dispatch for
delegated sessions.

**Demonstrates**: How a production application would integrate bees — auth,
multi-user, HTTP API surface.

**Is not**: The only way to use bees. It's a reference, not the framework.

## The key boundary: SessionRunner

From [delegated-sessions-2.md](./delegated-sessions-2.md):

```python
class SessionRunner(Protocol):
    async def run(
        self,
        configuration: SessionConfiguration,
        channel: ContextChannel,
    ) -> SessionResult: ...
```

`bees` defines this protocol. `bees-gemini` implements it. `box` and `app`
instantiate the implementation and hand it to `Bees`.

## The function protocol bridge

Today, every function module in `bees/functions/` imports `opal_backend`'s type
system: `FunctionGroup`, `FunctionGroupFactory`, `SessionHooks`,
`assemble_function_group`, `load_declarations`. The handler _logic_ is pure bees
(task creation, event routing, file I/O), but the handler _shape_ comes from
`opal_backend`.

The split replaces these imports with bees-native protocols that mirror
`opal_backend`'s types:

```python
# bees/protocols.py — framework-owned
class FunctionGroup(Protocol): ...
class FunctionFactory(Protocol): ...
class FunctionHooks(Protocol): ...
```

Since these protocols match `opal_backend`'s existing types in shape, Python's
structural subtyping means `opal_backend`'s `FunctionGroup` satisfies bees'
`FunctionGroup` protocol _without any changes to `opal_backend`_. The adapter in
`bees-gemini` doesn't need translation logic — it just passes through.

This also opens a future path: if `opal_backend` eventually wants to drop its
own types and implement bees' protocols directly, that's a non-breaking change.

## Function declarations

Function declarations use Gemini's `FunctionDeclaration` format directly.
There's no need to invent a bees-native schema — Gemini's format is
well-documented JSON Schema and serves as a practical lingua franca. If a future
non-Gemini runner needs a different format, the adaptation happens on the
runner's side.

## What moves where

### Out of `bees/` → into `bees-gemini`

| Current location           | New home                           | Why                         |
| -------------------------- | ---------------------------------- | --------------------------- |
| `bees/session.py`          | `bees-gemini/runners/streaming.py` | Model connection, streaming |
| `bees/disk_file_system.py` | `bees-gemini/` or `bees/`          | Depends on design of VFS    |
| `opal_backend` imports     | `bees-gemini/` only                | Provider-specific types     |

### Out of `bees/` → into `box`

| Current location | New home     | Why                       |
| ---------------- | ------------ | ------------------------- |
| `bees/box.py`    | `box/box.py` | CLI + watchfiles + config |

### Stays in `bees/`

| Module            | What it does                               |
| ----------------- | ------------------------------------------ |
| `scheduler.py`    | Task orchestration, cycle logic            |
| `task_runner.py`  | Metadata bookkeeping (delegates to runner) |
| `task_node.py`    | Per-task state and lifecycle               |
| `task_store.py`   | Task persistence                           |
| `coordination.py` | Cross-task event routing                   |
| `segments.py`     | System instruction assembly                |
| `mutations.py`    | MutationManager                            |
| `bees.py`         | High-level API                             |
| `ticket.py`       | Wire format                                |
| `functions/*.py`  | Function declarations and handlers         |

## Relationship to delegated sessions

This is the same architectural direction as
[delegated-sessions-2.md](./delegated-sessions-2.md), stated as a packaging
concern. Delegated sessions asks: "what if all sessions are delegated?" This
document answers: "then bees has zero model-provider dependencies and is
installable on its own."

The key refinement over delegated-sessions-2 is that **functions stay in bees**.
The earlier draft placed runners and functions together in `bees/runners/`. This
split recognizes that functions are framework capabilities (task creation, event
routing, file I/O) — they're orthogonal to the model provider. A Claude runner
would use the same functions.

## Implications

**`bees` becomes trivially installable.** No C extensions, no heavy
dependencies, no auth configuration. Any Python ≥ 3.11 can `pip install bees`.

**Model providers are pluggable.** Write a `bees-claude`, a `bees-ollama`, a
`bees-mock`. The framework doesn't privilege any provider. Each provider package
contains a runner + an adapter for bees' function protocols.

**Functions are shared.** The function layer is framework infrastructure, not
provider-specific. `tasks_create_task` works the same whether the session is
Gemini streaming, Gemini Live, or Claude.

**`hivetool` is entirely decoupled.** It reads the hive filesystem and writes
mutations. It works with any runner — or no runner at all (read-only observation
of a hive populated by something else entirely).

**Testing simplifies radically.** `bees` tests cover orchestration + function
handlers with a `TestRunner` that returns scripted responses. No Gemini mocking,
no network stubs, no API keys in CI.

## Grounded in code: the import graph

Tracing the actual `opal_backend` imports in `bees/` reveals three categories:

### Clean today (moves to `bees-gemini` wholesale)

`session.py` (940 lines) is where bees and `opal_backend` are deeply entangled.
It imports `new_session`, `start_session`, `resume_session`, `Subscribers`,
`InMemorySessionStore`, `InteractionState` — all `opal_backend` session
internals. It also assembles all function groups and calls `opal_backend`'s
session API directly. This entire file _is_ the `StreamingRunner`.

### Clean today (trivial fix)

`scheduler.py` imports `HttpBackendClient` only for type annotation. Replace
with a protocol or `Any` and it's clean. `task_runner.py` already uses
`backend: Any` — zero `opal_backend` imports.

`box.py` imports `app.auth`, `app.config`, `HttpBackendClient`. All three become
constructor parameters when it moves to its own package.

### The friction: function modules

All 8 function modules import `opal_backend.function_definition` for:

- `FunctionGroup`, `FunctionGroupFactory`, `SessionHooks` (types)
- `assemble_function_group`, `load_declarations` (assembly utilities)

Additionally, `chat.py` and `simple_files.py` import `_make_handlers` from
`opal_backend.functions.*` — these delegate to `opal_backend`'s built-in
handlers for file I/O and chat.

**Resolution**: The tool protocol bridge (above) addresses the type imports. The
`_make_handlers` delegations and `load_declarations`/`assemble_function_group`
utilities need bees-native equivalents or thin wrappers in the protocols module.
Since these are pure data assembly (JSON schema loading + handler map → group),
the extraction is mechanical.

## Open questions

**VFS layer.** `disk_file_system.py` depends on `opal_backend`'s
`FileSystemProtocol`. Same protocol bridge approach applies — define a
bees-native `FileSystem` protocol that mirrors the shape.

**MCP lifecycle.** MCP connections are currently established per-session. Under
the split, bees manages MCP connections as framework infrastructure (since
`mcp_bridge.py` stays in bees). The runner doesn't need to know about MCP.

**`_make_handlers` delegation.** `chat.py` and `simple_files.py` import handler
factories from `opal_backend.functions.*`. These need to either move into bees
(if the logic is framework-level) or be injected by the runner (if they're
provider-specific). Needs investigation.

## Gradual migration

This split follows Spec-Driven Development. Write protocols first, prove them
with conformance tests, then migrate imports.

### Protocol inventory

| Protocol          | Replaces                            | Specified | Tested | Migrated |
| ----------------- | ----------------------------------- | --------- | ------ | -------- |
| `FunctionGroup`   | `opal_backend.FunctionGroup`        | ✅        | ✅     | ✅       |
| `FunctionFactory` | `opal_backend.FunctionGroupFactory` | ✅        | ✅     | ✅       |
| `FunctionHooks`   | `opal_backend.SessionHooks`         | ✅        | ✅     | ✅       |
| `SessionRunner`   | Implicit contract in `session.py`   | Pending   | —      | —        |
| `FileSystem`      | `opal_backend.FileSystemProtocol`   | ✅        | ✅     | ✅       |

See [spec/function-types.md](../spec/function-types.md) for the function types
spec and [spec/filesystem.md](../spec/filesystem.md) for the filesystem types
spec and conformance tests.

### Migration steps

1. Define function protocols in `bees/protocols.py` (mirror `opal_backend`
   shapes).
2. Define `SessionRunner` protocol.
3. Migrate `bees/functions/` to import from `bees/protocols.py`.
4. Create `bees-gemini` with `StreamingRunner` (wraps `session.py` +
   `opal_backend`).
5. Move `box.py` into its own package.
6. Remove `opal_backend` imports from `bees/`.
7. Drop all external deps from `bees/pyproject.toml`.

Each step is independently shippable — the existing code path continues to work
throughout.
