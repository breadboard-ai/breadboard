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

| Package           | What it is                    | External deps                       |
| ----------------- | ----------------------------- | ----------------------------------- |
| **`bees`**        | Orchestration library + tools | None (stdlib only)                  |
| **`bees-gemini`** | Gemini model provider         | `google-genai`, `httpx`             |
| **`box`**         | Filesystem-driven CLI runner  | `bees`, `bees-gemini`, `watchfiles` |
| **`app`**         | Reference web application     | `bees`, `bees-gemini`, `fastapi`    |

The key refinement: functions (tool declarations + handlers) stay in `bees` as
framework capabilities. They're orthogonal to the model provider.

### Progress

The library extraction follows [Spec-Driven Development](../spec/). Each
protocol is specified, tested for conformance, then migrated.

**Function types** ([spec](../spec/function-types.md)) — ✅ complete. Bees-native
copies of `FunctionGroup`, `FunctionDefinition`, `SessionHooks`,
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

**Remaining protocols** from the [package-split inventory](./package-split.md):

| Protocol        | Status  |
| --------------- | ------- |
| `SessionRunner` | Pending |

**Remaining `opal_backend` imports** in `bees/` after the three completed
migrations:

| Module             | Imports                                                    | Category           |
| ------------------ | ---------------------------------------------------------- | ------------------ |
| `session.py`       | Session runtime (`new_session`, `start_session`, stores…)  | SessionRunner      |
| `scheduler.py`     | `HttpBackendClient` (type annotation only)                 | SessionRunner      |
| `box.py`           | `HttpBackendClient`, `app.auth`, `app.config`              | SessionRunner      |
| `functions/chat.py`| `_make_handlers`, `CONTEXT_PARTS_KEY`, `ChatEntryCallback`, `SuspendError` | Handler delegation |
| `functions/simple_files.py` | `_make_handlers`                                  | Handler delegation |
| `functions/system.py`       | `_make_handlers`                                  | Handler delegation |

The "SessionRunner" category disappears when `session.py` moves to
`bees-gemini`. The "Handler delegation" category decomposes into two remaining
specs: **handler types** (bees-native copies of `SuspendError`, suspend event
types, `AgentResult`, `SessionTerminator` protocol, constants) and **handler
bodies** (inlining `_make_handlers` using bees-native pidgin + handler types).

## The Consumption API

With the library extraction as the goal, three sub-problems need to
crystallize.

### The Interaction Surface

The controller side of the MVC model (see
[patterns.md](./patterns.md#the-controller-in-progress)) is evolving. The
[mutations system](./mutations.md) provides an atomic interaction model for
the filesystem-based hive. The library API should make responding to suspended
tasks and creating task groups first-class operations on `Bees` or `TaskNode`.

### The Observation API

`SchedulerHooks` is a bag of callbacks with no lifecycle contract. It's
invasive — the hooks reach deep into the scheduler's internals — and it only
supports one consumer.

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
