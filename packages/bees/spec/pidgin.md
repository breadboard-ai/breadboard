# Pidgin — Spec Doc

**Goal**: Create a bees-native copy of the pidgin resolution utilities —
`from_pidgin_string` and `merge_text_parts` — so that bees' function handlers
can resolve pidgin markup without importing from `opal_backend`. The opal
originals are untouched.

## Context

Pidgin is a micro-language (`<file src="..." />`, `<a href="...">`, `<content>`,
`<asset>`) for passing files around in LLM context. The model writes pidgin
markup in its outputs (e.g. referencing a file it created), and function
handlers call `from_pidgin_string` to resolve those tags back to data parts from
the file system.

Today, three bees function modules (`chat.py`, `system.py`, `files.py`)
delegate to `opal_backend`'s `_make_handlers`, which internally calls
`from_pidgin_string`. To eventually inline those handler bodies into bees
(eliminating the `_make_handlers` imports), bees needs its own pidgin
resolution.

**This spec extracts pidgin as an independent step.** The handler inlining is a
separate, later spec that builds on this one.

## Design Decisions

### Only `from_pidgin_string` direction

The opal pidgin module has two directions:

- `to_pidgin` — segments → pidgin text (used during prompt assembly)
- `from_pidgin_string` — pidgin text → data parts (used by handlers)

Bees only needs `from_pidgin_string` for now. The `to_pidgin` direction is used
during session setup in `session.py`, which is in the `SessionRunner` category
and will move to `gemini-runners`. No need to copy it.

### Verbatim copy, different import

The bees version is a verbatim copy of the opal version with one change: it
imports `FileSystem` from `bees.protocols.filesystem` instead of
`opal_backend.file_system_protocol`. The logic (regex patterns, tag parsing,
text merging) is identical.

### `merge_text_parts` comes along

`merge_text_parts` is a pure helper called by `from_pidgin_string`. It has no
external dependencies — it just merges consecutive text parts in a list. It
belongs in the same module.

### No new concepts

Both functions already exist in `opal_backend.pidgin`. The bees copies mirror
them exactly. Python's structural subtyping means bees' `FileSystem` protocol is
satisfied by both `DiskFileSystem` and opal's `AgentFileSystem` — the same
function works with either.

## Protocol Inventory

| Function / Constant  | Replaces                                 | Specified | Tested | Migrated |
| -------------------- | ---------------------------------------- | --------- | ------ | -------- |
| `from_pidgin_string` | `opal_backend.pidgin.from_pidgin_string` | ✅        | ✅     | ✅       |
| `merge_text_parts`   | `opal_backend.pidgin.merge_text_parts`   | ✅        | ✅     | ✅       |

## Protocol Shapes

### `from_pidgin_string`

```python
async def from_pidgin_string(
    content: str, file_system: FileSystem,
) -> dict[str, Any]:
    """Resolve pidgin markup in a string to data parts.

    Parses ``<file src="..." />`` tags, resolves them via the file
    system, and returns an LLMContent dict with merged text parts.
    Also parses ``<a href="...">title</a>`` link tags, extracting
    just the title text.

    Returns:
        ``{"parts": [...], "role": "user"}`` on success,
        or ``{"$error": "..."}`` on failure.
    """
```

Depends on:

- `FileSystem` protocol (from `bees.protocols.filesystem`) — for `get()` calls
  to resolve file references

Internal constants (copied verbatim):

- `_SPLIT_REGEX` — splits pidgin text into segments
- `_FILE_PARSE_REGEX` — matches `<file src="..." />`
- `_LINK_PARSE_REGEX` — matches `<a href="...">title</a>`

### `merge_text_parts`

```python
def merge_text_parts(
    parts: list[dict[str, Any]], separator: str = "\n",
) -> list[dict[str, Any]]:
    """Merge consecutive text parts into a single text part.

    Non-text parts (inlineData, fileData, etc.) are left as-is.
    """
```

Pure function. No dependencies.

## Migration Notes

### Target file

`bees/pidgin.py` — new module, alongside the existing `bees/protocols/` package.

### Import change (for future handler inlining)

When handlers are later inlined into bees, they'll import:

```diff
-from opal_backend.pidgin import from_pidgin_string
+from bees.pidgin import from_pidgin_string
```

This spec doesn't change any existing imports — it just creates the module. The
handler inlining spec will do the import rewrite.

### Conformance testing strategy

1. **Behavioral conformance**: verify bees' `from_pidgin_string` produces the
   same output as opal's for identical inputs — plain text, `<file>` tags, `<a>`
   tags, mixed content, error cases.
2. **`merge_text_parts` conformance**: verify identical merging behavior —
   consecutive text parts merged, non-text parts preserved, separator applied.
3. **Regex conformance**: verify the split/parse patterns match the same strings
   as opal's.

### What this enables

With `bees/pidgin.py` in place, the handler delegation work decomposes into two
remaining specs:

1. **Handler types** — bees-native copies of `SuspendError`, suspend event types
   (`WaitForInputEvent`, `WaitForChoiceEvent`, `ChoiceItem`), `AgentResult`,
   `FileData`, `SessionTerminator` protocol, `CONTEXT_PARTS_KEY`,
   `ChatEntryCallback`.
2. **Handler bodies** — inline `_make_handlers` from
   `opal_backend.functions.chat` and `opal_backend.functions.system` into bees,
   using bees-native pidgin + handler types. This is the step that actually
   eliminates the `opal_backend` imports from `bees/functions/`.
