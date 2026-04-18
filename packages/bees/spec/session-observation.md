# Session Observation Types — Spec Doc

**Goal**: Extract the types that the orchestration layer (`TaskRunner`,
`Scheduler`, `EvalCollector`) uses to interpret session output — event type
constants and the structured result — into `bees/protocols/`, so that the
observation side of the session boundary is cleanly bees-native before the
`SessionRunner` protocol is specified.

## Context

`session.py` currently conflates session execution (calling `opal_backend`'s
session API) with session observation (interpreting events, producing results).
When the `SessionRunner` protocol is defined, `session.py`'s execution code
moves to `bees-gemini`. The observation types stay in bees — they're the output
contract that any runner must satisfy.

Three items cross this boundary today:

1. **`SUSPEND_TYPES`** — imported from `opal_backend.events`. Used by
   `EvalCollector.collect()` and `_print_event_summary()` to detect suspend
   events in the event stream.
2. **`PAUSE_TYPES`** — imported from `opal_backend.events`. Used by
   `_print_event_summary()` (and implicitly by `EvalCollector` via the
   `"paused"` key check).
3. **`SessionResult`** — a bees-native dataclass already, but lives in
   `session.py`. Used by `task_runner.py`, `scheduler.py`, and tests. When
   `session.py` becomes the runner, this type needs to stay behind.

All three are leaves: zero dependencies on other unextracted types.

## Design Decisions

### Verbatim copies of the constants

`SUSPEND_TYPES` and `PAUSE_TYPES` are `frozenset[str]` — event type strings
that match dict keys in the event stream. The bees copies are identical values.
Conformance test verifies they match the opal originals.

### `SessionResult` stays a concrete dataclass

`SessionResult` is already bees-native (no opal imports). It doesn't need to
become a Protocol — it's a value type, not an abstraction boundary. The move is
a relocation to the protocols module so that consumers (`task_runner.py`,
`scheduler.py`) don't import it from the future runner module.

### Event constants are the shared vocabulary

The event stream is a sequence of `dict[str, Any]` where each dict has a single
key naming the event type (e.g. `{"waitForInput": {...}}`, `{"complete": {...}}`).
`SUSPEND_TYPES` and `PAUSE_TYPES` define which keys signal suspension and pause
respectively. This vocabulary is shared between the runner (which produces
events) and the orchestrator (which categorizes them). Making it bees-native
establishes it as part of the framework contract.

### No changes to `EvalCollector` in this spec

`EvalCollector` becomes opal-free as a side effect (its only opal import was
`SUSPEND_TYPES`). But restructuring `EvalCollector` itself (e.g. moving it to
its own module) is a separate concern — this spec only extracts the types it
depends on.

## Protocol Inventory

| Type / Constant  | Replaces                          | Specified | Tested  | Migrated |
| ---------------- | --------------------------------- | --------- | ------- | -------- |
| `SUSPEND_TYPES`  | `opal_backend.events.SUSPEND_TYPES` | ✅      | ✅      | ✅       |
| `PAUSE_TYPES`    | `opal_backend.events.PAUSE_TYPES`   | ✅      | ✅      | ✅       |
| `SessionResult`  | (already bees-native, relocation)   | ✅      | ✅      | ✅       |

## Protocol Shapes

### `SUSPEND_TYPES`

```python
SUSPEND_TYPES: frozenset[str] = frozenset({
    "waitForInput",
    "waitForChoice",
    "readGraph",
    "inspectNode",
    "applyEdits",
    "queryConsent",
})
```

All six suspend event type strings from
`opal_backend.events`. The orchestrator uses these to detect when a session has
suspended (the event stream contains a dict with one of these keys).

### `PAUSE_TYPES`

```python
PAUSE_TYPES: frozenset[str] = frozenset({"paused"})
```

Single pause event type. Used to detect transient infrastructure failures that
the scheduler can retry.

### `SessionResult`

```python
@dataclass
class SessionResult:
    """Result of a completed or suspended session."""

    session_id: str
    status: str
    events: int
    output: str
    turns: int = 0
    thoughts: int = 0
    outcome: str | None = None
    error: str | None = None
    files: list[dict[str, str]] = field(default_factory=list)
    intermediate: list[dict[str, Any]] | None = None
    suspended: bool = False
    suspend_event: dict[str, Any] | None = None
    outcome_content: dict[str, Any] | None = None
    paused: bool = False
    paused_event: dict[str, Any] | None = None
```

Identical to the existing dataclass in `session.py`. No changes to fields or
semantics.

## Migration Notes

### Target file

`bees/protocols/session.py` — new module in the existing protocols package.

### What this enables

After this spec, `session.py`'s remaining opal imports are purely session
execution concerns (stores, session API). This creates a clean cut line for the
`SessionRunner` protocol: everything above the line (observation types) is
bees-native; everything below (execution) moves to the runner.

Concretely, `session.py`'s opal imports reduce from:

```python
from opal_backend.local.backend_client_impl import HttpBackendClient
from opal_backend.local.interaction_store_impl import InMemoryInteractionStore
from opal_backend.events import PAUSE_TYPES, SUSPEND_TYPES          # ← removed
from opal_backend.interaction_store import InteractionState
from opal_backend.sessions.api import (...)
from opal_backend.sessions.in_memory_store import InMemorySessionStore
```

to 5 imports, all deep session runtime.

### Import migration

```diff
# session.py
-from opal_backend.events import PAUSE_TYPES, SUSPEND_TYPES
+from bees.protocols.session import PAUSE_TYPES, SUSPEND_TYPES

# task_runner.py
-from bees.session import (
-    SessionResult,
+from bees.protocols.session import SessionResult
+from bees.session import (
     append_chat_log,
     ...
 )

# scheduler.py
-from bees.session import SessionResult
+from bees.protocols.session import SessionResult
```

### Conformance testing strategy

1. **Constant conformance**: verify `bees.protocols.session.SUSPEND_TYPES` and
   `PAUSE_TYPES` are identical to `opal_backend.events.SUSPEND_TYPES` and
   `PAUSE_TYPES`.
2. **`SessionResult` structural check**: verify the dataclass has the expected
   fields and defaults (snapshot test against the current definition).
3. **Re-export from `session.py`**: during transition, `session.py` can
   re-export `SessionResult` from the new location so that any external
   consumers continue to work.
