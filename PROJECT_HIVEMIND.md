# Project Hivemind — Agent Tree Navigation

Surface the agent hierarchy in the Bees shell so users can navigate
the tree of agents spawned during a session, seeing each agent's
subagent status, chat history, and UI bundle as composable
perspectives.

## Background

Bees agents create sub-tasks via `tasks_create_task`, which stamps
each child ticket with `creator_ticket_id` pointing to its parent.
This forms a tree:

```
user-request (root ticket)
├── research-agent
│   ├── web-search-agent
│   └── file-scan-agent
└── implementation-agent
    ├── code-writer-agent
    └── test-runner-agent
```

The backend already supports this tree — `tasks_check_status` in
`tasks.py` builds it recursively via the `creator_ticket_id` index.
But neither the server API nor the shell frontend exposes it.

Each agent/ticket can have up to three **perspectives**, detected by
presence:

1. **Subagents** — child tickets where `creator_ticket_id` points to
   this ticket. Shown as a status tree.
2. **Chat** — the `"chat"` tag on the ticket. Shown as a
   conversation thread.
3. **Bundle** — the `"bundle"` tag on the ticket. Shown as a
   rendered UI in an iframe.

All three can coexist on a single ticket. The shell needs to
composite them rather than choosing one.

### Design Decisions

- **Floating Chat**: Chat is a floating window that overlays the
  stage, always available for the selected agent. Minimizes to a
  floating dot that glows when there's unread activity. This
  decouples conversation from stage rendering.
- **Tabbed Stage**: The stage area uses tabs — "App" (bundle) and
  "Subagents" — shown only when the perspective exists. If only
  one perspective is present, no tabs. If neither, show a status
  summary.
- **Tree replaces Journeys**: The sidebar's flat "Journeys" list
  (grouped by `playbook_run_id`) is fully replaced by the
  `creator_ticket_id` tree. This aligns with the direction of
  removing `playbook_run_id` entirely.

### Current State

- `opal-timeline.ts` shows "worker tickets" filtered by
  `parent_ticket_id` (workspace sharing), **not** `creator_ticket_id`
  (agent parentage). These are different concepts.
- `TicketData` in `web/src/data/types.ts` doesn't declare
  `creator_ticket_id`, even though the server sends it.
- The sidebar shows flat "Journeys" grouped by `playbook_run_id`.
  No tree navigation.
- The stage picks one rendering mode (empty / digest / iframe /
  timeline) — it doesn't composite perspectives.
- Chat is currently tied to the prompt bar at the bottom of the
  shell and threaded by `playbook_run_id`.

## Phases

### Phase 1 — Data Pipe: `creator_ticket_id` in Frontend ✅

🎯 **Objective**: `creator_ticket_id` is declared in the frontend
`TicketData` type and confirmed present in SSE payloads. No new
server endpoints — the tree is derived client-side from the flat
ticket list.

- [x] Add `creator_ticket_id` to `TicketData` in `web/src/data/types.ts`
- [x] Verify `_ticket_to_dict` includes `creator_ticket_id`
      (confirmed: 7 of 22 tickets carry the field via REST)
- [x] Verify SSE `init` and `ticket_added` events carry the field
      (confirmed: SSE init payload includes `creator_ticket_id`)

---

### Phase 2 — Controller: Tree-Aware State ✅

🎯 **Objective**: `AgentTreeController` (new subcontroller) tracks
which tree node the user has selected. Tree derivation is a pure
utility (`deriveAgentTree`, `deriveChildAgents`,
`derivePerspectives`) tested with 15 unit tests.

- [x] Create `AgentTreeController` subcontroller with
      `selectedAgentId` field
- [x] Pure tree utilities in `sca/utils/agent-tree.ts`:
  - `deriveAgentTree` — builds forest from flat tickets via
    `creator_ticket_id`, excluding coordination/digest
  - `deriveChildAgents` — direct children of a given parent
  - `derivePerspectives` — detects subagents/chat/bundle presence
- [x] Wire into `AppController` interface, `BeesController`, and
      `sca.ts`
- [x] Action: `selectAgent` in `actions/tree/tree-actions.ts`
- [x] `makeTestController` helper updated
- [x] 15 unit tests passing — tree derivation, filtering, sorting,
      multi-level nesting, perspective detection

---

### Phase 3 — Sidebar: Tree Navigator ✅

🎯 **Objective**: The sidebar renders the agent tree as a
collapsible hierarchy, fully replacing the flat "Journeys" list.
Selecting a node updates `AgentTreeController.selectedAgentId`.
Visual indicators show each agent's status.

- [x] Remove `playbook_run_id`-based journey grouping from
      `opal-sidebar.ts` — fully replaced
- [x] Render recursive tree from `deriveAgentTree(global.tickets)`
- [x] Each node shows: title/name, status dot, perspective icons
      (💬 chat, 🖥 bundle, 👥 subagents)
- [x] Collapsible subtrees with expand/collapse toggle (▸/▾)
- [x] Root nodes are tickets with no `creator_ticket_id`
- [x] Selection state wired to `selectAgent` action
- [x] Pulse-aware: running agents detected via `pulseTasks`

**Follow-ups:**
- [x] Twisties — replaced ▸ text char with SVG chevron at 12px
- [x] Filter out "empty" agents — tickets with no chat, no
      subagents, and no bundle are hidden from the tree
- [x] Clicking a sidebar node now drives the stage via Phase 4

---

### Phase 4 — Stage: Tabbed Perspectives ✅

🎯 **Objective**: When an agent is selected, the stage shows its
perspectives as tabs. "App" tab for bundle, "Subagents" tab for
child agent status. Tabs appear only when the perspective exists.
If neither, show a status summary for the selected agent.

- [x] Refactor `opal-stage.ts` to read from `AgentTreeController`
      instead of `StageController.currentView`
- [x] Tab bar: "App" (when `bundle` tag present) and "Subagents"
      (when child agents exist). No tabs if only one perspective.
- [x] `opal-subagent-panel` — new component: child agent status
      cards with live status, clickable to navigate into subagent
- [x] Reuse existing iframe rendering for bundle/App tab
- [x] Fallback: agent summary when no perspectives apply
- [x] Legacy stage preserved when no agent is selected
- [x] `selectAgent` action syncs `stage.currentView` and loads
      bundle for bundle-tagged agents

---

### Phase 5 — Floating Chat

🎯 **Objective**: Chat is a floating window overlaying the stage,
always available for the selected agent. Minimizes to a floating
dot that glows on unread activity. Chat content follows the
selected agent in the tree.

- [ ] `opal-chat-float` component — floating, draggable/docked
      chat window with minimize/expand toggle
- [ ] Minimized state: glowing dot indicator for unread messages
- [ ] Chat content derived from selected agent's chat history
      (replaces prompt-bar threading by `playbook_run_id`)
- [ ] Input field for responding to suspended agents
- [ ] Remove `playbook_run_id` threading from `ChatController`
      and `deriveThreads` — thread identity now follows the
      agent tree selection

---

### Phase 6 — Integration: Reactive Tree Updates

🎯 **Objective**: When the server broadcasts `ticket_added` or
`ticket_update` for a ticket with `creator_ticket_id`, the tree
automatically updates — new children appear, status changes
reflect immediately. No polling required beyond existing SSE.

- [ ] Verify SSE `ticket_added` events include `creator_ticket_id`
      in the payload
- [ ] `AgentTreeController.agentTree` recomputes reactively when
      `global.tickets` changes (automatic via computed signal)
- [ ] Visual feedback: new child agents animate in, status changes
      pulse the tree node and the floating chat dot
- [ ] Handle deep trees: auto-expand path to newly active agent

---

### Phase 7 — Polish: Breadcrumb + Deep Linking

🎯 **Objective**: Selected agent state survives page reload via URL
hash. A breadcrumb trail shows the path from root to selected agent
for orientation in deep trees.

- [ ] Breadcrumb bar above the stage showing path to selected agent
- [ ] URL hash includes selected agent ID for deep linking
- [ ] Handle orphan selections (selected agent deleted or completed)
