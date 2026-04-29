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
- **Notification via `events_broadcast`.** The agent writes content files,
  writes `surface.json`, then broadcasts `surface_updated`. No new function —
  reuses existing infrastructure.
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

## Phase 2 — Surface Schema ✅

Surface format specified in [docs/surface-schema.md](docs/surface-schema.md).

- [x] Snapshot `surface.json` — agent overwrites on every change, with a
      monotonic `version` counter for change detection. Rollback is
      consumer-side.
- [x] Two flat entity types: **Sections** (declared groups with id, title,
      description) and **Items** (typed content leaves with id, title, path,
      description, render hint, role, section reference).
- [x] Item types via MIME (inferred from file extension) + optional `render`
      hint for cases like bundles.
- [x] Content model: `description` (inline/preview) + `path` (file reference),
      both optional but at least one required.
- [x] Orchestrating agent is the view controller — curates sub-agent content
      into its own surface. Bundles are leaves, not composition primitives.
- [x] Array position determines ordering (sections and items). No explicit
      `order` field.

🎯 A written schema spec that an agent can follow and a consumer can render,
validated by the finance dashboard example in the schema doc.

---

## Phase 3 — Surface Skill ✅

Teach agents to produce surfaces.

- [x] Write a skill that teaches the agent how to write `surface.json`.
      [SKILL.md](hive/skills/surface/SKILL.md)
- [x] The skill covers: writing content files, structuring the manifest,
      broadcasting `surface_updated`. Includes the core loop (write content →
      write surface.json → broadcast), full format reference, and a worked
      example showing incremental updates across three versions.
- [x] Composable design: skill layers on top of any primary skill via
      `allowed-tools: [files.*, events.*]`. Any template can add `surface` to
      its `skills` list alongside existing skills.

🎯 An agent with the surface skill writes a `surface.json` in its scope
directory and broadcasts `surface_updated`. The event reaches a subscribed
consumer.

---

## Phase 4 — Hivetool Surface Discovery

Minimal surface rendering in hivetool. New `<bees-surface-view>` component,
root-scope `surface.json` only, plain text rendering.

- [x] Surface types in `hivetool/src/data/types.ts` (`SurfaceManifest`,
      `SurfaceSection`, `SurfaceItem`).
- [x] `readSurface(ticketId)` in `ticket-store.ts` — reads
      `filesystem/surface.json` for a ticket.
- [x] New `surface-view.ts` component — renders title, sections, items as plain
      text cards. Status items as compact indicators.
- [x] `ticket-detail.ts` — renders `<bees-surface-view>` above the file tree
      when a surface exists. Re-reads on filesystem observer updates.

🎯 In hivetool, selecting a task with a `surface.json` shows the surface content
rendered as structured cards, and it updates in real time.

---

## Phase 5 — Hivetool Full Surface View

Promote the surface to a full-pane view with rich rendering.

- [ ] Sub-tab layout in ticket detail: `Surface · Detail` tabs, surface as the
      default when present. Each gets the full main pane area.
- [ ] Markdown rendering for `.md` items (basic or library-backed).
- [ ] Bundle rendering for `render: "bundle"` items (sandboxed iframe with blob
      URLs from File System Access API reads).
- [ ] Multi-scope surface discovery — walk the filesystem tree for all
      `surface.json` files, scope selector when multiple exist.
- [ ] File content preview for items with `path` (loaded on demand).

🎯 The surface view is a full-pane peer to ticket detail, with rendered markdown,
bundle iframes, and content previews.

---

## Phase 6 — Reference App Surface Rendering

The reference web app renders surfaces for chat-tagged tasks.

- [ ] Server exposes surface data via REST endpoint.
- [ ] Client renders the surface alongside the chat view.
- [ ] SSE pushes `surface_updated` events to trigger client refresh.

🎯 In the reference web app, a chat task's surface appears alongside the
conversation and updates live.

---

## Phase 7 — Reverse Side-Channel

Structured event dispatch from box → hivetool via a `notifications/` directory,
mirroring the mutation path (hivetool → box via `mutations/`).

- [ ] Box subscribes to `BroadcastReceived` and writes notification files to
      `hive/notifications/{uuid}.json`.
- [ ] Hivetool watches `notifications/` with `FileSystemObserver`, dispatches to
      signal-backed handlers.
- [ ] `surface_updated` is the first consumer, but the mechanism is general.

🎯 Hivetool receives structured, typed events from the box through the filesystem
side-channel, enabling targeted reactions (e.g., re-read only the affected
surface) instead of coarse filesystem rescans.

---
