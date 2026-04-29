# Stability Map

Bees is in active development. This document tells contributors which parts of
the framework have stable contracts and which are still finding their shape.

**Stability here means the consumer-facing contract.** A layer can be refactored
or even rewritten internally and still be "solid" — what matters is whether the
surface visible to the layer's consumers is settled. Code churn is not
instability; contract churn is.

## The gradient

Stability runs from the core outward. The deeper into the framework you go, the
more settled things are. The outermost layer — how applications consume bees —
is where most future work lives.

| Area               | Stability    | Summary                                             |
| ------------------ | ------------ | --------------------------------------------------- |
| Session layer      | **Solid**    | Contract settled. Internals may shift.              |
| Scheduler core     | **Solid**    | Task lifecycle and cycle mechanics are permanent.   |
| Skills             | **Solid**    | Anchored to an external spec.                       |
| Typed events       | **Solid**    | `Bees.on()` with `SchedulerEvent` subclasses.       |
| Event delivery     | **Settling** | Shape is right, plumbing may change.                |
| Filesystem sharing | **Settling** | Scoping model may evolve.                           |
| Task templates     | **Settling** | Open questions around hooks, root, entry points.    |
| Consumption API    | **Settling** | `Bees` class exists, but query surface is evolving. |

## Solid

These areas have stable contracts. The implementation may change — sometimes
significantly — but the behavior visible to consumers is settled. Modify with
care: changes here ripple outward.

### Session layer

The session is the atom of bees: one LLM conversation with tools, suspend,
resume, and pause. The contract — `SessionRunner.run()` / `.resume()` returning
a `SessionStream`, consumed by `drain_session()` to produce a `SessionResult` —
is permanent. Internals will shift (e.g. removing the `skills.*` function group
workaround, cleaning up dot↔underscore naming), but the session concept and its
consumer surface are not changing.

### Scheduler core

The task lifecycle (available → running → completed/failed/suspended/paused),
the cycle mechanics (promote → route → collect → execute → settle → trigger),
and the task-as-state-machine model are here to stay. The scheduler's job is to
flip bits on tasks and drive sessions — that framing is settled.

### Skills

Skills are anchored to an external specification
([Agent Skills](https://agentskills.io)). The contract is small and clear: a
`SKILL.md` with YAML frontmatter, an `allowed-tools` list, and directory
mounting into the agent's file system. This is unlikely to change.

### Typed events

The observation API — `bees.on(EventType, callback)` with `SchedulerEvent`
subclasses (`TaskAdded`, `TaskDone`, `CycleStarted`, etc.) — is settled. This
replaced the earlier `SchedulerHooks` callback bag. The event types themselves
may grow (new events for new scheduler capabilities), but the dispatch mechanism
and the `Bees.on()` surface are permanent.

## Settling

These areas work and the overall shape is right, but the details are still
forming. This is the second draft — confident in the direction, but expect
shifts in mechanics and naming.

### Event delivery

The core invariant is stable: context updates are never lost regardless of the
agent's state. But the consumer-facing contract for dispatching and subscribing
to events — `events_broadcast`, `watch_events`, `tasks_send_event` — may not be
the right abstractions. How agents discover, emit, and listen for events is
still finding its shape.

### Filesystem sharing

Scoped workspaces (SubagentScope, slug-based write fencing, shared filesystem
roots) solve the right problem: agents in a hierarchy need to share data via
files without sharing memory. The overall shape is right, but the scoping model
may evolve as more patterns emerge around multi-level delegation.

### Task templates

The template concept is solid (a blueprint for a task, defined in
`TEMPLATES.yaml`), and most template fields are stable (`name`, `objective`,
`functions`, `skills`, `tasks`, `autostart`, `watch_events`). But several open
questions remain:

- **Hooks** — the `on_run_playbook` / `on_task_done` / `on_event` contract is
  not well-defined. It's unclear whether hooks are the right abstraction or
  whether they should be replaced by something else entirely.
- **Root template** — the `SYSTEM.yaml` → `boot_root_template` mechanism is
  awkward. Why isn't this just `autostart`? The root template bootstrapping
  feels like a special case that shouldn't be special.
- **Top-level task creation** — there's no clean way to create a task from the
  top (outside the framework). The `Bees.create_child()` method exists but
  isn't well-tested or documented.

The overall shape feels right. The details are in motion.

### Consumption API

The `Bees` class is the entry point: `Bees(hive_dir, runners)` wraps the
scheduler and task store, provides typed event observation via `bees.on()`, and
exposes query methods (`children`, `all`, `get_by_id`, `query`).

This is a significant improvement over the earlier ad-hoc wiring — applications
no longer need to touch scheduler internals directly. But the query surface is
still evolving: the `TaskNode` wrapper, tag-based queries, and `create_child()`
are young. The box (`bees.box`) and reference application (`app/server.py`) are
the two consumption patterns, and both work, but neither has been designed as a
reusable pattern.

The boundary between "bees the library" and "the application built on bees" is
much clearer than before but not yet crisp. The interaction model (how users
respond to suspended agents) is still handled by direct file edits or the
mutation system rather than a framework-provided interaction surface.
