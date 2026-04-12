# Hivetool

Hivetool (name inspired by the
[actual tool](https://en.wikipedia.org/wiki/Hive_tool) beekeepers use) is bees'
built-in developer workbench. It reads and writes the hive directory directly —
the same files the scheduler operates on — giving a side-channel view into
templates, skills, system config, and task state.

Think of it as the framework's DevTools.

Hosted at: https://breadboard-ai.github.io/breadboard/hivetool/

## How it accesses the hive

Hivetool uses the browser's
[File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
to read and write hive files directly from disk. On first visit, the user picks
the `hive/` directory via `showDirectoryPicker`. The directory handle is
persisted in IndexedDB so subsequent visits skip the picker.

Access is managed by `StateAccess` (`src/data/state-access.ts`), which owns the
directory handle, permission lifecycle, and `accessState` signal (`"none"`,
`"prompt"`, `"ready"`). All data stores share a single `StateAccess` instance.

No server is required. Hivetool operates entirely in the browser.

## Architecture

Hivetool is a Vite + Lit application using `signal-polyfill` for reactive state.

### Data layer (`src/data/`)

Signal-backed reactive stores that parse hive files from the directory handle:

| Store           | Source                    | Reads | Writes |
| --------------- | ------------------------- | ----- | ------ |
| `TemplateStore` | `config/TEMPLATES.yaml`   | ✓     | ✓      |
| `SkillStore`    | `skills/*/SKILL.md`       | ✓     | ✓      |
| `SystemStore`   | `config/SYSTEM.yaml`      | ✓     | ✓      |
| `TicketStore`   | `tickets/*/metadata.json` | ✓     | —      |
| `LogStore`      | `../logs/*.log.json`      | ✓     | —      |

Each store follows the same pattern:

1. **Constructor** takes a `StateAccess` instance.
2. **`activate()`** resolves the subdirectory handle and parses the data.
3. **Signals** expose the parsed data reactively.
4. **Write operations** serialize back to YAML/JSON and write via the File
   System Access API's `createWritable()`.

The stores use file system observers where available to detect external changes
(e.g. when the scheduler writes a new ticket while hivetool is open).

### Router (`src/data/router.ts`)

Hash-based URL routing. Format: `#/{tab}/{selectionId}`.

Valid tabs: `tickets`, `events`, `logs`, `templates`, `skills`, `system`.

Uses `history.pushState` so browser back/forward works.

### UI layer (`src/ui/`)

Lit components following a list/detail pattern:

| Tab       | Sidebar (list)  | Main panel (detail) |
| --------- | --------------- | ------------------- |
| Tasks     | `ticket-list`   | `ticket-detail`     |
| Events    | `event-list`    | `event-detail`      |
| Sessions  | `log-list`      | `log-detail`        |
| Templates | `template-list` | `template-detail`   |
| Skills    | `skill-list`    | `skill-detail`      |
| System    | _(no sidebar)_  | `system-detail`     |

The root component `BeesApp` (`src/ui/app.ts`) orchestrates tab navigation,
store lifecycle, and composes the list/detail components.

### Editing primitives (`src/ui/primitives/`)

Reusable Lit components for inline editing:

| Primitive           | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `editable-field`    | Single-line inline text editor.                 |
| `editable-textarea` | Multi-line inline text editor.                  |
| `chip-input`        | Tag/list editor with add/remove chip UI.        |
| `edit-controls`     | Save/Cancel/Delete button bar with dirty state. |

These primitives are composed by the template, skill, and system detail views to
provide a consistent editing experience.

### Editing workflow

1. User clicks "Edit" on a detail panel → fields become editable.
2. Changes are tracked in component-local state (not written to disk yet).
3. On "Save" (or Cmd+S), the store's write method serializes and writes to disk,
   then re-scans to sync signal state.
4. On "Cancel" (or Escape), edits are discarded.
5. Tab switches and page unload are guarded: if dirty edits exist, the user is
   prompted to confirm.

## What hivetool shows

### Tasks tab

Lists all tasks from `tickets/`, sorted by creation date. The detail view shows
objective, metadata, status, relationships (parent, creator), and file manifest.
Supports flat list and hierarchical tree views (toggled by the user, persisted
in `localStorage`). Tickets with cross-references (template, skill, parent) have
clickable links that navigate to the related tab.

### Events tab

Filters and displays coordination tickets (`kind == "coordination"`) — the event
system's on-disk records. Shows signal type, payload, delivery status, and
subscriber list.

### Sessions tab

Reads structured log files from `logs/`. The detail view is a rich session
inspector that renders:

- Turn-by-turn context with collapsible sections.
- Token usage per turn (prompt, candidates, cached, thoughts).
- Function calls with argument previews.
- System instruction and configuration.
- Outcome summary.

Cross-references link session IDs to their source tickets.

### Templates tab

Reads and edits `config/TEMPLATES.yaml`. Each template shows all fields
(objective, functions, skills, tasks, autostart, watch_events, model, tags) with
inline editing. New templates can be created; existing ones can be deleted.

Templates show bidirectional links: which skills they use, which tickets were
created from them.

### Skills tab

Reads and edits skill directories under `skills/`. Parses SKILL.md frontmatter
for metadata (`name`, `title`, `description`, `allowed-tools`). The detail view
renders the full instruction body via markdown. New skills can be created;
existing ones can be renamed or deleted.

Skills show bidirectional links to templates that reference them and tickets
that use them.

### System tab

Reads and edits `config/SYSTEM.yaml`. Shows the hive title, description, and
root template with a link to the template tab.

## How to extend hivetool

### Adding a new tab

1. Create a store in `src/data/` following the existing pattern (constructor +
   `activate()` + signals).
2. Create list and detail components in `src/ui/`.
3. Add the tab ID to the `TabId` type and `VALID_TABS` set in the router.
4. Wire the store and components into `BeesApp`.

### Adding a new data view

To show new information in an existing tab:

1. Add the parsed data to the relevant store as a new signal.
2. Add rendering logic to the corresponding detail component.

### Key source files

| File                         | Responsibility                                  |
| ---------------------------- | ----------------------------------------------- |
| `src/data/state-access.ts`   | File System Access API handle management        |
| `src/data/template-store.ts` | Template CRUD + reactive signal                 |
| `src/data/skill-store.ts`    | Skill scanning, parsing, CRUD                   |
| `src/data/system-store.ts`   | System config load/save                         |
| `src/data/ticket-store.ts`   | Ticket listing with observer-based updates      |
| `src/data/log-store.ts`      | Session log parsing and selection               |
| `src/data/router.ts`         | Hash-based URL router                           |
| `src/ui/app.ts`              | Root orchestrator, tab navigation, store wiring |
| `src/ui/primitives/`         | Reusable editing components                     |

---

## Gaps

Code changes needed to reconcile hivetool with the aspirational architecture in
`docs/architecture/index.md`.

### Ticket vs. task terminology

Hivetool still uses "tickets" in code — component names, store names. The
aspirational terminology is "Tasks".

**Gap**: This is a straightforward find-and-replace in the hivetool codebase.
