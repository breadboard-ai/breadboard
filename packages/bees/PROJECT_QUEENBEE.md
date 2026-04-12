# Project Queen Bee — Comprehensive Bees Documentation

The bees framework has outgrown its documentation. The code has evolved through
several architectural shifts (playbooks → templates, multi-step DAGs → flat
templates + hierarchical tasks, `playbooks.*` → `tasks.*`), but the docs still
describe the old world. This project produces documentation that captures both
the current system and its directional intent.

**Audience**: Contributors to bees — people who need to understand how the
system is layered, how pieces fit, and which layer to extend for the result they
want.

**Organizing principle**: Bees is a library with two layers. Applications are
built on top of it.

| Layer         | Responsibility                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **Session**   | The atom. One LLM conversation with tools, suspend/resume, context management. Nothing is smaller. |
| **Scheduler** | Drives sessions via the task data model. Tasks capture state; scheduler flips bits.                |

---

## Phase 1: The Organizing Document

🎯 **Objective**: A contributor reads `docs/architecture/layers.md` and can
identify which file to open for any given change.

- [x] Write `docs/architecture/layers.md` — the three-layer model, per-layer
      module map, extensibility seams, and cross-cutting concerns (task
      hierarchy, shared workspaces, context delivery).
- [x] Remove or replace `docs/architecture/manager-agent-pattern.md` (obsolete).

---

## Phase 2: Layer Deep Dives

🎯 **Objective**: A contributor can trace a task from creation through execution
to completion using the docs alone.

- [ ] `docs/session.md` — The session concept, the agent loop implementation
      (`opal_backend`), how `opal_backend` provides the full function inventory
      and bees filters it, function group anatomy (declarations + handlers +
      factory pattern), context window lifecycle (including future compaction),
      suspend/resume/pause mechanics.
- [ ] `docs/scheduler.md` — Task lifecycle states, dependency promotion,
      coordination routing, cycle waves, context delivery (three paths:
      mid-stream, immediate, buffered), `SubagentScope` and the task hierarchy
      (unbounded nesting depth by design).
- [ ] `docs/hivetool.md` — The built-in hive inspector: what it shows, how to
      extend it. Distinct from the web shell — hivetool is part of the
      framework; the web shell is an application built on bees.

---

## Phase 3: Extension Guides

🎯 **Objective**: A contributor can add a new function group, template, or skill
by following the guide without reading existing implementations.

- [ ] `docs/guides/writing-functions.md` — Declarations, handlers, factory
      pattern, filter globs, registration. Worked example.
- [ ] `docs/guides/writing-templates.md` — TEMPLATES.yaml schema, objective
      interpolation, function/skill scoping, autostart, hooks, the tasks
      allowlist. Worked example.
- [ ] `docs/guides/writing-skills.md` — Skill directory structure, SKILL.md
      frontmatter, `allowed-tools`, VFS mounting. Worked example.

---

## Phase 4: The Hive

🎯 **Objective**: An operator can configure a new hive from scratch using only
the docs.

- [ ] `docs/hive.md` — The hive directory as a configuration surface:
      `config/SYSTEM.yaml`, `config/TEMPLATES.yaml`, `config/hooks/`, `skills/`,
      `tickets/`, `logs/`. How the pieces compose at startup. The declarative
      boot sequence.
- [ ] Replace `hive/playbooks/GUIDE.md` with a redirect or tombstone pointing to
      the new docs.
- [ ] Migrate `docs/TEMPLATE_SCHEMA.md` content into the appropriate new doc
      (likely Phase 3's writing-templates guide).

---

## Phase 5: Naming Migration

🎯 **Objective**: Code and docs use consistent terminology — "task" not
"ticket", "template" not "playbook".

The naming migration is already underway conceptually. This phase makes it
concrete.

- [ ] Document the migration rationale and mapping in
      `docs/migrations/naming.md`:
  - `ticket` → `task`
  - `playbook` → `template`
  - `playbook_id` → `template_id`
  - `playbook_run_id` → `run_id`
  - `PLAYBOOK.yaml` → (already gone, replaced by `TEMPLATES.yaml`)
- [ ] Codemod to rename `Ticket` → `Task`, `ticket_id` → `task_id`, etc. across
      the Python codebase (with backward-compat for on-disk format).
- [ ] Update hivetool, web shell, and server endpoints to use new terminology.

---

## Phase 6: Vision & Direction

🎯 **Objective**: A contributor understands not just how the system works today,
but where it's heading and why.

- [ ] `docs/vision.md` — The architect's view: design principles, the trajectory
      of the framework, planned capabilities, and the reasoning behind key
      architectural decisions. Key topics:
  - Bees as an installable library — authors build their own surfaces.
  - Context window compaction as a future agent loop concern.
  - The hive metaphor and its evolution. This document is authored
    collaboratively — it captures knowledge that only exists in the architect's
    head.

---

## Resolved Questions

1. **Context window compaction** — Mention as a future agent loop concern. Don't
   document the approach yet; document that this is the layer's job.
2. **Task hierarchy depth** — Unbounded by design.
3. **Function inventory** — `opal_backend` provides the full set of functions.
   Bees adds its own function groups (`tasks.*`, `events.*`, etc.) and template
   authors filter the combined inventory using `functions` and `allowed-tools`
   directives. Functions like `generate.text` are opal_backend built-ins that
   bees passes through.
4. **Hivetool vs. web shell** — Intentionally distinct. Hivetool is the built-in
   hive inspector (ships with bees, always available). The web shell is a
   reference application built on top of bees. Future direction: bees becomes an
   installable library; authors build their own surfaces. The server + web shell
   will be extracted from the framework.
