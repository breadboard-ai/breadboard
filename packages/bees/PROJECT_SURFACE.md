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

## Phase 5a — Surface / Detail Tab Layout

Extract ticket detail into two panes behind a tab bar. New wrapper component
`<bees-ticket-pane>` owns the header, tab bar, and view switching. The existing
`<bees-ticket-detail>` becomes the "Detail" tab content (timeline only, header
removed). A new `<bees-surface-pane>` component gets the full main area for
the "Surface" tab.

- [x] New `ticket-pane.ts` — owns ticket header, status badge, identity chips,
      and a `Surface · Detail` tab bar. Composes `<bees-surface-pane>` and
      `<bees-ticket-detail>` as tab bodies.
- [x] Refactor `ticket-detail.ts` — strip the header; render only the timeline
      content (context, objective, chat, outcome, suspend, tags, files).
- [x] New `surface-pane.ts` — full-pane surface view. Receives the ticket ID,
      reads root `surface.json`, renders the existing `<bees-surface-view>`.
- [x] `app.ts` — swap `<bees-ticket-detail>` for `<bees-ticket-pane>` in the
      tickets tab main area.
- [x] Default to Surface tab when a surface exists, Detail otherwise.

🎯 Selecting a task shows a `Surface · Detail` tab bar below the header. Surface
is the default when present. Each tab gets the full main pane.

---

## Phase 5b — Bundle Rendering ✅

Surface items with `render: "bundle"` render in a sandboxed iframe.

- [x] Shared code in `common/`: `bundle-types.ts` (message protocol),
      `message-bridge.ts` (host↔iframe postMessage bridge),
      `iframe-runtime.ts` (self-contained HTML generator with inline React
      UMD, CJS require shim, `window.opalSDK` proxy, error boundary).
- [x] `<bees-bundle-frame>` component — hosts a single sandboxed iframe.
      Manages MessageBridge lifecycle, relays `readFile` requests to
      `TicketStore.readFileContent`, displays component errors.
- [x] `react-cache.ts` — fetches React 18 UMD from unpkg once per session,
      builds and caches the iframe blob URL shared across all frames.
- [x] `surface-pane.ts` — detects `render: "bundle"` items, reads JS/CSS
      from the ticket filesystem, renders each as a `<bees-bundle-frame>`
      card. Non-bundle items render as before. Blob URL revoked on dispose.

🎯 A surface item with `render: "bundle"` displays as a live, sandboxed iframe
in the surface pane.

---

## Phase 5c — SDK Extensibility ✅

Make `window.opalSDK` a generic RPC proxy so that adding new SDK methods
is a host-side-only concern. The iframe runtime becomes closed to modification.

- [x] Replace the hardcoded `opalSDK` object in `iframe-runtime.ts` with a
      `Proxy` that forwards any method call as a generic
      `{ type: "sdk.call", method, args, requestId }` message. Every call
      returns a `Promise` (fire-and-forget methods resolve immediately on
      the host).
- [x] Add `sdk.call` / `sdk.call.response` message types to `bundle-types.ts`.
      Removed per-method types (`readFile`, `navigate`, `emit`). Added
      `SdkHandlers` type for the host-side registry.
- [x] In `bundle-frame.ts`, replaced the inline `readFile` relay with a
      generic `#handleSdkCall` dispatcher backed by `sdkHandlers: SdkHandlers`.
- [x] In `surface-pane.ts`, `#makeSdkHandlers()` builds the registry with
      `readFile`, `navigateTo`, and `emit` handlers.

🎯 Adding a new `window.opalSDK.foo()` method requires only registering a
handler on the host — no changes to `iframe-runtime.ts` or `bundle-types.ts`.

---

## Phase 5d — Markdown Rendering and Content Preview ✅

Rich rendering for markdown items and on-demand content preview.

- [x] Add `markdown-it` dependency to `hivetool/package.json`.
- [x] Extract the `markdown` Lit directive to `common/markdown.ts` (shared
      between `web` and `hivetool`). `web/src/directives/markdown.ts`
      re-exports from common.
- [x] Surface view renders `.md` items as formatted markdown (not raw text)
      via the shared `markdown` directive, with full styling for headings,
      code blocks, tables, blockquotes, and links.
- [x] Items with `path` show an expandable content preview area, loaded on
      demand when clicked. Content is cached after first load. Non-markdown
      files render as preformatted text.
- [x] `surface-pane.ts` passes a `contentLoader` callback to `surface-view`
      that delegates to `TicketStore.readFileContent`.

🎯 Markdown surface items render as formatted HTML. Items with file paths show
on-demand content previews.

---

## Phase 5e — Multi-Scope Surface Discovery

Walk the filesystem tree for all `surface.json` files, aggregate across scopes.

- [ ] `TicketStore.readAllSurfaces(ticketId)` — recursively walk
      `filesystem/` for all `surface.json` files, return keyed by scope path.
- [ ] Surface pane shows a scope selector when multiple surfaces exist.
- [ ] Default to root scope; sub-scope surfaces accessible via selector.

🎯 When a task has sub-agent scopes with their own surfaces, all are
discoverable and individually viewable in the surface pane.

---

## Phase 5f — Chat in Surface (Bento Grid Layout)

Chat UI (log + input) rendered as a built-in surface item inside a CSS grid
with bento box layout rules.

- [x] New `chat-panel.ts` — `<bees-chat-panel>` extracted from
      `ticket-detail.ts`. Combines chat log and interactive input UI
      (text reply, choice cards) into a single component. Renders
      conditionally based on chat history and suspend state.
- [x] `surface-pane.ts` — bento grid layout. Composes `<bees-chat-panel>`
      alongside agent-declared surface items. Chat takes the left half
      when present; content blocks (bundles + surface-view) fill the
      right half or full width without chat.
- [x] `ticket-detail.ts` — stripped chat log, reply/choice forms, and
      related state/styles. Non-interactive suspend fallback preserved.
- [x] `ticket-pane.ts` — Surface tab shown when surface OR chat content
      exists. `probeSurface` checks both conditions.
- [x] Exported `hasChatContent(ticket)` utility for reuse by parent
      components (tab visibility probing).

🎯 Selecting a task with chat history shows the Surface tab with a bento
grid layout — chat on the left half, surface items on the right.

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
