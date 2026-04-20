# Future Direction

Short- to medium-term work needed to close gaps in the framework and bring about
the vision described in [architecture.md](./architecture.md). Each concept doc
explores a specific axis of the design space.

## The Library Extraction

The central architectural question: how does bees become a clean, installable
library that applications `import` rather than fork?

Three concept docs trace the path:

### [Delegated Sessions](./delegated-sessions.md)

What if session execution is owned by an external party rather than the
scheduler? The motivating use case is the Gemini Live API, but the insight
generalizes.

### [Delegated Sessions — The General Case](./delegated-sessions-2.md)

What if _all_ sessions are delegated? Bees becomes a pure orchestration and
tooling framework. Auth drops out of the core. Testing simplifies. The
`SessionRunner` protocol emerges as the key abstraction.

### [Package Split](./package-split.md)

The delegated sessions insight, stated as a packaging concern. Four packages:

| Package              | What it is                    | External deps                          |
| -------------------- | ----------------------------- | -------------------------------------- |
| **`bees`**           | Orchestration library + tools | None (stdlib only)                     |
| **`gemini-runners`** | Gemini model provider         | `google-genai`, `httpx`                |
| **`box`**            | Filesystem-driven CLI runner  | `bees`, `gemini-runners`, `watchfiles` |
| **`app`**            | Reference web application     | `bees`, `gemini-runners`, `fastapi`    |

The key refinement: functions (tool declarations + handlers) stay in `bees` as
framework capabilities. They're orthogonal to the model provider.

### Progress

The library extraction follows [Spec-Driven Development](../spec/). Each
protocol is specified, tested for conformance, then migrated.

**Function types** ([spec](../spec/function-types.md)) — ✅ complete.
Bees-native copies of `FunctionGroup`, `FunctionDefinition`, `SessionHooks`,
`load_declarations`, and `assemble_function_group` live in
`bees/protocols/functions.py`. All 8 function modules now import from
`bees.protocols` instead of `opal_backend.function_definition`. Remaining
`opal_backend` imports in `chat.py`, `simple_files.py`, and `system.py` are
handler-level (`_make_handlers`) — a separate spec.

**FileSystem types** ([spec](../spec/filesystem.md)) — ✅ complete. Bees-native
copies of `FileSystem`, `FileDescriptor`, `FileSystemSnapshot`,
`SystemFileGetter`, `file_descriptor_to_part`, and constants live in
`bees/protocols/filesystem.py`. `disk_file_system.py` now imports from
`bees.protocols` instead of `opal_backend.file_system_protocol`.

**Pidgin** ([spec](../spec/pidgin.md)) — ✅ complete. Bees-native copies of
`from_pidgin_string` and `merge_text_parts` live in `bees/pidgin.py`. These
resolve pidgin markup (`<file>`, `<a>` tags) in agent output back to data parts
from the file system. Prerequisite for inlining handler bodies.

**Handler types** ([spec](../spec/handler-types.md)) — ✅ complete. Bees-native
copies of `SuspendError`, `WaitForInputEvent`, `WaitForChoiceEvent`,
`ChoiceItem`, `AgentResult`, `FileData`, `SessionTerminator` protocol,
`CONTEXT_PARTS_KEY`, and `ChatEntryCallback` live in
`bees/protocols/handler_types.py`. These are the types that function handlers
use for suspend/resume, session termination, and context injection.

**Handler bodies** ([spec](../spec/handler-bodies.md)) — ✅ complete. Handler
logic from `opal_backend.functions.{chat,system}._make_handlers` is inlined into
bees' three function modules (`system.py`, `chat.py`, `simple_files.py`). All
imports come from `bees.protocols` and `bees.pidgin`. Task tree management
(`TaskTreeManager`, `set_in_progress` calls) stays in opal_backend — it's not a
bees concern. The `bees/functions/` directory has **zero** `opal_backend`
imports.

> **Transitional back-imports.** Two types in `bees/protocols/handler_types.py`
> subclass their `opal_backend` counterparts:
>
> | Bees type      | Inherits from                       | Why                                  |
> | -------------- | ----------------------------------- | ------------------------------------ |
> | `SuspendError` | `opal_backend.suspend.SuspendError` | Session loop catches via `except`    |
> | `AgentResult`  | `opal_backend.events.AgentResult`   | Session loop checks via `isinstance` |
>
> The session loop (`opal_backend/run.py`) uses `except SuspendError` and
> `isinstance(result, AgentResult)` with opal's classes. Until the loop moves to
> `gemini-runners`, bees' versions must inherit so these checks pass. Both
> imports are removed when the session loop migrates.

**Session observation types** ([spec](../spec/session-observation.md)) — ✅
complete. Bees-native copies of `SUSPEND_TYPES` and `PAUSE_TYPES` live in
`bees/protocols/session.py`. `SessionResult` relocated from `session.py` to
`bees/protocols/session.py`. `session.py` re-exports `SessionResult` for
backward compatibility. `task_runner.py`, `scheduler.py`, and tests now import
`SessionResult` from `bees.protocols.session`. `EvalCollector` and
`_print_event_summary` are now fully opal-free.

**Session configuration** ([spec](../spec/session-configuration.md)) — ✅
complete. `SessionConfiguration` (provisioning output), `SessionStream` (async
iterable event stream with back-channel), and `SessionEvent` (type alias) are
specified and tested in `bees/protocols/session.py`. The `provision_session`
function in `bees/provisioner.py` extracts provisioning logic from
`run_session()` and `resume_session()`, both of which now delegate to it.
`session.py`'s remaining imports are purely execution (opal_backend session API)
— ready for the `SessionRunner` migration.

**SessionRunner** ([spec](../spec/session-runner.md)) — ✅ specified + tested.
`SessionRunner` protocol, `drain_session` composition function, and opaque
resume state persistence (`save_resume_state` / `load_resume_state` /
`clear_resume_state`) live in `bees/protocols/session.py` and `bees/session.py`.

### Migration phases

With all protocols specified, the remaining work is the **migration** — creating
the concrete `GeminiRunner`, rewiring consumers, and removing dead code. Each
phase is independently shippable.

| #   | Spec                     | What changes                                                                                                                             | Status |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | `gemini-runner`          | `GeminiRunner` + `GeminiStream` in `bees/runners/gemini.py`. Wraps opal session API.                                                     | ✅     |
| 2   | `runner-migration`       | `TaskRunner` / `Scheduler` / `Bees` accept `SessionRunner`. `box.py` constructs `GeminiRunner`. Uses `runner.run()` + `drain_session()`. | ✅     |
| 3   | `session-cleanup`        | Remove `run_session`, `resume_session`, legacy state, dead imports from `session.py`.                                                    | ✅     |
| 4   | `gemini-runners-package` | Move runner to `gemini-runners` package. Zero `opal_backend` imports in `bees/`.                                                         | —      |

**Phase 1** is pure additive code — nothing breaks. Phase 2 is the full
substitution from construction (`box.py`) to consumption (`TaskRunner`). Phase 3
is deletion. Phase 4 is the payoff.

**Remaining `opal_backend` imports** in `bees/`:

| Module             | Imports                                                   | Removed in |
| ------------------ | --------------------------------------------------------- | ---------- |
| `box.py`           | `HttpBackendClient`, `app.auth`, `app.config`             | Phase 4    |
| `handler_types.py` | Transitional back-imports (`SuspendError`, `AgentResult`) | Phase 4    |

## The Consumption API

With the library extraction as the goal, three sub-problems need to crystallize.

### The Interaction Surface

The controller side of the MVC model (see
[patterns.md](./patterns.md#the-controller-in-progress)) is evolving. The
[mutations system](./mutations.md) provides an atomic interaction model for the
filesystem-based hive. The library API should make responding to suspended tasks
and creating task groups first-class operations on `Bees` or `TaskNode`.

### The Observation API

`SchedulerHooks` is a bag of callbacks with no lifecycle contract. It's invasive
— the hooks reach deep into the scheduler's internals — and it only supports one
consumer.

**Direction**: The observation API should support multiple observers, provide a
typed event stream rather than positional callbacks, and cleanly separate
read-only observation from write-side interaction. The reference app's SSE
`Broadcaster` is evidence of the pattern — it already fans out to multiple
clients. The framework should do the same at the scheduler level.

### Hive Abstraction

The hive is currently hard-coded to the filesystem. The
[patterns.md](./patterns.md#the-directory-as-universal-interchange) vision
describes the hive directory as a "universal interchange." The task store needs
a protocol with at least two implementations:

- **Disk** — what exists today. The local development and hivetool story.
- **Database** — for production. Tasks persist in a database; the filesystem
  layer may be backed by object storage.

The configuration surface (templates, skills, system config) can remain
file-based — it's the task runtime state that needs to scale.

## Further out

Speculative, ambitious, and less well-defined ideas live in
[tea-leaves.md](./tea-leaves.md).
