# Observation API — Spec Doc

**Goal**: Replace `SchedulerHooks` with a typed event stream that supports
multiple observers and makes event semantics explicit in the type system.

## Context

`SchedulerHooks` is a `@dataclass` with 7 optional callback fields. It was the
right first step — simple, direct, and functional. But it has grown into a
design smell:

- **Stringly typed at the `Bees` level.** `bees.on("task_doen", cb)` silently
  does nothing. No validation, no autocomplete.
- **Untyped payloads.** `on_cycle_start` takes `(int, int, int)`. The semantics
  live in docstrings, not code.
- **No event objects.** Each hook has a different signature. You can't subscribe
  to all events, filter, log, or relay them uniformly.
- **`SchedulerHooks` is redundant.** `Bees.on()` wraps it with lambdas. The
  dataclass adds no value — it's a pass-through layer.
- **Mixed sync/async.** `on_events_broadcast` is sync; all others are async.
  The contract is invisible.
- **Leaked through constructor params.** `TaskRunner.__init__` receives
  `on_task_start` and `on_task_event` as individual `Callable` params —
  fragmented from the hooks bag.
- **`on_startup` is dead.** Declared in `SchedulerHooks` but never wired by
  `Bees.on()`. Neither consumer registers for it.

### Consumers

Two consumers exist today:

| Consumer     | Events used | Purpose              |
| ------------ | ----------- | -------------------- |
| `box.py`     | 6 of 7      | Logging              |
| `server.py`  | 6 of 7      | SSE broadcast to UI  |

Both register the same 6 events (`task_added`, `cycle_start`, `task_event`,
`task_start`, `task_done`, `cycle_complete`). Neither uses `on_startup`.

### Internal wiring

`Scheduler` also uses hooks internally in two places that break the abstraction:

1. **`route_coordination_task`** receives `on_task_done` as a bare `Callable`
   parameter instead of going through the hooks system.
2. **`_on_events_broadcast_internal`** calls both `on_events_broadcast` *and*
   `on_task_added` — overloaded semantics.

## Design Decisions

### Typed event dataclasses, not string keys

Each event is a `@dataclass` with named fields. `Bees.on()` dispatches by type,
not by string. This gives autocomplete, type checking, and exhaustiveness.

### All events are async

The one sync exception (`on_events_broadcast`) becomes async. The emit path
already handles async via `_emit` — the inconsistency adds complexity for no
benefit.

### `SchedulerHooks` is deleted

The dataclass disappears. The scheduler emits events directly. `TaskRunner`
receives an emit callback, not individual hook params.

### `on_startup` is dropped

No consumer uses it. If a consumer needs the initial task list, `Bees.all`
already provides it.

### `on_events_broadcast` is split

The current `_on_events_broadcast_internal` does three things:
1. Calls `on_events_broadcast(task)`
2. Calls `on_task_added(task)` (for newly created subtasks)
3. Calls `trigger()` (to wake the scheduler)

The first two are really a `TaskAdded` event. The scheduler trigger is internal
plumbing. After migration, the function handler broadcasts emit `TaskAdded`
events for each new task, and the scheduler's internal trigger stays internal.

### Callback-based subscription (not async iterator)

The async iterator pattern (`async for event in bees.events()`) is elegant but
creates lifecycle complexity: who manages the iterator? When does it stop? What
about back-pressure?

Callbacks are simpler, match the current consumer pattern, and compose naturally
with both logging (box) and fan-out (server's Broadcaster). An async iterator
can be layered on top as a convenience wrapper later — the reverse is harder.

## Protocol Inventory

| Type              | Replaces                       | Specified | Tested | Migrated |
| ----------------- | ------------------------------ | --------- | ------ | -------- |
| `SchedulerEvent`  | (new — base type)              | ✅        | ✅     | ✅       |
| `TaskAdded`       | `on_task_added(Ticket)`        | ✅        | ✅     | ✅       |
| `CycleStarted`    | `on_cycle_start(int,int,int)`  | ✅        | ✅     | ✅       |
| `TaskEvent`       | `on_task_event(str,dict)`      | ✅        | ✅     | ✅       |
| `TaskStarted`     | `on_task_start(Ticket)`        | ✅        | ✅     | ✅       |
| `TaskDone`        | `on_task_done(Ticket)`         | ✅        | ✅     | ✅       |
| `CycleComplete`   | `on_cycle_complete(int)`       | ✅        | ✅     | ✅       |

## Protocol Shapes

### Event types

```python
from dataclasses import dataclass
from typing import Any

@dataclass
class SchedulerEvent:
    """Base for all scheduler-emitted events."""
    type: str

@dataclass
class TaskAdded(SchedulerEvent):
    """A new task was created or discovered."""
    type: str = "task_added"
    task: Ticket

@dataclass
class CycleStarted(SchedulerEvent):
    """A new scheduling cycle is beginning."""
    type: str = "cycle_started"
    cycle: int
    available: int
    resumable: int

@dataclass
class TaskEvent(SchedulerEvent):
    """A running session emitted a raw event."""
    type: str = "task_event"
    task_id: str
    event: dict[str, Any]

@dataclass
class TaskStarted(SchedulerEvent):
    """A task transitioned to running."""
    type: str = "task_started"
    task: Ticket

@dataclass
class TaskDone(SchedulerEvent):
    """A task reached a resting state."""
    type: str = "task_done"
    task: Ticket

@dataclass
class CycleComplete(SchedulerEvent):
    """All work is done — the scheduler is idle."""
    type: str = "cycle_complete"
    total_cycles: int
```

### Emit function

The scheduler receives an emit callback instead of a hooks bag:

```python
# Type alias
EventEmitter = Callable[[SchedulerEvent], Awaitable[None]]
```

`Scheduler.__init__` takes `emit: EventEmitter`. The `TaskRunner` receives the
same `emit`. Internal emit sites become:

```python
# Before:
if self._hooks.on_task_done:
    await self._hooks.on_task_done(task)

# After:
await self._emit(TaskDone(task=task))
```

### `Bees` consumer API

```python
class Bees:
    def on(self, event_type: type[T], callback: Callable[[T], Any]) -> None:
        """Register a typed event listener."""
        ...

    # Private — wired as the emit callback to Scheduler
    async def _emit(self, event: SchedulerEvent) -> None:
        ...
```

Consumer code:

```python
# Before:
bees.on("task_done", lambda t: logger.info("Done: %s", t.id))

# After:
bees.on(TaskDone, lambda e: logger.info("Done: %s", e.task.id))
```

## Migration Notes

### `route_coordination_task` signature

Currently takes `on_task_done: Callable` as a parameter. After migration, takes
`emit: EventEmitter` and emits `TaskDone(task=task)` directly.

### `TaskRunner` constructor simplification

`on_task_start`, `on_task_event`, and `on_events_broadcast` collapse into a
single `emit: EventEmitter`. The task runner calls `await emit(TaskStarted(...))`
instead of `if self._on_task_start: await self._on_task_start(task)`.

### `_on_events_broadcast_internal` decomposition

This method currently:
1. Calls `on_events_broadcast(task)` — becomes `emit(TaskAdded(task=task))`
2. Calls `on_task_added(task)` on a `create_task` — same event, deduplicated
3. Calls `trigger()` — stays as internal plumbing

### Backward compatibility

The migration is internal. `Bees.on()` changes signature from string-keyed to
type-keyed. Both consumers (`box.py`, `server.py`) update in the same PR.
No external API exists yet, so no backward compatibility concern.

## Verification Plan

### Automated

1. `npm run build` — type-checks compilation.
2. `npm run test -w packages/bees` — existing test suite passes.
3. Conformance test: verify each event type is a dataclass with the expected
   fields and satisfies `isinstance(event, SchedulerEvent)`.
4. Integration test: mock emit, trigger scheduler operations, verify correct
   events are emitted with correct payloads.

### Manual

1. Run `box` against a test hive — verify logging output is unchanged.
2. Run `server` — verify SSE events are unchanged in the browser.
