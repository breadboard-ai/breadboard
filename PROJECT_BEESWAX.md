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
state, and save logic directly into this file would be unsustainable. The project
decomposes it into focused components as a prerequisite for editing.

---

## Phase 1 — Componentize & Unlock Write Access

### 🎯 Objective

Open hivetool, pick `hive/`, and see the same UI as today — but the browser
prompts for **read-write** permission, and each tab's detail panel is rendered by
its own Lit element (`<template-detail>`, `<skill-detail>`, `<ticket-detail>`,
etc.) instead of inline methods on `BeesApp`.

**Observable proof:** The permission prompt says "edit files" (not just "view
files"). Inspecting the DOM shows the new element boundaries. No behavioral
regressions.

### Changes

#### `StateAccess` — readwrite permission

- `openDirectory()`: change `mode: "read"` → `mode: "readwrite"`.
- `#checkPermission()`: query/request `"readwrite"` instead of `"read"`.
- No fallback to read-only. Beekeepers get full access or nothing.

#### Component extraction

Extract from `app.ts` into standalone Lit elements:

| New element | Extracts from | Renders |
|---|---|---|
| `<template-list>` | `renderTemplatesList()` | Sidebar list |
| `<template-detail>` | `renderTemplateDetail()` | Detail panel |
| `<skill-list>` | `renderSkillsList()` | Sidebar list |
| `<skill-detail>` | `renderSkillDetail()` | Detail panel |
| `<ticket-list>` | `renderTicketsList()` + tree | Sidebar list |
| `<ticket-detail>` | `renderTicketDetail()` + file tree | Detail panel |

Each component receives its store as a **signal property** — the same
reactive-property pattern used throughout hivetool. `BeesApp` becomes a slim
orchestrator: tabs, routing, store wiring. No context providers — these are
shallow compositions, one level deep.

#### Template documentation

The header comments in `TEMPLATES.yaml` are the only documentation for the
template schema. Move them to:

**`packages/bees/docs/TEMPLATE_SCHEMA.md`** — a human-readable field reference
for beekeepers. Strip comments from `TEMPLATES.yaml` itself so round-tripping
via `js-yaml` is lossless.

---

## Phase 2 — Editable Primitives

### 🎯 Objective

A library of small, reusable edit components exists and can be composed into
any detail panel. Each primitive encapsulates one editing behavior — the same
architectural pattern as `<bees-truncated-text>` (self-contained, composes via
properties and events, no knowledge of the domain).

**Observable proof:** Import `<bees-editable-field>` into a scratch page, wire
it to a signal, type into it, and see the signal update. Same for chip-input,
textarea, etc. No store or domain coupling.

### Primitives

| Component | Behavior |
|---|---|
| `<bees-editable-field>` | Single-line text input. Property: `value` (string signal). Emits `change`. Read-only mode shows plain text; edit mode shows `<input>`. |
| `<bees-editable-textarea>` | Multi-line text. Monospace option for markdown/code. Auto-grows. |
| `<bees-chip-input>` | List-of-strings editor. Renders chips with ✕ remove. "Add" input with optional autocomplete suggestions via property. |
| `<bees-edit-controls>` | Save / Cancel / Delete button bar. Emits `save`, `cancel`, `delete` events. Shows dirty dot, spinner on save, "Saved ✓" flash. |

Each lives in `ui/primitives/` and has its own styles. They are domain-agnostic —
no imports from data stores. Domain components (`<template-detail>`,
`<skill-detail>`) compose them and wire them to store signals.

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

#### `TemplateStore` — write-back

- `saveTemplate(name: string, data: TemplateData)`: Finds the entry in the
  parsed array, replaces it, serializes the full array via `yaml.dump()`, and
  writes to `config/TEMPLATES.yaml` using
  `FileSystemFileHandle.createWritable()`.
- `createTemplate(data: TemplateData)`: Appends to the array and writes.
- `deleteTemplate(name: string)`: Removes from the array and writes.
- After every write, re-scan to sync the signal state.

#### `<template-detail>` — inline editor

Toggle between **view mode** (current read-only rendering) and **edit mode**:

- **Identity fields**: `name` (readonly after creation), `title`, `description`,
  `model`, `assignee` — text inputs.
- **Objective**: `<textarea>` with generous height.
- **List fields** (`functions`, `skills`, `tags`, `tasks`, `autostart`): Chip
  input — rendered as removable chips with an "add" input. `skills` and `tasks`
  chips are autocompleted from their respective stores.
- **`watch_events`**: Array of `{type}` objects — chip input on the `type` field.

Controls:
- **Edit** button in the header (pencil icon) → switches to edit mode.
- **Save** / **Cancel** buttons replace Edit while in edit mode.
- **Dirty indicator**: header shows an unsaved-changes dot.
- **Validation**: `name` must be non-empty and unique.

#### Create & Delete

- **Create**: "+" button in the template sidebar list. Opens edit mode with empty
  fields. `name` is editable (required, unique).
- **Delete**: Trash icon in the detail header, with a confirmation prompt. Not
  available for templates referenced by active tickets (show a warning instead).

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

#### `SkillStore` — write-back

- `saveSkill(dirName: string, data: SkillData)`: Serializes frontmatter via
  `yaml.dump()`, concatenates `---\n{frontmatter}---\n{body}`, and writes to
  `skills/{dirName}/SKILL.md`.
- `createSkill(dirName: string, data: SkillData)`: Creates the directory and
  `SKILL.md`.
- `deleteSkill(dirName: string)`: Removes the directory (recursive). File System
  Access API doesn't have recursive delete — must walk and remove entries.

#### `<skill-detail>` — inline editor

Same view/edit toggle pattern as templates:

- **Frontmatter fields**: `name`, `title`, `description` — text inputs.
  `allowed-tools` — chip input.
- **Body**: `<textarea>` styled as a code editor (monospace, generous height,
  preserves whitespace).

Controls mirror Phase 2: Edit / Save / Cancel / dirty indicator.

#### Create & Delete

- **Create**: "+" button in the skill sidebar list. Prompts for directory name
  (kebab-case, validated). Opens edit mode with empty fields.
- **Delete**: Trash icon, confirmation prompt. Warn if any template references
  this skill.

---

## Phase 5 — Polish

### 🎯 Objective

Editing feels solid and safe: keyboard shortcuts work, unsaved changes are
guarded, and the UI provides clear feedback on every mutation.

**Observable proof:** Make an edit, try to navigate away — see a "discard
changes?" prompt. Press Cmd+S — save fires. Create a template, delete it, undo
via browser back — the list updates correctly.

### Changes

- **Keyboard shortcuts**: Cmd+S to save, Escape to cancel edit mode.
- **Navigation guard**: `beforeunload` event and in-app tab-switch guard when
  dirty.
- **Optimistic UI**: Save button shows a spinner, then a brief "Saved ✓" flash.
- **Error handling**: If the write fails (permission revoked, disk full), show an
  inline error banner — don't silently swallow.
- **Undo**: Not a built-in undo system, but the textarea/inputs support
  browser-native Cmd+Z within the edit session.

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
  TEMPLATE_SCHEMA.md         ← [NEW] field reference (from YAML comments)

hive/config/
  TEMPLATES.yaml             ← strip header comments
```
