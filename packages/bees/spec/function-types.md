# Function Types — Spec Doc

**Goal**: Define bees-native types and utilities for function declaration,
assembly, and dispatch — eliminating all `opal_backend.function_definition`
imports from `bees/functions/`.

## Design Decisions

### Mirror, don't abstract

The bees-native types are structural copies of `opal_backend.function_definition`
types. Same field names, same shapes. This ensures:

- Existing `opal_backend` types satisfy the bees types via structural subtyping.
- The migration is a series of import rewrites, not logic changes.
- `session.py` (which stays coupled to `opal_backend` for now) continues to work
  because it consumes function groups by structure, not by identity.

### Utilities move wholesale

`load_declarations` and `assemble_function_group` are pure data assembly — they
load JSON from disk and build dataclasses. They contain no model-provider logic.
Every bees function module already passes `bees/declarations/` as the directory,
bypassing opal's default. The bees copies are verbatim ports with one change:
they return bees-native types.

### `SessionHooks` is structurally minimal

Bees' function modules accept `SessionHooks` in their factory signatures but
never use it (dependencies come through closure). The bees-native `SessionHooks`
mirrors opal's shape with `Any`-typed properties. A richer `FileSystem` protocol
is a separate spec (see inventory).

### `_make_handlers` delegation is out of scope

`chat.py`, `simple_files.py`, and `system.py` import `_make_handlers` from
`opal_backend.functions.*`. These are handler factories that delegate to
opal-owned implementations (file I/O helpers, chat control). They're a separate
concern — either the logic migrates into bees (if framework-level) or gets
injected by the runner (if provider-specific). This spec covers only the type
and assembly layer.

### `CONTEXT_PARTS_KEY` is out of scope

`chat.py` imports a string constant from `opal_backend.function_caller`. This
is a single-use constant that can be inlined or moved in the migration step.
Not worth a protocol.

## Protocol Inventory

| Protocol / Type       | Replaces                            | Specified | Tested  | Migrated |
| --------------------- | ----------------------------------- | --------- | ------- | -------- |
| `FunctionGroup`       | `opal_backend.FunctionGroup`        | ✅        | ✅      | ✅       |
| `FunctionDefinition`  | `opal_backend.FunctionDefinition`   | ✅        | ✅      | ✅       |
| `FunctionGroupFactory`| `opal_backend.FunctionGroupFactory` | ✅        | ✅      | ✅       |
| `SessionHooks`        | `opal_backend.SessionHooks`         | ✅        | ✅      | ✅       |
| `LoadedDeclarations`  | `opal_backend.LoadedDeclarations`   | ✅        | ✅      | ✅       |
| `load_declarations`   | `opal_backend.load_declarations`    | ✅        | ✅      | ✅       |
| `assemble_function_group` | `opal_backend.assemble_function_group` | ✅ | ✅  | ✅       |

## Protocol Shapes

### `FunctionGroup`

Dataclass inheriting from `MappedDefinitions`:

- `definitions: list[tuple[str, FunctionDefinition]]` — name + handler pairs
- `declarations: list[dict[str, Any]]` — Gemini-format JSON schemas
- `name: str | None` — group identifier for filtering
- `instruction: str | None` — system instruction fragment

### `FunctionDefinition`

Dataclass:

- `name: str`
- `description: str`
- `handler: FunctionHandler` — `async (args, status_cb) -> dict`
- `precondition: PreconditionHandler | None`
- `parameters_json_schema: dict | None`
- `response_json_schema: dict | None`
- `icon: str | None`
- `title: str | None`

### `SessionHooks`

Protocol (runtime-checkable):

- `controller -> Any`
- `file_system -> Any`
- `task_tree_manager -> Any`

### `FunctionGroupFactory`

Type alias: `Callable[[SessionHooks], FunctionGroup]`

### `load_declarations(group, *, declarations_dir) -> LoadedDeclarations`

Reads `{group}.functions.json`, `{group}.metadata.json`,
`{group}.instruction.md` from the declarations directory.

### `assemble_function_group(loaded, handlers, ...) -> FunctionGroup`

Joins loaded declarations with handler map. Only declarations with matching
handlers are included.

## Migration Notes

### Import rewrite

Every function module replaces:

```diff
-from opal_backend.function_definition import (
-    FunctionGroup,
-    SessionHooks,
-    assemble_function_group,
-    load_declarations,
-    FunctionGroupFactory,
-)
+from bees.protocols.functions import (
+    FunctionGroup,
+    SessionHooks,
+    assemble_function_group,
+    load_declarations,
+    FunctionGroupFactory,
+)
```

### Remaining opal imports after migration

After this migration, the following `opal_backend` imports will remain in
`bees/functions/`:

- `chat.py`: `CONTEXT_PARTS_KEY`, `_make_handlers`, `ChatEntryCallback`,
  `SuspendError`
- `simple_files.py`: `_make_handlers`
- `system.py`: `_make_handlers`

These are a separate migration covered by a future spec.

### `session.py` compatibility

`session.py` calls the factory functions and passes the returned groups to
`opal_backend`'s session API. Since the bees `FunctionGroup` has the same
fields as opal's `FunctionGroup`, and opal's session API reads groups by
attribute (not `isinstance`), the migration is transparent.
