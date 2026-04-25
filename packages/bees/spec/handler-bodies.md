# Handler Bodies — Spec Doc

**Goal**: Inline the handler bodies from `opal_backend`'s `_make_handlers` into
bees' three function modules — eliminating the last `opal_backend` imports from
the function layer.

## Context

Three bees function modules delegate handler construction to opal_backend:

```python
# system.py, files.py
from opal_backend.functions.system import _make_handlers

# chat.py
from opal_backend.functions.chat import _make_handlers
```

All _type_ dependencies are already extracted (function types, filesystem,
handler types, pidgin). What remains is the handler _logic_ — the async
functions inside each `_make_handlers`.

## Design Decisions

### TaskTreeManager stays in opal_backend

The task tree (`system_create_task_tree`, `system_mark_completed_tasks`) is an
opal_backend concern. Bees does not need it. Concretely:

- The system `_make_handlers` builds 7 handlers. Bees' declarations only expose
  the 2 termination functions. The task tree and file operation handlers from
  system.py are **not copied**.
- The chat `_make_handlers` calls `task_tree_manager.set_in_progress()` at the
  top of both handlers. These calls are **dropped** in the bees versions.
- `SessionHooks.task_tree_manager` remains in the protocol for now (opal still
  passes it), but no bees handler references it.

### File operations come from the system module, not files

The upstream `files.py` calls the _system_ module's `_make_handlers` for
its file operation handlers (`files_write_file`, `files_read_text_from_file`,
`files_list_files`). Bees inlines these directly — no intermediate delegation.

### Handler signatures are preserved

Each handler has the signature `async (args: dict, status_cb: Any) -> dict`.
This matches `FunctionHandler` from `bees.protocols.functions`. The inlined code
preserves this contract.

### Bees pidgin replaces opal pidgin

The upstream handlers call `opal_backend.pidgin.from_pidgin_string`. The inlined
versions call `bees.pidgin.from_pidgin_string` — same API, different import.

### Constants are copied alongside their handlers

Each module has a handful of constants (function name strings, validation lists,
format maps). These are copied into the bees module that uses them. They're
private implementation details, not protocol types.

## Inventory

| Item               | Module            | What to inline                                                         | Status      |
| ------------------ | ----------------- | ---------------------------------------------------------------------- | ----------- |
| System termination | `system.py`       | `system_objective_fulfilled`, `system_failed_to_fulfill_objective`     | ✅ Complete |
| Chat suspend       | `chat.py`         | `chat_request_user_input`, `chat_present_choices`                      | ✅ Complete |
| File operations    | `files.py` | `files_write_file`, `files_read_text_from_file`, `files_list_files` | ✅ Complete |

## Handler Sketches

### System termination handlers (`system.py`)

Source: `opal_backend/functions/system.py` L58–230 (only the 2 termination
handlers).

Dependencies (all bees-native):

- `bees.protocols.handler_types.AgentResult`
- `bees.protocols.handler_types.FileData`
- `bees.protocols.handler_types.SessionTerminator` (via `hooks.controller`)
- `bees.protocols.filesystem.FileSystem` (via `hooks.file_system`)
- `bees.pidgin.from_pidgin_string`

`system_objective_fulfilled`:

- Resolves href via `file_system.get_original_route(href)`
- Resolves pidgin in outcome text via `from_pidgin_string`
- Collects intermediate files from the file system
- Calls `controller.terminate(AgentResult(success=True, ...))`

`system_failed_to_fulfill_objective`:

- Calls `controller.terminate(AgentResult(success=False, ...))`

Note: the upstream `success_callback` / `failure_callback` params are **not
copied**. They exist for opal's routing layer. Bees only uses the termination
path.

### Chat suspend handlers (`chat.py`)

Source: `opal_backend/functions/chat.py` L70–178.

Dependencies (all bees-native):

- `bees.protocols.handler_types.SuspendError`
- `bees.protocols.handler_types.WaitForInputEvent`
- `bees.protocols.handler_types.WaitForChoiceEvent`
- `bees.protocols.handler_types.ChoiceItem`
- `bees.protocols.handler_types.ChatEntryCallback`
- `bees.protocols.filesystem.FileSystem` (via `hooks.file_system`)
- `bees.pidgin.from_pidgin_string`

`chat_request_user_input`:

- Resolves pidgin in user_message via `from_pidgin_string`
- Constructs `WaitForInputEvent`
- Calls `on_chat_entry("agent", user_message)` if set
- Raises `SuspendError(event, function_call_part)`

`chat_present_choices`:

- Resolves pidgin in user_message and choice labels
- Constructs `WaitForChoiceEvent` with `ChoiceItem` list
- Calls `on_chat_entry("agent", user_message)` if set
- Raises `SuspendError(event, function_call_part)`

Dropped from upstream: `task_tree_manager.set_in_progress(task_id, "")` calls.

Constants to copy:

- `CHAT_REQUEST_USER_INPUT`, `CHAT_PRESENT_CHOICES` (function name strings)
- `VALID_INPUT_TYPES`, `VALID_SELECTION_MODES`, `VALID_LAYOUTS`
- `_INPUT_TYPE_TO_FORMAT` (input type → icon mapping)

### File operation handlers (`files.py`)

Source: `opal_backend/functions/system.py` L154–197 (the file subset).

Dependencies (all bees-native):

- `bees.protocols.filesystem.FileSystem` (via `hooks.file_system`)
- `bees.pidgin.from_pidgin_string`

`files_list_files`:

- Calls `file_system.list_files()`

`files_write_file`:

- Resolves pidgin in content via `from_pidgin_string`
- Extracts text parts from resolved content
- Calls `file_system.write(file_name, resolved_content)`

`files_read_text_from_file`:

- Calls `file_system.read_text(file_path)`

Note: bees already has a local `_make_list_dir_handler` in `files.py`.
This is additive — the inlined opal handlers sit alongside it.

## Migration Notes

### Execution order

Start with `system.py` — fewest handlers, simplest logic, proves the pattern.
Then `chat.py` — adds suspend/resume complexity. Then `files.py` — the
file operations.

### What changes in each file

For each file, the migration is:

1. **Delete** the `from opal_backend.functions.X import _make_handlers` line.
2. **Add** imports from `bees.protocols` and `bees.pidgin`.
3. **Add** a local `_make_handlers` function with the inlined handler bodies (or
   inline directly into the factory — whichever reads better).
4. **Verify** the existing tests still pass.

### What does NOT change

- The factory signatures (`get_*_function_group_factory`)
- The `SessionHooks` protocol
- The `assemble_function_group` call
- The loaded declarations
- The bees-local wrappers in `chat.py` (`chat_await_context_update`)

### After this spec

The `from opal_backend` imports that remain in `bees/` are all in the
"SessionRunner" category (`session.py`, `scheduler.py`, `box.py`). Those move to
`gemini-runners` as part of the package split — a separate spec.

## Verification Plan

### Automated tests

```bash
npm run test -w packages/bees
```

All existing function module tests must pass without modification. The handlers
are identical — only the import source changes.

### Manual verification

A full run of the bees scheduler with an agent that exercises:

- Termination (objective fulfilled with file references)
- Chat input (request user input, present choices)
- File operations (write, read, list)

### Structural check

After migration, verify:

```bash
grep -r "from opal_backend" packages/bees/bees/functions/
```

Should return **zero** results.
