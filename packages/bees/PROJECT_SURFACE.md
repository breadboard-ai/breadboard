# Project Surface

## Orientation

Key directories and files for this project:

- [docs/future.md](docs/future.md) — original vision for Agent Artifacts and
  Shared Directories
- [docs/architecture.md](docs/architecture.md) — framework architecture overview
- [docs/patterns.md](docs/patterns.md) — design philosophy (MVC, hive as
  interchange)
- [bees/functions/files.py](bees/functions/files.py) — file I/O function group
  (how agents write files)
- [bees/disk_file_system.py](bees/disk_file_system.py) — filesystem
  implementation (content store)
- [bees/subagent_scope.py](bees/subagent_scope.py) — write-fencing for
  sub-agents (per-scope boundaries)
- [bees/task_runner.py](bees/task_runner.py) — session wiring, metadata
  bookkeeping, `extract_files`
- [bees/protocols/events.py](bees/protocols/events.py) — typed event system
  (`EventEmitter`, `TaskEvent`)
- [bees/functions/events.py](bees/functions/events.py) — `events_broadcast`
  function group
- [hive/config/TEMPLATES.yaml](hive/config/TEMPLATES.yaml) — task templates
  (`watch_events`, `tags`, `functions`)
- [hivetool/src/data/ticket-store.ts](hivetool/src/data/ticket-store.ts) —
  hivetool's filesystem-based store (FileSystemObserver, `scan()`)
- [common/types.ts](common/types.ts) — shared `TaskData` type (the "database
  row")

## Summary

Agents need a way to present curated output to the user — not just text in the
chat log, but structured, persistent, updatable artifacts that the consumer
application renders.

**Surface** is the name for this concept. A surface is:

- A `surface.json` file in the agent's scope within the shared filesystem
- A structured manifest describing what the agent wants to present (sections,
  panels, references to content files)
- Updated mid-session, visible as the agent works
- Discovered by consumers through event subscription

## Key design decisions

- **The filesystem is the artifact.** The ticket directory above `filesystem/`
  is a database table (system metadata). `filesystem/` is the content store.
  Surface lives here.
- **Per-scope surfaces.** Each agent writes `{scope}/surface.json` within its
  writable area. The consumer walks the tree and aggregates. No cross-scope
  writing needed.
- **Notification via `events_broadcast`.** The agent writes content files, writes
  `surface.json`, then broadcasts `surface_updated`. No new function — reuses
  existing infrastructure.
- **Consumer event subscription.** A new extensibility point in the scheduler
  allows consumers (applications) to subscribe to broadcast events alongside
  agents. `surface_updated` is the first use case, but the mechanism is general.

---

## Phase 1 — Consumer Event Subscription ✅

Extend the scheduler's event routing so that applications (not just agents) can
subscribe to broadcast event types.

- [x] `bees/protocols/events.py` — `BroadcastReceived(SchedulerEvent)` with
      `signal_type`, `message`, `source_task_id`.
- [x] `bees/coordination.py` — emit `BroadcastReceived` during
      `route_coordination_task`, after agent delivery, before `TaskDone`.
- [x] `app/server.py` — subscribe via `bees.on(BroadcastReceived, ...)`, push
      `broadcast:received` to SSE clients.
- [x] `tests/test_coordination.py` — **[NEW]** 4 tests (emission, ordering,
      empty fields, coexistence with agent delivery).

🎯 The reference app's server receives an `events_broadcast` event through a
registered callback, and can push it to the client via SSE.

---

## Phase 2 — Surface Schema

Define what goes in `surface.json`. Start minimal and let it evolve.

- [ ] Sections with titles and content references? Flat list of items? Typed panels
      (markdown, image, bundle)?
- [ ] How does the schema handle updates — full replacement or incremental patches?
- [ ] What metadata does each entry carry (name, type, path, timestamp)?

🎯 A written schema spec that an agent can follow and a consumer can render,
validated by hand-writing a few example `surface.json` files.

---

## Phase 3 — Surface Skill

Teach agents to produce surfaces.

- [ ] Write a skill that teaches the agent how to write `surface.json`.
- [ ] The skill covers: writing content files, structuring the manifest, broadcasting
      `surface_updated`.
- [ ] Agent writes content files + `surface.json` + broadcasts `surface_updated`.

🎯 An agent with the surface skill writes a `surface.json` in its scope
directory and broadcasts `surface_updated`. The event reaches a subscribed
consumer.

---

## Phase 4 — Surface Aggregation

When a root task has sub-agents each with their own surface, how does the
consumer compose them?

- [ ] Flat merge? Tree projection? Filtered by tags?
- [ ] Per the MVC model, this is the consumer's decision — but the convention should
      make aggregation natural.
- [ ] Define how per-scope surfaces (`research/surface.json`, `app/surface.json`)
      compose into a task-level view.

🎯 A task with multiple sub-agents produces per-scope surfaces. A consumer can
walk the tree and assemble a coherent composite view.

---

## Phase 5 — Hivetool Surface Rendering

Hivetool discovers and renders surface files from the task's filesystem.

- [ ] On `surface_updated` (or filesystem change), scan for `surface.json` files in
      the task's filesystem tree.
- [ ] Render the surface based on the manifest: markdown, images, structured panels.
- [ ] Update live as the agent works.

🎯 In hivetool, selecting a task shows its surface — rendered from the agent's
`surface.json` — and it updates in real time as the agent writes.

---

## Phase 6 — Reference App Surface Rendering

The reference web app renders surfaces for chat-tagged tasks.

- [ ] Server exposes surface data via REST endpoint.
- [ ] Client renders the surface alongside the chat view.
- [ ] SSE pushes `surface_updated` events to trigger client refresh.

🎯 In the reference web app, a chat task's surface appears alongside the
conversation and updates live.

---

## Phase 7 — Clean Workspace Boundary

`skills/` currently gets seeded into `filesystem/`. These are system files
leaked into the content store — wrong separation. Surface makes this more
visible.

- [ ] Move skill seeding out of the agent workspace (or into a hidden/system
      namespace the agent can read but the consumer ignores).
- [ ] Ensure the workspace contains only agent-produced content.

🎯 A task's `filesystem/` directory contains only files the agent wrote —
no system-seeded files pollute the surface or the file tree.

