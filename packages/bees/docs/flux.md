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

| Area               | Stability    | Summary                                           |
| ------------------ | ------------ | ------------------------------------------------- |
| Session layer      | **Solid**    | Contract settled. Internals may shift.            |
| Scheduler core     | **Solid**    | Task lifecycle and cycle mechanics are permanent. |
| Skills             | **Solid**    | Anchored to an external spec.                     |
| Event delivery     | **Settling** | Shape is right, plumbing may change.              |
| Filesystem sharing | **Settling** | Scoping model may evolve.                         |
| Task templates     | **Settling** | Open questions around hooks, root, entry points.  |
| Consumption API    | **Fluid**    | How apps build on bees is largely unanswered.     |

## Solid

These areas have stable contracts. The implementation may change — sometimes
significantly — but the behavior visible to consumers is settled. Modify with
care: changes here ripple outward.

### Session layer

The session is the atom of bees: one LLM conversation with tools, suspend,
resume, and pause. The contract — `run_session` / `resume_session` returning a
`SessionResult` — is permanent. Internals will shift to better align with
`architecture.md` (e.g. removing the `skills.*` function group workaround,
cleaning up dot↔underscore naming), but the session concept and its consumer
surface are not changing.

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

- **Hooks** — the `on_run_playbook` / `on_ticket_done` / `on_event` contract is
  not well-defined. It's unclear whether hooks are the right abstraction or
  whether they should be replaced by something else entirely.
- **Root template** — the `SYSTEM.yaml` → `boot_root_template` mechanism is
  awkward. Why isn't this just `autostart`? The root template bootstrapping
  feels like a special case that shouldn't be special.
- **Top-level task creation** — there's no clean way to create a task from the
  top (outside the framework). The entry points are `run_playbook` (code) and
  the server endpoints, but neither is a crisp API for "start this work."

The overall shape feels right. The details are in motion.

## Fluid

These areas are under active construction. Expect breaking changes, missing
abstractions, and incomplete contracts.

### Consumption API

This is the biggest open question in bees: **how do applications build on this
framework?**

Today, the answer is ad-hoc. `bees/server.py` wires `SchedulerHooks` to SSE
broadcasting and exposes REST endpoints. The web shell consumes those endpoints.
But this isn't a designed API — it's the first thing that worked. The boundary
between "bees the library" and "the application built on bees" is blurry:

- `SchedulerHooks` is the closest thing to a plugin API, but it's a bag of
  callbacks with no lifecycle contract.
- The server is tightly coupled to one application pattern (SSE + REST). There's
  no way to build a different kind of application without forking the server.
