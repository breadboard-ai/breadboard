# Surface Schema — Design Exploration

This document explores the design space for the surface format. Surface is the
mechanism by which agents present curated output to users — not chat text, but
structured, persistent, updatable artifacts that a consumer application renders.

The format choices here are load-bearing. Once agents start writing surfaces and
consumers start reading them, changing the shape is expensive. The goal is to
find the right structural slice — decisions that survive evolution — not
necessarily the minimal one.

## Structural Decisions

Design arrived at by working backward from consumption — what the user sees and
how — rather than forward from what's convenient for agents to produce.

### Two UX projections, one model

Two consumption patterns define the design space:

- **Tabbed browser.** Each surface item appears as a tab. Tabs carry change
  indicators (new, updated, removed) — familiar to coders and researchers. The
  consumer controls layout; items are full-pane documents.
- **Dashboard.** Each surface item appears as a card in a composed view. Items
  update in place. Familiar to a broader audience — think personal finance,
  project status, or research overview. Layout carries domain intent.

Both projections consume the same underlying surface model. The format is
projection-agnostic: every item has identity, title, type, content reference,
and semantic role. Tabs ignore role and render a flat list. Dashboards use role
and section grouping to compose a layout.

### The orchestrating agent is the view controller

Per-scope surfaces mean each sub-agent writes its own content. But a dashboard
needs domain-aware composition — the finance agent knows that "monthly expenses"
is the hero card and "transaction log" is supporting detail. The consumer app
doesn't know this.

The **orchestrating agent** (the parent who delegated to sub-agents) is the
natural view controller. It can read everything in the shared workspace. It
writes its own surface that references files produced by sub-agents and carries
the curation metadata — which items, in which sections, with which roles.

Sub-agents produce raw content (markdown reports, bundles, images). The
orchestrating agent reads those outputs and writes a curated surface.

### Two entity types, both flat

The surface format has exactly two entity types:

**Sections** — declared, named groups with their own metadata. A section has an
id, a title, an optional description, and an order. Sections provide semantic
grouping for consumers that support it (dashboards use sections as
regions/rows; tab browsers can use sections as tab groups or ignore them).

**Items** — typed content leaves. Each item has an id, a title, a type (how to
render), a content reference (path to file and/or inline content), a semantic
role (e.g., primary, supporting, status), an order within its section, and a
section reference.

Both are flat. Items reference sections by id — no nesting, no containment.
This gives single-level grouping without the complexity of recursive structure.

### Bundles are leaves, not composition primitives

A bundle (sandboxed JS/CSS rendered in an iframe) is a content type like any
other — a leaf node in the surface. It is not a compositor or layout container.
Using bundles as composition primitives would require slot-based embedding (à la
Shadow DOM), which is a complexity explosion.

This makes bundles the **escape hatch for complex layout within a single item**.
If an agent needs rich, interactive, deeply nested presentation for one piece of
content, it produces a bundle. The surface format doesn't need to express that
layout — the bundle handles it internally.

Single-level grouping in the surface format + bundles as leaves covers a wide
range of presentation needs without introducing recursive structure.

### Change state is consumer-computed

Both UX projections rely on change indicators (new/updated/removed). This state
is **not** encoded in the surface format. Instead:

- The consumer already receives `surface_updated` events via SSE (Phase 1).
- `FileSystemObserver` provides per-file modification events (hivetool).
- The consumer tracks previously-seen item identities and diffs against the
  current surface to derive change state.

The surface format provides stable item identity. The consumer computes change
state from that identity plus its own observation of updates over time.

### Item types are MIME types, with a render hint escape hatch

Items do not carry an explicit `type` field. Instead, the item's content type is
the MIME type inferred from the file extension of its `path` — `findings.md` is
`text/markdown`, `chart.png` is `image/png`, etc. The consumer maps MIME type to
renderer.

An optional `render` field overrides or refines the rendering mechanism for cases
where MIME type alone is insufficient. Today the only known render hint is
`bundle` — a `.js` file that should be executed in a sandboxed iframe rather than
displayed as code, with a companion `.css` file discovered by convention.

Future render hints (e.g., `table` for rendering JSON/CSV as a data table) can
be added without changing the format structure. Consumers ignore render hints
they don't support and fall back to MIME-based rendering.

### Content model: description + path

Each item has two optional content fields:

- **`path`** — a file path relative to the workspace root. The common case.
  The consumer loads the file and renders it according to its MIME type (or
  render hint). Paths use the same workspace-relative format as
  `files_write_file` (e.g., `research/findings.md`, `app/bundle.js`).

- **`description`** — inline text. Serves three roles depending on context:
  - **Standalone content** when `path` is absent — lightweight items like status
    text or progress messages where a file would be overkill.
  - **Preview/placeholder** when `path` is present — the card-sized summary in a
    dashboard view, or a loading placeholder while the full file is fetched.
  - **Metadata** in all cases — a human-readable summary useful for tab labels,
    card subtitles, or accessibility.

Both fields are optional, but at least one must be present for the item to be
meaningful.

### Representation: snapshot with a version counter

The surface is a single `surface.json` file that the agent overwrites on every
change. This is the snapshot model (Option A from the exploration below).

**Why snapshot over mutation log or directory-as-structure:** Agents are good at
expressing complete state and bad at tracking incremental changes. An LLM
reassesses the full picture on each turn — "here's what I want to present now"
is a natural output. Producing precise diffs of previous surface state is
fragile and error-prone.

**Rollback is a consumer feature, not a format feature.** The consumer receives
`surface_updated` events (Phase 1). On each event it reads the new surface,
diffs against its cached previous version, and stores a history entry.
Roll-back/roll-forward is just rendering a previous snapshot from the consumer's
history stack. The format doesn't need to carry history — the consumer builds it
from observation.

**Version counter.** A monotonic `version` integer at the top level lets the
consumer distinguish "same surface rewritten" from "new surface state" and makes
change detection trivial. The agent increments it on every write.

## Format Specification

### Top-level shape

```json
{
  "version": «integer»,
  "title": «string»,
  "sections": [ «Section, ...» ],
  "items": [ «Item, ...» ]
}
```

| Field      | Type      | Required | Description                                                   |
| ---------- | --------- | -------- | ------------------------------------------------------------- |
| `version`  | integer   | **yes**  | Monotonic counter, incremented by the agent on every write.   |
| `title`    | string    | no       | Human-readable name for the surface (e.g., "Finance Dashboard"). Used as a tab group label, dashboard heading, or window title. |
| `sections` | Section[] | no       | Declared section groups. Omit if all items belong to the default section. |
| `items`    | Item[]    | **yes**  | Ordered list of content items. Array position determines display order. |

### Section

```json
{
  "id": "overview",
  "title": "Overview",
  "description": "High-level financial health metrics"
}
```

| Field         | Type    | Required | Description                                                     |
| ------------- | ------- | -------- | --------------------------------------------------------------- |
| `id`          | string  | **yes**  | Stable identifier. Items reference this via their `section` field. |
| `title`       | string  | **yes**  | Human-readable section heading.                                 |
| `description` | string  | no       | Brief description of the section's purpose.                     |
| `active`      | boolean | no       | When `true`, this section is selected by default in tabbed views. At most one section should be marked active. |

Section order is determined by array position in `sections`.

### Item

```json
{
  "id": "expenses",
  "title": "Monthly Expenses",
  "path": "app/bundle.js",
  "description": "Interactive expense breakdown by category",
  "render": "bundle",
  "role": "primary",
  "section": "overview"
}
```

| Field         | Type   | Required | Description                                                     |
| ------------- | ------ | -------- | --------------------------------------------------------------- |
| `id`          | string | **yes**  | Stable identifier. Must be unique within the surface. Used by the consumer for change tracking. |
| `title`       | string | **yes**  | Human-readable label (tab title, card header).                  |
| `path`        | string | no       | File path relative to the workspace root. MIME type is inferred from the file extension. At least one of `path` or `description` must be present. |
| `description` | string | no       | Inline text content. Serves as standalone content (when `path` is absent), preview/placeholder (when `path` is present), or metadata (always). At least one of `path` or `description` must be present. |
| `render`      | string | no       | Rendering mechanism override. When absent, the consumer uses the default renderer for the MIME type. Known values: `bundle` (sandboxed iframe; companion CSS discovered by convention from the same stem). |
| `role`        | string | no       | Semantic role expressing the agent's presentation intent. The consumer interprets role for its projection. Known values: `primary` (hero/featured item), `supporting` (secondary detail), `status` (lightweight status/progress indicator). Open-ended — consumers ignore unrecognized roles. |
| `section`     | string | no       | The `id` of the section this item belongs to. When absent, the item belongs to the **default section** — an implicit, unnamed section for ungrouped items. |

Item order within a section is determined by array position in `items` (filtered
to the section). Items in the default section appear in array order after all
declared sections, unless the consumer chooses otherwise.

### Example: Finance Dashboard

```json
{
  "version": 3,
  "title": "Personal Finance",
  "sections": [
    {"id": "overview", "title": "Overview", "active": true},
    {"id": "activity", "title": "Recent Activity"}
  ],
  "items": [
    {
      "id": "expenses",
      "title": "Monthly Expenses",
      "path": "app/bundle.js",
      "description": "Interactive expense breakdown by category",
      "render": "bundle",
      "role": "primary",
      "section": "overview"
    },
    {
      "id": "net-worth",
      "title": "Net Worth Trend",
      "path": "research/net-worth-chart.png",
      "description": "Net worth over the last 12 months",
      "section": "overview"
    },
    {
      "id": "transactions",
      "title": "Recent Transactions",
      "path": "research/transactions.md",
      "description": "Last 30 days across all accounts",
      "section": "activity"
    },
    {
      "id": "sync-status",
      "title": "Sync Status",
      "description": "3 of 5 accounts synced. Last sync: 2 hours ago.",
      "role": "status"
    }
  ]
}
```

In this example:

- The `expenses` item uses `render: "bundle"` — the consumer loads `app/bundle.js`
  in a sandboxed iframe and discovers `app/bundle.css` by convention.
- The `net-worth` item has no render hint — the consumer infers `image/png` from
  the `.png` extension and renders it as an image.
- The `transactions` item is markdown rendered from a file.
- The `sync-status` item has no `path` — its `description` is the content.
  It has no `section`, so it belongs to the default section.

### Conventions

**File location.** The orchestrating agent writes `surface.json` in its writable
scope within the shared filesystem: `{scope}/surface.json`. For root agents,
this is `surface.json` at the workspace root. For sub-agents, it is
`{slug}/surface.json`.

**Path resolution.** Paths in items are relative to the workspace root (the
`filesystem/` directory of the task), not relative to `surface.json`. This
matches the path format used by `files_write_file`.

**Broadcast.** After writing or updating `surface.json`, the agent calls
`events_broadcast` with type `surface_updated`. The consumer receives this via
the `BroadcastReceived` event (Phase 1) and re-reads the surface.

**Schema evolution.** The initial format has no `schema` field. If the structure
of `surface.json` changes in a breaking way, a `schema` field will be added.
Absence of `schema` means the initial format described here.

---

## Appendix: Exploration Notes

The sections below capture the original design exploration that led to the
structural decisions above. Preserved as historical context — the reasoning
behind why alternatives were considered and rejected.

### Representation options considered

Three representations were evaluated:

- **Snapshot** (`surface.json`) — single JSON file, agent rewrites on every
  change. Simple to read, atomic, familiar. ✅ **Chosen.** Agent's natural mode
  is full-state expression; version counter addresses change detection.

- **Mutation log** (`surface/*.json` as ordered operations) — append-only
  sequence of add/update/remove operations. History for free, but requires
  compaction, sequence tracking, and the agent to produce diffs. Rejected:
  rollback is better handled consumer-side.

- **Directory-as-structure** (`surface/*.json` where each file IS an item) —
  filesystem as manifest, `FileSystemObserver` gives mutation stream for free.
  Attractive alignment with existing infrastructure, but requires
  `files_delete_file` (which doesn't exist) and loses atomicity. Rejected:
  snapshot is simpler and agent-friendly.

### Content model options considered

- **File reference only** — every item requires a file. Heavy for lightweight
  content (status messages).
- **Inline content only** — self-contained but awkward for large content in JSON.
- **Both (mutually exclusive)** — `path` for files, `content` for inline.
  Consumer checks which is present.
- **Both (complementary)** — `content` as preview, `path` as full document.
  ✅ **Evolved into the `description` + `path` model** — `description` serves as
  preview, standalone content, and metadata, avoiding the ambiguity of a generic
  `content` field.

### Bundle integration options considered

- **Signal-only** — surface item says "there's a bundle" and the consumer uses
  existing discovery (`getBundle` API).
- **Explicit reference** — surface item references specific JS/CSS files.
  Self-contained but duplicates discovery logic.
- **Convention reference** — surface item references the JS file, consumer
  infers CSS by convention.
  ✅ **Resolved by the render hint model** — a bundle item uses `path` for the JS
  file, `render: "bundle"` for the rendering mechanism, and CSS is discovered by
  convention (same stem).

### Ordering

Resolved: items carry an `order` field. Sections also carry an `order` field.
The consumer sorts sections by order, then items within each section by order.
Array position in `surface.json` provides a natural secondary sort.

### Versioning

Resolved: a single `version` counter at the surface level. The surface evolves
as a unit — no per-item versioning. The version counter is monotonic and
incremented by the agent on every write.

### Presentation hints

Resolved: items carry a semantic `role` field (e.g., `primary`, `supporting`,
`status`) — not layout, but intent. The consumer interprets role for its
projection (dashboards use it for sizing/placement; tab browsers may ignore it).
Rich layout hints (grid positions, spans) were rejected — they cross the MVC
boundary by making the agent do layout.

## Remaining Open Questions

1. **Ordering within sections.** Should `order` be a sparse integer (allows
   insertion: 10, 20, 30) or a dense index (0, 1, 2)? Sparse is more
   flexible for agents that don't want to rewrite all orders when inserting.

2. **Consumer write-back.** Should the user be able to annotate, pin, or
   reorder items? If yes, the surface needs a clear ownership model — agent
   writes `surface.json`, consumer writes a separate `surface-prefs.json`.

3. **Cross-scope path resolution.** The orchestrating agent writes paths like
   `research/findings.md`. These are relative to the workspace root. Should the
   format allow absolute paths or only workspace-relative?

4. **Schema versioning.** The `version` counter tracks surface content versions.
   A separate concern is **schema** versioning — what happens when the structure
   of `surface.json` itself evolves. A `schema` field (e.g., `"schema": 1`)
   would future-proof this.

