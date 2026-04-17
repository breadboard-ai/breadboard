# FileSystem Types — Spec Doc

**Goal**: Define bees-native copies of the `FileSystem` protocol and its
supporting types — eliminating the `opal_backend.file_system_protocol` import
from `bees/disk_file_system.py`.

## Design Decisions

### Mirror the full opal shape

The bees-native `FileSystem` protocol mirrors every method on
`opal_backend.file_system_protocol.FileSystem` — including `add_route`,
`get_original_route`, `get_file_url`, and `snapshot`, even though
`DiskFileSystem` stubs some of them. This preserves structural compatibility
with opal's `AgentFileSystem` and follows the "mirror, then evolve" principle.
A future pass can slim the protocol once the import boundary exists.

### Supporting types move wholesale

`FileDescriptor`, `FileSystemSnapshot`, `SystemFileGetter`, and
`file_descriptor_to_part` are pure data / pure functions with no
model-provider logic. They're used directly by `DiskFileSystem` for file
serialization, snapshot capture, and system file registration. The bees copies
are verbatim ports.

### Constants move too

`KNOWN_TYPES`, `DEFAULT_EXTENSION`, and `DEFAULT_MIME_TYPE` are used by
`DiskFileSystem` for filename generation and MIME type fallbacks. They're
string constants with no external coupling.

### `file_descriptor_to_part` is unused in `disk_file_system.py`

`disk_file_system.py` imports `file_descriptor_to_part` but never calls it.
The migration should drop this dead import rather than carry it forward. The
function still belongs in the bees protocol module (it operates on
`FileDescriptor`, which bees now owns), but the import is dead code.

### Tightens `SessionHooks.file_system` typing

The function types spec left `SessionHooks.file_system` typed as `Any`
because the `FileSystem` protocol didn't exist in bees yet. This migration
enables tightening that to `FileSystem` — connecting the two protocol
boundaries. This is a follow-up step, not part of the core migration.

### MIME type registration is infrastructure

The opal module calls `mimetypes.add_type()` at module level to register
`.md` and `.csv`. This side effect moves into the bees protocol module
since `DiskFileSystem` depends on these registrations.

## Protocol Inventory

| Type / Function         | Replaces                                    | Specified | Tested | Migrated |
| ----------------------- | ------------------------------------------- | --------- | ------ | -------- |
| `FileSystem`            | `opal_backend.file_system_protocol.FileSystem` | ✅      | ✅     | ✅       |
| `FileDescriptor`        | `opal_backend.file_system_protocol.FileDescriptor` | ✅  | ✅     | ✅       |
| `FileSystemSnapshot`    | `opal_backend.file_system_protocol.FileSystemSnapshot` | ✅ | ✅  | ✅       |
| `SystemFileGetter`      | `opal_backend.file_system_protocol.SystemFileGetter` | ✅ | ✅    | ✅       |
| `file_descriptor_to_part` | `opal_backend.file_system_protocol.file_descriptor_to_part` | ✅ | ✅ | ✅  |
| `DEFAULT_EXTENSION`     | `opal_backend.file_system_protocol.DEFAULT_EXTENSION` | ✅ | ✅    | ✅       |
| `DEFAULT_MIME_TYPE`     | `opal_backend.file_system_protocol.DEFAULT_MIME_TYPE` | ✅ | ✅    | ✅       |
| `KNOWN_TYPES`           | `opal_backend.file_system_protocol.KNOWN_TYPES` | ✅     | ✅     | ✅       |

## Protocol Shapes

### `FileSystem`

Runtime-checkable protocol with these methods:

- `add_system_file(path: str, getter: SystemFileGetter) -> None`
- `overwrite(name: str, data: str) -> str`
- `write(name: str, data: str) -> str`
- `append(path: str, data: str) -> dict[str, str] | None`
- `async read_text(path: str) -> str | dict[str, str]`
- `async get(path: str) -> list[dict[str, Any]] | dict[str, str]`
- `async get_many(paths: list[str]) -> list[dict[str, Any]] | dict[str, str]`
- `async list_files() -> str`
- `get_file_url(maybe_path: str) -> str | None`
- `add_part(part: dict[str, Any], file_name: str | None = None) -> str | dict[str, str]`
- `add_route(original_route: str) -> str`
- `get_original_route(route_name: str) -> str | dict[str, str]`
- `files -> dict[str, FileDescriptor]` (property)
- `snapshot -> FileSystemSnapshot` (property)

### `FileDescriptor`

Dataclass:

- `data: str`
- `mime_type: str`
- `type: str` — one of `"text"`, `"inlineData"`, `"fileData"`, `"storedData"`
- `title: str | None = None`
- `resource_key: str | None = None`

### `FileSystemSnapshot`

Dataclass:

- `files: dict[str, FileDescriptor]`
- `routes: dict[str, str]`
- `file_count: int`

### `SystemFileGetter`

Type alias: `Callable[[], str | dict[str, str]]`

### `file_descriptor_to_part(file: FileDescriptor) -> dict[str, Any]`

Pure function. Converts a `FileDescriptor` to a Gemini data part dict.
Handles `fileData`, `inlineData`, `storedData`, and text types.

### Constants

- `KNOWN_TYPES = ["audio", "video", "image", "text"]`
- `DEFAULT_EXTENSION = "txt"`
- `DEFAULT_MIME_TYPE = "text/plain"`

## Migration Notes

### Import rewrite

`disk_file_system.py` replaces:

```diff
-from opal_backend.file_system_protocol import (
-    FileDescriptor,
-    FileSystemSnapshot,
-    SystemFileGetter,
-    file_descriptor_to_part,
-    DEFAULT_EXTENSION,
-    DEFAULT_MIME_TYPE,
-    KNOWN_TYPES,
-)
+from bees.protocols.filesystem import (
+    FileDescriptor,
+    FileSystemSnapshot,
+    SystemFileGetter,
+    DEFAULT_EXTENSION,
+    DEFAULT_MIME_TYPE,
+    KNOWN_TYPES,
+)
```

Note: `file_descriptor_to_part` is dropped — it's imported but never used in
`disk_file_system.py`.

### `session.py` compatibility

`session.py` passes `DiskFileSystem` instances to `opal_backend`'s
`new_session()` as the `file_system` parameter. Since `DiskFileSystem`
satisfies both opal's `FileSystem` protocol and bees' `FileSystem` protocol
structurally, this continues to work — the migration only changes where
`DiskFileSystem` gets its supporting types, not its shape.

### Remaining `opal_backend` imports after migration

After this migration, `disk_file_system.py` will have zero `opal_backend`
imports. The docstring reference to opal should be updated.

The broader `opal_backend` import inventory in `bees/` becomes:

- `session.py` — session runtime (out of scope, covered by `SessionRunner`)
- `scheduler.py` — `HttpBackendClient` type annotation only
- `box.py` — `HttpBackendClient` + app config
- `functions/chat.py` — `_make_handlers`, `CONTEXT_PARTS_KEY`,
  `ChatEntryCallback`, `SuspendError`
- `functions/simple_files.py` — `_make_handlers`
- `functions/system.py` — `_make_handlers`

### Follow-up: tighten `SessionHooks.file_system`

Once `FileSystem` lives in `bees.protocols`, `SessionHooks.file_system` can
be tightened from `Any` to `FileSystem`. This is a one-line change in
`bees/protocols/functions.py` with a new import. It's a natural follow-up
but intentionally separate — the core migration should land first.
