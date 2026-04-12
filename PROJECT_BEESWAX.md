# Project Beeswax — Editable Skills & Templates in Hivetool

Hivetool is a devtools app for beekeepers — people who configure and operate
agent swarms. Today it's read-only: you can inspect templates, skills, tickets,
and logs but can't change any of the hive's configuration. This project makes
skills and templates fully editable from the browser, turning hivetool from a
dashboard into a workbench.

## Architecture Context

The hive's configuration lives on disk:

```
hive/
  config/
    SYSTEM.yaml          # root template, hive title
    TEMPLATES.yaml       # array of template dicts (single file)
  skills/
    {name}/SKILL.md      # YAML frontmatter + markdown body
```

The Python backend reads these files on every use — `playbook.py` loads
`TEMPLATES.yaml` via `yaml.safe_load`, `skills.py` scans `skills/` and parses
frontmatter. Neither writes back. Hivetool edits land on disk and take effect
immediately with no server coordination.

Hivetool accesses the `hive/` directory via the File System Access API. Today it
requests `mode: "read"`. Editing requires `mode: "readwrite"`.

## Current Pain: The Monolith

`app.ts` is a 1432-line Lit element that renders all five tabs (tickets, events,
sessions, templates, skills) inline. Adding form controls, validation, dirty
state, and save logic directly into this file would be unsustainable. The
project decomposes it into focused components as a prerequisite for editing.

---

## Phase 1 — Componentize & Unlock Write Access ✅

### 🎯 Objective

Open hivetool, pick `hive/`, and see the same UI as today — but the browser
prompts for **read-write** permission, and each tab's detail panel is rendered
by its own Lit element (`<template-detail>`, `<skill-detail>`,
`<ticket-detail>`, etc.) instead of inline methods on `BeesApp`.

**Observable proof:** The permission prompt says "edit files" (not just "view
files"). Inspecting the DOM shows the new element boundaries. No behavioral
regressions.

### Changes

- [x] `StateAccess` — `mode: "readwrite"` in `openDirectory()`,
      `queryPermission()`, `requestPermission()`.
- [x] Extract `<template-list>`, `<template-detail>` from `app.ts`.
- [x] Extract `<skill-list>`, `<skill-detail>` from `app.ts`.
- [x] Extract `<ticket-list>`, `<ticket-detail>` from `app.ts`.
- [x] Extract `<event-list>`, `<event-detail>` from `app.ts`.
- [x] Extract `<log-list>` from `app.ts`.
- [x] Create `shared-styles.ts` with common design tokens.
- [x] Slim `app.ts` to orchestrator (1432 → ~390 lines).
- [x] Move YAML comments to `packages/bees/docs/TEMPLATE_SCHEMA.md`.
- [x] Strip comments from `TEMPLATES.yaml` for lossless round-tripping.

---

## Phase 2 — Editable Primitives ✅

### 🎯 Objective

A library of small, reusable edit components exists and can be composed into any
detail panel. Each primitive encapsulates one editing behavior — the same
architectural pattern as `<bees-truncated-text>` (self-contained, composes via
properties and events, no knowledge of the domain).

### Changes

- [x] `<bees-editable-field>` — single-line text, view/edit toggle.
- [x] `<bees-editable-textarea>` — multi-line, monospace option, auto-grow.
- [x] `<bees-chip-input>` — chips with ✕ remove, add input, autocomplete.
- [x] `<bees-edit-controls>` — save/cancel/delete bar, dirty dot, spinner, saved
      flash, delete confirmation.

---

## Phase 3 — Template Editing

### 🎯 Objective

Open an existing template in hivetool. Edit its objective text. Click Save. The
change is written to `TEMPLATES.yaml` on disk. The Python backend picks up the
new objective on the next ticket creation.

**Observable proof:** Edit a template's objective in hivetool, create a ticket
from that template via the running server, and see the new objective in the
ticket's `objective.md`.

### Changes

- [x] `TemplateStore.saveTemplate()` — find entry, replace, serialize via
      `yaml.dump()`, write to `TEMPLATES.yaml`.
- [x] `TemplateStore.createTemplate()` — append to array and write.
- [x] `TemplateStore.deleteTemplate()` — remove from array and write.
- [x] Re-scan after every write to sync signal state.
- [x] `<template-detail>` — view/edit toggle with Edit button.
- [x] Wire identity fields: `name` (readonly after creation), `title`,
      `description`, `model`, `assignee`.
- [x] Wire objective `<textarea>`.
- [x] Wire list fields as chip inputs: `functions`, `skills`, `tags`, `tasks`,
      `autostart`. Autocomplete `skills`/`tasks` from stores.
- [x] Wire `watch_events` chip input on the `type` field.
- [x] Dirty indicator + Save/Cancel controls.
- [ ] Validation: `name` non-empty and unique.
- [x] Create: "+" button in sidebar → edit mode with empty fields.
- [x] Delete: trash icon with confirmation. Warn if referenced by tickets.

---

## Phase 4 — Skill Editing

### 🎯 Objective

Open an existing skill in hivetool. Edit its markdown body. Click Save. The
`SKILL.md` file is overwritten on disk. The backend picks up the new content on
the next session that loads this skill.

**Observable proof:** Edit a skill's body in hivetool, start a new agent session
that uses that skill, and see the agent's system instruction contain the updated
text.

### Changes

- [x] `SkillStore.saveSkill()` — serialize frontmatter via `yaml.dump()`,
      concatenate `---\n{frontmatter}---\n{body}`, write to `SKILL.md`.
- [x] `SkillStore.createSkill()` — create directory and `SKILL.md`.
- [x] `SkillStore.deleteSkill()` — recursive directory removal.
- [x] `<skill-detail>` — view/edit toggle with Edit button.
- [x] Wire frontmatter fields: `name`, `title`, `description`.
- [x] Wire `allowed-tools` chip input.
- [x] Wire body `<textarea>` (monospace).
- [x] Dirty indicator + Save/Cancel controls.
- [x] Create: "+" button in sidebar → directory name prompt (kebab-case).
- [x] Delete: trash icon with confirmation. Warn if referenced by templates.

---

## Phase 5 — Polish

### 🎯 Objective

Editing feels solid and safe: keyboard shortcuts work, unsaved changes are
guarded, and the UI provides clear feedback on every mutation.

**Observable proof:** Make an edit, try to navigate away — see a "discard
changes?" prompt. Press Cmd+S — save fires. Create a template, delete it, undo
via browser back — the list updates correctly.

### Changes

- [x] Cmd+S to save, Escape to cancel edit mode.
- [x] `beforeunload` guard + in-app tab-switch guard when dirty.
- [x] Save button spinner → "Saved ✓" flash (already in `<bees-edit-controls>`).
- [x] Error banner on write failure (permission revoked, disk full).
- [x] Browser-native Cmd+Z within edit session (no custom undo system).

---

## Non-Goals

- **SYSTEM.yaml editing**: Out of scope. It has only 3 fields and rarely
  changes.
- **Multi-user conflict resolution**: The backend never writes to config files.
  Only one beekeeper edits at a time.
- **Syntax highlighting / code editor**: A plain `<textarea>` for markdown. A
  CodeMirror integration could be a future enhancement but isn't needed for
  usefulness.
- **Ticket editing**: Tickets are runtime artifacts owned by the scheduler, not
  config. Editing them from hivetool would break invariants.

## File Map

```
hivetool/src/
  data/
    state-access.ts          ← readwrite upgrade
    template-store.ts        ← add save/create/delete
    skill-store.ts           ← add save/create/delete
  ui/
    app.ts                   ← slim down to orchestrator
    primitives/
      editable-field.ts      ← [NEW] single-line text
      editable-textarea.ts   ← [NEW] multi-line text
      chip-input.ts          ← [NEW] list-of-strings editor
      edit-controls.ts       ← [NEW] save/cancel/delete bar
    template-list.ts         ← [NEW] sidebar
    template-detail.ts       ← [NEW] view + inline editor
    skill-list.ts            ← [NEW] sidebar
    skill-detail.ts          ← [NEW] view + inline editor
    ticket-list.ts           ← [NEW] sidebar
    ticket-detail.ts         ← [NEW] view + file tree
    event-list.ts            ← [NEW] sidebar
    event-detail.ts          ← [NEW] detail
    log-list.ts              ← [NEW] sidebar
    shared-styles.ts         ← [NEW] extracted common styles

packages/bees/docs/
  template_schema.md         ← [NEW] field reference (from YAML comments)

hive/config/
  TEMPLATES.yaml             ← strip header comments
```
