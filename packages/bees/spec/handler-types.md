# Handler Types — Spec Doc

**Goal**: Create bees-native copies of the types that function handlers import
from `opal_backend` for suspend/resume, session termination, and context
injection — so that handler bodies can eventually be inlined without any
`opal_backend` dependency.

## Context

Three bees function modules (`chat.py`, `simple_files.py`, `system.py`) delegate
to `opal_backend`'s `_make_handlers`. Those handler factories use internal types:
`SuspendError`, suspend event dataclasses, `AgentResult`, `LoopController`,
`CONTEXT_PARTS_KEY`, and `ChatEntryCallback`.

Before the handler *bodies* can be inlined into bees (eliminating the
`_make_handlers` imports), bees needs its own copies of these types. This spec
extracts the types as an independent step. The handler inlining is a separate,
later spec that builds on this one.

## Design Decisions

### Verbatim copies, different package

The bees versions are verbatim copies of the opal versions. Same field names,
same shapes, same `to_dict()` methods. The only difference is the import source.
Python's structural subtyping means the opal and bees types are interchangeable.

### `SessionTerminator` protocol instead of `LoopController` class

Bees doesn't need the full `LoopController` class — only the `terminate(result)`
method. The bees-native version defines a `SessionTerminator` protocol with a
single method. `LoopController` satisfies it structurally.

### Suspend event types are data, not wire protocol

The suspend event dataclasses (`WaitForInputEvent`, `WaitForChoiceEvent`,
`ChoiceItem`) are used by handlers to construct `SuspendError` payloads. They're
data containers — the wire serialization (`to_dict()`) is preserved for
compatibility, but bees handlers only need the constructor and field access.

### `CONTEXT_PARTS_KEY` is a string constant

`CONTEXT_PARTS_KEY = "__context_parts__"` is imported by `chat.py` from
`opal_backend.function_caller`. It's a sentinel key in handler return dicts that
signals "inject these parts into the conversation context." Trivial to copy.

### `ChatEntryCallback` is a type alias

`ChatEntryCallback = Callable[[str, str], None] | None` — used by the chat
handler factory signature. Trivial to copy.

### `FileData` and `AgentResult` come together

`AgentResult` references `FileData` in its `intermediate` field. Both are
dataclasses from `opal_backend.events`. They travel as a unit.

### `LLMContent` alias comes along

Several types use `LLMContent = dict[str, Any]` as a type alias. It's already
defined in `opal_backend.events`. The bees copy goes in the same module for
clarity.

## Protocol Inventory

| Type / Constant       | Replaces                                     | Specified | Tested | Migrated |
| --------------------- | -------------------------------------------- | --------- | ------ | -------- |
| `SuspendError`        | `opal_backend.suspend.SuspendError`          | ✅        | ✅     | ✅       |
| `WaitForInputEvent`   | `opal_backend.events.WaitForInputEvent`      | ✅        | ✅     | ✅       |
| `WaitForChoiceEvent`  | `opal_backend.events.WaitForChoiceEvent`     | ✅        | ✅     | ✅       |
| `ChoiceItem`          | `opal_backend.events.ChoiceItem`             | ✅        | ✅     | ✅       |
| `AgentResult`         | `opal_backend.events.AgentResult`            | ✅        | ✅     | ✅       |
| `FileData`            | `opal_backend.events.FileData`               | ✅        | ✅     | ✅       |
| `SessionTerminator`   | `opal_backend.loop.LoopController`           | ✅        | ✅     | ✅       |
| `CONTEXT_PARTS_KEY`   | `opal_backend.function_caller.CONTEXT_PARTS_KEY` | ✅    | ✅     | ✅       |
| `ChatEntryCallback`   | `opal_backend.functions.chat.ChatEntryCallback`  | ✅    | ✅     | ✅       |
| `LLMContent`          | `opal_backend.events.LLMContent`             | ✅        | ✅     | ✅       |

## Protocol Shapes

### `SuspendError`

```python
class SuspendError(Exception):
    """Raised by function handlers that need client input."""

    def __init__(
        self,
        event: SuspendEvent,
        function_call_part: dict[str, Any] | None = None,
        *,
        is_precondition_check: bool = False,
    ) -> None: ...

    event: SuspendEvent
    function_call_part: dict[str, Any]
    is_precondition_check: bool
    interaction_id: str
    completed_responses: list
```

Depends on: `SuspendEvent` (union of suspend event types).

### `WaitForInputEvent`

```python
@dataclass
class WaitForInputEvent:
    type: str = "waitForInput"
    request_id: str = ""
    prompt: LLMContent = field(default_factory=dict)
    input_type: str = "text"
    skip_label: str | None = None
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]: ...
```

### `WaitForChoiceEvent`

```python
@dataclass
class WaitForChoiceEvent:
    type: str = "waitForChoice"
    request_id: str = ""
    prompt: LLMContent = field(default_factory=dict)
    choices: list[ChoiceItem] = field(default_factory=list)
    selection_mode: str = "single"
    layout: str | None = None
    none_of_the_above_label: str | None = None
    interaction_id: str | None = None

    def to_dict(self) -> dict[str, Any]: ...
```

### `ChoiceItem`

```python
@dataclass
class ChoiceItem:
    id: str = ""
    content: LLMContent = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]: ...
```

### `SessionTerminator`

```python
@runtime_checkable
class SessionTerminator(Protocol):
    """Contract: terminate the session with a result."""

    def terminate(self, result: AgentResult | dict[str, Any]) -> None: ...
```

### `AgentResult`

```python
@dataclass
class AgentResult:
    success: bool
    href: str = "/"
    outcomes: LLMContent | None = None
    intermediate: list[FileData] | None = None

    def to_dict(self) -> dict[str, Any]: ...
```

### `FileData`

```python
@dataclass
class FileData:
    path: str
    content: LLMContent

    def to_dict(self) -> dict[str, Any]: ...
```

### Constants and aliases

```python
LLMContent = dict[str, Any]
CONTEXT_PARTS_KEY = "__context_parts__"
ChatEntryCallback = Callable[[str, str], None] | None
SuspendEvent = WaitForInputEvent | WaitForChoiceEvent
```

Note: `SuspendEvent` in bees is narrower than opal's — only the two types that
bees handlers actually construct. The graph-editing events
(`ReadGraphEvent`, `InspectNodeEvent`, etc.) are session-level concerns that
belong in `bees-gemini`.

## Migration Notes

### Target file

`bees/protocols/handler_types.py` — new module in the existing protocols
package.

### What this enables

With handler types in place, the handler inlining spec can rewrite:

```diff
-from opal_backend.functions.chat import _make_handlers
-from opal_backend.functions.chat import SuspendError
-from opal_backend.functions.chat import ChatEntryCallback
-from opal_backend.function_caller import CONTEXT_PARTS_KEY
+from bees.protocols.handler_types import (
+    SuspendError,
+    ChatEntryCallback,
+    CONTEXT_PARTS_KEY,
+    WaitForInputEvent,
+    WaitForChoiceEvent,
+    ChoiceItem,
+)
```

And then inline the handler bodies using these types + bees-native pidgin.

### This spec does not change `_make_handlers` imports

It migrates the type imports (`SuspendError`, `ChatEntryCallback`,
`CONTEXT_PARTS_KEY`) to bees-native sources. The `_make_handlers` imports
remain — they're the handler bodies spec.

### Migrated files

- `bees/functions/chat.py` — `CONTEXT_PARTS_KEY`, `ChatEntryCallback`,
  `SuspendError` now import from `bees.protocols.handler_types`
- `tests/test_chat.py` — `CONTEXT_PARTS_KEY` now imports from
  `bees.protocols.handler_types`

`WaitForInputEvent`, `WaitForChoiceEvent`, `ChoiceItem`, `AgentResult`,
`FileData`, and `SessionTerminator` are not yet imported by any bees module —
the handler bodies spec will use them when inlining `_make_handlers`.

### Conformance testing strategy

1. **Structural conformance**: verify bees' dataclasses have the same fields
   and defaults as opal's.
2. **`to_dict()` conformance**: verify identical wire serialization for the
   same field values.
3. **`SuspendError` behavior**: verify same exception properties and
   `interaction_id` assignment.
4. **`SessionTerminator` protocol**: verify `LoopController` satisfies it
   structurally.
