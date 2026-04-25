# The Session Layer

The session layer is the atom of bees. Everything larger — the scheduler, the
task hierarchy, the entire swarm — is built from sessions. A session is one LLM
conversation: a model, a set of tools, a context window, and the machinery to
run turns until the agent is done, stuck, or told to wait.

This document traces how sessions actually work in the code.

## Anatomy of a session

Internally, a session is structured as a sequence of **runs**, and each run is a
sequence of **turns**.

A **turn** is a single model invocation: the system sends a request (system
instruction + conversation history), the model responds with text, function
calls, or both. The turn includes function response round-trips — one "turn"
from the model's perspective may involve multiple tool calls and responses
before the model yields control.

A **run** is a series of turns that ends when one of these conditions is met:

- The model calls `system.objective_fulfilled` or
  `system.failed_to_fulfill_objective` → the session **terminates**.
- The model calls `chat.request_user_input`, `chat.present_choices`, or
  `chat.await_context_update` → the session **suspends**, waiting for external
  input.
- Recurring API errors (e.g. model 503) that persist after exponential backoff →
  the session **pauses** for retry.

When suspended, the session state is persisted so it can be resumed later,
creating a new run.

## Implementation split

The session implementation lives in two places:

| Module                         | Responsibility                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `opal_backend/sessions/api.py` | The agent loop itself: `new_session`, `start_session`, `resume_session`. Handles turn-by-turn model invocation, function dispatch, state persistence.                                |
| `bees/session.py`              | Bees' wrapper. Assembles function groups, wires up the disk-backed file system, manages eval logging, and translates between bees' task model and `opal_backend`'s session protocol. |

From the session layer's perspective, `opal_backend` is an implementation
detail. Consumers of the session layer see a unified surface: call `run_session`
or `resume_session`, get back a `SessionResult`.

### `run_session`

The main entry point. It:

1. Filters skills and merges `allowed-tools` into the function filter.
2. Creates a `DiskFileSystem` backed by the task's working directory.
3. Seeds skill files into the file system.
4. Calls `new_session()` with all function groups and config.
5. Starts the agent loop (`start_session`) and collects events via a subscriber
   queue.
6. Writes structured eval logs at turn boundaries.
7. On suspend or pause, persists session state to `session_state.json`.
8. Returns a `SessionResult` with status, metrics, outcome, and file manifest.

### `resume_session`

Picks up where a suspended or paused session left off:

1. Loads saved state from `session_state.json`.
2. Reconstructs all function groups (file system is already on disk — no seeding
   needed).
3. Restores the interaction state and sets the session to "suspended".
4. Collects any pending context updates (from both `response.json` and
   metadata).
5. Calls `api_resume_session()` with the response and context parts.
6. Event loop and logging proceed identically to `run_session`.

## Function Groups

Functions are the extensibility mechanism for the session layer. Each function
group contains:

1. **Declarations** — JSON schemas and markdown instructions in
   `bees/declarations/`. These define what the model sees: function names,
   parameter types, and behavioral guidance. Three files per group:
   - `{name}.functions.json` — tool schemas
   - `{name}.instruction.md` — system instruction fragment
   - `{name}.metadata.json` — group metadata (name, filter prefix)
2. **Handlers** — Python async functions that execute when the model calls a
   tool. Each handler receives `(args, status_callback)` and returns a dict.
3. **Factory** — A `FunctionGroupFactory` that late-binds handlers at session
   construction time. This is how stateless declarations get wired to stateful
   runtime context (the file system, the scheduler, the scope).

### Two kinds of function groups

- **opal_backend built-ins** — provided by the underlying platform. These
  include `generate.*` (search-grounded text generation, image/video/audio
  generation) and others. Bees passes these through to the session — template
  authors can filter them in or out, but bees doesn't redeclare them.
- **Bees function groups** — defined in `bees/functions/` and
  `bees/declarations/`. Some override opal_backend groups (e.g. `system` and
  `chat` provide bees-specific behavior while keeping the same group name).

The bees function groups:

| Group          | Filter prefix    | Purpose                                                                                                                  |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `system`       | `system.*`       | Termination: `system_objective_fulfilled`, `system_failed_to_fulfill_objective`.                                         |
| `files` | `files.*` | File I/O: `files_write_file`, `files_list_files`, `files_read_text_from_file`.                                        |
| `sandbox`      | `sandbox.*`      | Sandboxed bash execution in the task's working directory.                                                                |
| `chat`         | `chat.*`         | User interaction: `chat_request_user_input`, `chat_present_choices`, `chat_await_context_update`.                        |
| `events`       | `events.*`       | Cross-agent communication: `events_broadcast`, `events_send_to_parent`.                                                  |
| `tasks`        | `tasks.*`        | Task management: `tasks_list_types`, `tasks_create_task`, `tasks_check_status`, `tasks_cancel_task`, `tasks_send_event`. |
| `skills`       | `skills.*`       | Instruction-only: injects a system instruction listing available skills. No callable functions.                          |

### The function filter

Template authors control what an agent can do by specifying `functions` globs on
the template and `allowed-tools` in skill frontmatter. Both are lists of filter
prefixes (e.g. `["system.*", "files.*"]`). The session merges them at
construction time:

```python
# Union skill-declared tools into the template's function filter.
if function_filter is not None and allowed_skills:
    skill_tools.append("skills.*")
    function_filter = list(dict.fromkeys(function_filter + skill_tools))
```

The filter is subtractive: only matched groups are included. An empty/absent
filter means all function groups are available.

## The file system

Each session has a disk-backed file system (`DiskFileSystem` in
`bees/disk_file_system.py`). It satisfies the `FileSystem` protocol from
`opal_backend` by reading and writing directly to a working directory on disk.

Key characteristics:

- **Disk-native**: no in-memory shadow. Files are on the real filesystem, so the
  bash sandbox and the agent's file functions both see the same state.
- **VFS layer for system files**: virtual namespaces (e.g.
  `system/chat_log.json`) use getter functions registered at session setup.
  These are read-only and transient per session.
- **Binary support**: images and other binary files are base64-encoded for the
  model and written as raw bytes to disk.
- **Skill seeding**: skill directories are written to the file system at session
  start so the agent can read them via `files_read_text_from_file`.

## Context window

The context window is the conversation history fed to the model on each turn. It
includes:

- **System instruction** — assembled from the base instruction plus fragments
  from each enabled function group's `instruction.md`.
- **Segments** — structured prompt parts. The initial prompt can be a simple
  text string or a list of typed segments (text, input with LLMContent from
  dependency outcomes).
- **Conversation history** — accumulated model/tool exchanges from previous
  turns.
- **Dynamic steering** — context update parts injected between turns via the
  context queue, enabling the scheduler to push events into a running session.
- **Token caching** — the sessions API handles caching with the model backend.
- **Context window compaction** — planned future work. The session layer is the
  right place for this (e.g. a compaction subagent that summarizes conversation
  history when it grows too large).

## Suspend, resume, and pause

### Suspend

When the model calls a suspend function (`chat.request_user_input`,
`chat.present_choices`, or `chat.await_context_update`), the agent loop raises a
`SuspendError`. The session state is persisted to `session_state.json` in the
task directory:

```json
{
  "session_id": "...",
  "interaction_id": "...",
  "interaction_state": { ... }
}
```

The interaction state contains everything needed to reconstruct the session: the
function call that triggered the suspend, pending function responses, and
conversation checkpoints.

### Resume

On resume, the saved state is loaded, the session infrastructure is
reconstructed (new function groups, same file system), and `resume_session` is
called with the user's response and any pending context updates.

### Pause

Recurring transient API errors (e.g. model 503) that persist after exponential
backoff cause the session to pause rather than fail. The state is persisted
identically to suspend. The scheduler can later retry the session.

## Logging

Every session writes a structured log file via `EvalCollector`. The collector
tracks:

- Per-turn context boundaries (how large the context was at each turn).
- Token usage metadata (prompt, candidates, thoughts, cached).
- Function calls and thoughts.
- Outcome data.
- Suspend/pause events.

Logs are written to `{hive}/logs/` at turn boundaries and on completion. A
`bees-session-latest.log.json` symlink always points to the most recent log.

### Key source files

| File                       | Responsibility                                   |
| -------------------------- | ------------------------------------------------ |
| `bees/session.py`          | Session assembly, run/resume, eval collection    |
| `bees/functions/`          | All bees-specific function group implementations |
| `bees/declarations/`       | Function schemas and instructions                |
| `bees/disk_file_system.py` | Disk-backed VFS adapter                          |
| `bees/context_updates.py`  | Event → context parts formatting                 |

---

## Gaps

Code changes needed to reconcile the session layer with the aspirational
architecture in `docs/architecture/index.md`.

### `skills.*` group exists only as a workaround

The `skills` function group has no callable functions — it exists solely to
inject a system instruction fragment listing available skills. This works but is
architecturally leaky: there is no reason a system instruction should require a
function group wrapper.

**Gap**: The session layer needs a mechanism to inject system instruction
fragments independently of function groups. Once that exists, the `skills.*`
group can be removed.

### Function naming: dots vs. underscores

The architecture doc uses dot notation (`system.objective_fulfilled`) for both
filter prefixes and function names. In practice, filter prefixes use dots
(`system.*`) but actual function names use underscores
(`system_objective_fulfilled`) because the Gemini API does not support dots in
function names.

This substitution is currently visible to users — template authors write
`system.*` in filters but see `system_objective_fulfilled` in logs and
responses.

**Gap**: The dot↔underscore substitution should be invisible to the user.
Function names displayed in the architecture doc should be the names users see
everywhere. This likely requires a transparent translation layer at the
declaration/dispatch boundary.
