# Project Swarm — Agents and Tasks

Bees currently fuses three concepts into one identity — the **Ticket**: what
to do (task), who does it (agent), and how it runs (session). Creating a task
creates an agent. An agent works on exactly one task. When the task completes,
the agent dies.

This model breaks down when agents need to work on multiple tasks sequentially.
A parent agent that needs ten images generated must spawn ten sub-agents, each
with its own session, its own context window warm-up, and its own model
initialization. There is no way to say "here's a researcher — give it work as
it comes in."

**Project Swarm decouples agents from tasks.** An agent is a persistent identity
with a session, a workspace, and a set of tools. Tasks are lightweight work
items — like issues in a bug tracker — assigned to agents. An agent can receive
multiple tasks and work through them within a single session.

---

## The Two Agent Modes

### The Parent's View

From the parent's perspective, all agents look the same. The parent assigns
tasks by name and results come back. It never creates agents explicitly and
doesn't know whether a sub-agent is finite or infinite — that's an
implementation detail of the agent type (defined in TEMPLATES.yaml).

```
Parent Agent
  ├── agents_assign_task(type="researcher", slug="deep-dive",
  │     objective="Find pricing for X")
  │     └── Result comes back
  │
  ├── agents_assign_task(type="researcher", slug="deep-dive",
  │     objective="Compare X vs Y")
  │     └── Result comes back
  │
  └── agents_cancel(slug="deep-dive")
```

The parent doesn't care how `deep-dive` handled those tasks — whether it kept
context between them or started fresh each time.

### Finite Agents (Scheduler's View)

Has `system.*` functions (including `system_objective_fulfilled` and
`system_failed_to_fulfill_objective`). Calls one of these after each task,
terminating its session. If more tasks are queued, the scheduler creates a
**fresh instance** — new session, same slug, workspace persists. Serial
execution, clean context per task.

**Derivation rule:** An agent is finite if its template's `functions` list
includes `system.*`. The `function_filter` in `provisioner.py` controls which
function declarations are exposed to the LLM — templates without `system.*`
produce agents that cannot terminate themselves.

Finite agents are the backward-compatible path. Every existing agent type that
declares `system.*` functions continues to work as-is.

### Infinite Agents (Scheduler's View)

No `system.*` functions — the agent cannot declare itself done. Receives
tasks as context updates within a single long-running session. Tasks queue up
and are delivered sequentially. Context and workspace accumulate across tasks.

The infinite agent's value: **session continuity**. A researcher that found
pricing for product X retains that knowledge when asked to compare X vs Y.

---

## The Entity Model

Designed SQL-first to enable future migration from filesystem to database.

### Agents Table

```sql
CREATE TABLE agents (
  id              UUID PRIMARY KEY,
  type            TEXT NOT NULL,           -- agent type name ("researcher")
  parent_id       UUID REFERENCES agents(id),
  workspace_root_id UUID REFERENCES agents(id), -- workspace owner (root of share)
  slug            TEXT NOT NULL,           -- agent name ("deep-dive")
  status          TEXT NOT NULL,           -- available, running, suspended, ...
  active_session  UUID,
  finite          BOOLEAN NOT NULL,        -- true if template functions include system.*
  model           TEXT,
  runner          TEXT NOT NULL DEFAULT 'generate',
  voice           TEXT,
  functions       TEXT[],
  skills          TEXT[],
  options         JSONB,
  watch_events    JSONB,                   -- coordination subscriptions
  signal_type     TEXT,                    -- coordination signal type
  queued_updates  JSONB,                   -- buffered context updates (crash recovery)
  created_at      TIMESTAMP NOT NULL,
  completed_at    TIMESTAMP,
  UNIQUE(parent_id, slug)                  -- slug is unique per parent
);
```

An agent owns its session, workspace, tools, and model configuration. These
come from the agent type definition (TEMPLATES.yaml) and don't change between
tasks. **The agent owns its workspace** — `fs_dir` resolves through the agent's
session directory, not through tasks. `SubagentScope` derives workspace paths
from the agent hierarchy (parent slug path + child slug).

`workspace_root_id` replaces today's `owning_task_id` — it points to the root
agent whose workspace is shared. Set once at creation: inherited from the
parent's `workspace_root_id`, or self for root agents. This avoids O(depth)
tree walks on every `SubagentScope` construction.

**Invariant:** `agent.active_session` must always equal the `id` of the sole
session with `status = 'active'` for that agent.

**Terminal states:** `completed`, `failed`, `cancelled`. An agent in a terminal
state will not be scheduled. A finite agent in a terminal state is eligible for
fresh-instance reuse when new tasks arrive.

The **slug is the agent's name** — the only identifier the parent ever uses.
UUIDs are internal plumbing for session tracking and store lookups. The parent
addresses agents by slug: `"deep-dive"`, not `"8f3a-..."`. Agent creation is
implicit — the scheduler materializes agents on demand when tasks are assigned.

### Tasks Table

```sql
CREATE TABLE tasks (
  id              UUID PRIMARY KEY,
  objective       TEXT NOT NULL,
  title           TEXT,
  assignee        UUID REFERENCES agents(id),
  created_by      UUID REFERENCES agents(id),
  status          TEXT NOT NULL,            -- available, in_progress, completed, ...
  kind            TEXT NOT NULL DEFAULT 'work',  -- work, coordination
  outcome         TEXT,
  outcome_content JSONB,
  context         TEXT,                     -- supplementary context (work) or payload (coordination)
  tags            TEXT[],
  depends_on      UUID[],
  created_at      TIMESTAMP NOT NULL,
  completed_at    TIMESTAMP
);
```

Tasks are lightweight. No session, no workspace, no function groups. Just an
objective, a status, and an outcome. A row in a table. Coordination signals
are tasks with `kind = 'coordination'` — they carry a `signal_type` and
`context` payload but have no assignee or objective.

### Sessions Table

```sql
CREATE TABLE sessions (
  id              UUID PRIMARY KEY,
  agent_id        UUID NOT NULL REFERENCES agents(id),
  status          TEXT NOT NULL,            -- active, superseded
  forked_from     UUID REFERENCES sessions(id),
  forked_at_turn  INT,
  created_at      TIMESTAMP NOT NULL
);
```

Sessions belong to agents, not tasks. An agent's session spans across all its
tasks. Rollback forks the agent's session, not a task's session.

### On-Disk Layout

Each SQL table maps to a directory. Each row maps to a subdirectory or file.
Agent directories use UUIDs as names (same as today's tickets), with the
human-readable slug stored inside `metadata.json`. This avoids slug collision
when two parents each spawn a child with the same slug name.

```
hive/
  agents/
    {uuid}/
      metadata.json              ← agent row (contains slug, type, status)
      sessions/
        {session_id}/
          status
          events.jsonl
          interaction.json
          turns.json
          lineage.json
          workspace/             ← agent's filesystem
            {child-slug}/        ← child agent workspaces (by slug)

  tasks/
    {task_id}.json               ← task row
```

Tasks are flat JSON files — they're rows in a table. The objective is a text
field in the JSON. Agents are directories because they own sessions and
workspaces. The slug lives inside `metadata.json`, enabling human-readable
addressing without filesystem collision.

---

## The LLM-Facing API

| Function | Description |
|----------|-------------|
| `agents_list_types()` | Available agent types (same filtering as `tasks_list_types`: local templates + parent's `tasks` allowlist) |
| `agents_assign_task(type, slug, objective, opts?)` | Assign task, agent materialized on demand |
| `agents_check_status()` | Tree of agents (by slug) with task queues |
| `agents_send_event(slug, type, message)` | Context injection by agent name |
| `agents_cancel(slug)` | Cancel agent and pending tasks |
| `agents_await()` | Suspend until task result arrives |

The subagent uses `events.*` to communicate upward:

| Function | Description |
|----------|-------------|
| `events_send_to_parent(type, message)` | Send a typed event to the parent agent |
| `events_report_task_done(task_id, outcome)` | Mark assigned task as completed, deliver result to parent |
| `events_broadcast(type, message)` | Pub/sub broadcast to subscribers |

Agent creation is **implicit**. The parent never calls "create" — it assigns
tasks and the scheduler materializes agents on demand. The parent perceives
continuity: agents just exist, ready to receive work.

**How assignment works:**

1. Parent calls `agents_assign_task(type="researcher", slug="deep-dive", ...)`.
2. Handler resolves slug under this parent (serialized via a per-`(parent_id,
   slug)` asyncio lock to prevent races when two tasks target the same
   terminal-state slug simultaneously):
   - **No agent with this slug** → create from agent type definition, assign task.
   - **Existing agent, terminal** → fresh instance: reuse the same Agent row
     (reset status to `available`, create a new session, keep the same UUID;
     workspace persists). Assign task.
   - **Existing agent, non-terminal** → queue task for delivery.
3. Scheduler picks up the agent, runs it.

The resolution is uniform — the parent always gets the same behavior regardless
of whether the agent is finite or infinite. The difference is only in what the
scheduler does when a task completes:

- **Finite**: agent calls `system_objective_fulfilled` → terminate → if queued
  tasks remain, scheduler creates a fresh instance (same slug, workspace
  persists) and assigns the next task. Serial execution, clean context per task.
- **Infinite**: agent calls `events_report_task_done(task_id, outcome)` to
  report task completion → stays alive → scheduler delivers the next queued
  task as a context update. Same session, cumulative context.

### What the infinite agent sees

The infinite agent's type definition defines its role, not a specific task. Its
objective is a role description, stamped with sandbox instructions at agent
creation time (same mechanism as finite agents — `stamp_child_task` in
`playbook.py`). Sandbox instructions are agent-scoped (derived from the agent's
slug path, which is fixed at creation) and don't repeat in per-task context
updates:

> You are a research analyst. You will receive research tasks as context
> updates. For each task, investigate the topic, write your findings to a
> markdown file in your workspace, and report the task as done.
>
> \<sandbox_environment\>
> Your current working directory is the root of the workspace.
> You are assigned to work in the subdirectory: ./deep-dive
> ...\</sandbox_environment\>

When a task is assigned, the agent receives a context update:

```json
{
  "type": "task_assigned",
  "task_id": "abc-123",
  "objective": "Find pricing for product X"
}
```

When the agent finishes, it calls `events_report_task_done(task_id="abc-123",
outcome="Found pricing: $99/month for basic, $299/month for enterprise.
Details in report.md")`. The scheduler marks the task as `completed`, delivers
the completion update to the parent (same mechanism as finite agents —
`scheduler.py`'s `_wrap_execution` and post-cycle hooks), and the agent calls
`agents_await` to suspend until the next task arrives.

---

## Context Delivery

### Task completion → parent notification

When a task completes (outcome reported by the assignee agent), the scheduler
delivers a context update to the **parent agent** (the agent that created the
task). The routing path:

```
task.assignee (agent) reports done
  → task.created_by (agent) receives context update
```

This is one join deeper than today (`task → assignee → parent_agent`), but
conceptually cleaner: the task knows who created it, and the creator gets
notified.

### Infinite agent task delivery

When a parent assigns a task to an infinite agent, delivery follows the existing
three-path model (all paths work for both `generate` and `live` agents unless
noted):

1. **Mid-stream injection** (`live` sessions only) — push context parts into
   the WebSocket stream for immediate real-time delivery.
2. **Immediate resume** — agent is suspended (e.g., called `agents_await`),
   write `response.json` and flip assignee to trigger resumption.
3. **Buffer + auto-drain** — agent is busy, append to
   `pending_context_updates`. Drained automatically when the agent next
   suspends or resumes.

No new delivery machinery needed. Task assignment is just a context update with
`type: "task_assigned"`.

---

## Rollback

Rollback is a **system-level** operation. The agent being rolled back is
unaware — its session simply forks at the specified turn.

When an agent is rolled back to turn N:

1. **Session fork** — same mechanism as Project Rewind. Context truncated,
   filesystem restored from snapshot.
2. **Task re-queuing** — tasks completed after turn N revert to `available`,
   outcome cleared. They go back into the agent's queue and will be delivered
   as new context updates when the agent resumes.
3. **No parent notification** — the parent's context may reference stale task
   outcomes, but this is no different from any other stale data. The parent
   discovers the changed state on its next `agents_check_status` call.

The key insight: **rollback is localized to one agent's session. The rest of
the system discovers the consequences organically.**

Edge case: if the parent already completed based on the rolled-back agent's
outcomes, nobody will re-check. Hivetool could warn about this before allowing
rollback.

---

## Hivetool — the Verification Instrument

Hivetool is the primary mechanism for observing the hive. Every phase's
"observable proof" requires hivetool to display the new state. If hivetool
breaks during the migration, no phase can be verified.

**Hard constraint:** Hivetool must remain functional at every phase boundary.
Each phase includes paired Python and TypeScript deliverables — lockstep, not
sequential.

The enabling insight: **today's `tickets/{id}/` directory IS the agent.** The
metadata, sessions, workspace — that's all agent state. The only "task" content
in a ticket is its `objective.md`. The migration doesn't move data to a foreign
structure — it renames what's already there and extracts the lightweight task
concept into a new flat directory.

---

## The Mutation Protocol

Hivetool and the box communicate through a filesystem-based mutation protocol.
No HTTP, no WebSocket — three channels:

1. **Mutations** (hivetool → box): JSON files in `mutations/`. Fire-and-forget.
   Hivetool writes `{uuid}.json`; the box processes it and writes
   `{uuid}.result.json`.

2. **Directory observation** (box → hivetool): `TicketStore` watches `tickets/`
   via `FileSystemObserver`. Any metadata change triggers a rescan.

3. **Box sentinel** (`mutations/.box-active`): Presence signal. Mutation-powered
   UI (pause/resume/reset) only appears when this file exists.

### Hot vs. Cold

The box classifies every filesystem change via `classify_change()` in `box.py`:

| ChangeKind | Trigger paths | Behavior |
|------------|--------------|----------|
| `config` | `config/`, `skills/` | Cold restart (shutdown → restart) |
| `task` | `tickets/` | Hot trigger (`bees.trigger()`) |
| `mutation` | `mutations/` (not result files) | Process inline or flag cold |
| `ignore` | everything else | Skip |

Hot mutations run inline while the scheduler is active: `respond-to-task`,
`create-task-group`, `pause-all`, `resume-paused`, `delete-task`,
`rollback-to-turn`. Cold mutations (`reset`) require quiescence.

**Post-pivot, `TicketStore`'s `FileSystemObserver` watches the hive root** (not
`tickets/`). The path classifier recognizes `agents/`, `tasks/`, and
`tickets/` prefixes, routing each to the appropriate scan or trigger. A single
observer avoids the complexity of multiple watchers during dual-directory mode.

### Post-Pivot Evolution

The mutation vocabulary and `classify_change()` paths evolve with each phase.
Some mutations become agent-scoped (rollback, pause), some stay task-scoped
(assign), and new ones appear (cancel-agent). The `MutationClient` (TypeScript)
and `MutationManager` (Python) must move in lockstep.

---

## Migration Path

Today's `tickets/{id}/` directory is already the agent — it owns metadata,
sessions, workspace, and configuration. The only task-specific content is
`objective.md`. The migration exploits this:

| Today (Ticket = Agent + Task) | Tomorrow (Separated) |
|-------------------------------|---------------------|
| `tickets/{id}/` | `agents/{uuid}/` (same internal structure) |
| `tickets/{id}/objective.md` | Removed (objective moves to task JSON) |
| `tickets/{id}/metadata.json` | `agents/{uuid}/metadata.json` (agent config + status + slug) |
| `tickets/{id}/sessions/` | `agents/{id}/sessions/` (unchanged) |
| (objective embedded in dir) | `tasks/{uuid}.json` (new: lightweight work items) |

The finite agent path preserves backward compatibility: a finite agent with one
task looks identical to today's ticket from the scheduler's perspective.

Hivetool's `TicketStore` accepts both `agents/` and `tickets/` as the root
directory throughout the transition, enabling incremental migration without
losing observability.

---

## Phase 1 — Entity Split + Hivetool Foundation

### 🎯 Objective

Introduce the `Agent` and `Task` as first-class data models, separate from the
existing `Ticket`. The `AgentStore` manages agent directories under `agents/`.
The `TaskStore` manages lightweight task files under `tasks/`. Hivetool can
read from both `agents/` and `tickets/` directory layouts.

**Observable proof:**

1. Manually create `agents/{uuid}/metadata.json` with type, slug="my-researcher",
   status, and config fields. Create `tasks/{task-uuid}.json` with an objective
   and assignee pointing to the agent UUID.
2. Open hivetool — the agent `my-researcher` appears in the sidebar with its
   assigned task.
3. Inspect the filesystem — `agents/{uuid}/` contains `metadata.json`
   with agent config and slug, `tasks/` contains the task JSON with objective
   and status.

### Python Changes

- [x] **[NEW] `agent.py`** — `Agent` dataclass and `AgentMetadata` dataclass.
      Fields: id, type, parent_id, workspace_root_id, slug, status,
      active_session, finite, model, runner, voice, functions, skills, options,
      watch_events, signal_type, queued_updates, created_at, completed_at.
- [x] **[NEW] `agent_store.py`** — `AgentStore` class with CRUD for
      `agents/{id}/` directories. Methods: `create()`, `get()`, `query_all()`,
      `save_metadata()`, `get_children()`.
- [x] **[NEW] `agent_adapter.py`** — `TicketToAgentAdapter` bridges reads from
      existing `tickets/` directory layout to `Agent` objects. Derives `finite`
      from `system.*` presence in functions list.
- [ ] ~~**[MODIFY] `ticket.py`**~~ — Deferred to Phase 2a. `TicketMetadata`
      left untouched; `AgentMetadata` is a standalone dataclass. The adapter
      bridges the gap without touching existing code.
- [ ] ~~**[RENAME] `task_store.py` → `ticket_store.py`**~~ — Deferred. The
      new lightweight task store lives in `task_file_store.py` instead,
      avoiding a 15-file import rename. `TaskRecord` + `TaskFileStore` manage
      flat `tasks/{uuid}.json` files with `assignee` and `kind` fields.

### Hivetool Changes

- [x] **[MODIFY] `common/types.ts`** — Added `AgentData` and `TaskItemData`
      interfaces alongside existing `TaskData`.
- [x] **[MODIFY] `ticket-store.ts`** — Dual-directory scanning: tries
      `agents/` first, falls back to `tickets/`. Reads `tasks/` for task data
      alongside agent metadata. Shims agent+task into `TicketData` shape.
      `#getEntityDirHandle()` resolves entity dirs across both layouts.
- [x] **[MODIFY] `data/types.ts`** — Re-exports `AgentData` and `TaskItemData`.

### Verification

- [x] Unit tests for `AgentStore` CRUD operations (16 tests).
- [x] Unit tests for `TaskFileStore` with assignee and kind fields (14 tests).
- [x] Round-trip: create agent → create task → assign → query tasks for
      agent → see in hivetool. Verified with seed script + manual hivetool check.
- [x] Adapter: verify `TicketToAgentAdapter` reads from `tickets/` (15 tests).

---

## Phase 2 — Scheduler + Box Rewiring

This phase is split into three independently-verifiable sub-phases. Each
sub-phase delivers working, hivetool-observable state.

### Phase 2a — Scheduler Accepts Agent Objects ✅

Internal refactor: the scheduler, task runner, and provisioner accept `Agent`
objects instead of `Ticket` objects. The on-disk layout is still `tickets/` —
an adapter layer bridges the new internal API to the old filesystem.

**Observable proof:** Start an existing hive. The scheduler uses `Agent`
objects internally, but hivetool still reads from `tickets/` and shows
everything working as before. Existing batch-mode tests pass.

#### Python Changes

- [x] **[MODIFY] `scheduler.py`** — Replace ticket-driven cycle loop with
      agent-driven loop. Query `UnifiedAgentStore` for available/suspended
      agents. Fire `TaskRunner` per agent, not per ticket.
- [x] **[MODIFY] `task_runner.py`** — Accept an `Agent` instead of a `Ticket`.
      Wire session using agent's config (model, tools, session, workspace).
- [x] **[MODIFY] `coordination.py`** — Accept `Agent` and `UnifiedAgentStore`.
      Playbook hooks still receive `Ticket` via `agent_to_ticket()`.
- [x] **[MODIFY] `segments.py`** — Accept `Agent` and `UnifiedAgentStore`.
- [x] **[MODIFY] `bees.py`** — `Bees.__init__` creates `UnifiedAgentStore`.
      Public methods reconstruct `Ticket` via `agent_to_ticket()` at boundary.
- [x] **[MODIFY] `task_node.py`** — Uses inner `_ticket_store` for
      `Ticket`-typed queries. Public API unchanged.
- [x] **[NEW] `unified_agent_store.py`** — Bidirectional adapter wrapping
      `TaskStore`, exposing `Agent`-typed CRUD.
- [x] **[MODIFY] `agent_adapter.py`** — Added `agent_to_ticket()` reverse
      mapping and execution-state bridge fields.
- [x] **[MODIFY] `agent.py`** — Added execution-state bridge fields to
      `AgentMetadata`, `playbook_run_id`, and transient `objective` on `Agent`.
- [x] **[MODIFY] `subagent_scope.py`** — Added `for_agent()` factory method.

##### Deferred

- `provisioner.py` — Not modified. It accepts unpacked parameters, not a
  typed entity, so the refactor is a no-op. Revisit in Phase 2b.
- `task_node.py` → `agent_node.py` rename — Deferred. The public API still
  returns `Ticket` objects; renaming before the full entity migration would
  create a misleading name.
- `protocols/events.py` — Event types still carry `Ticket`. Changing them
  would cascade into the SSE/Hivetool stack. Deferred to Phase 4.

#### Adjustments Made

1. **Execution-state bridge fields on `AgentMetadata`** — The original
   blueprint assumed the scheduler would only read identity/config fields
   from `AgentMetadata`. In practice, the scheduler and task runner write
   execution state (`error`, `outcome`, `turns`, `assignee`, `suspend_event`,
   etc.) during every session. These fields must live on `AgentMetadata`
   during the adapter era to survive the `Agent` → `Ticket` → disk →
   `Ticket` → `Agent` round-trip. In Phase 3+, some move to `TaskRecord`,
   others stay.

2. **`TaskNode` uses inner `_ticket_store` directly** — Rather than
   converting between `Agent` and `Ticket` in the tree API, `TaskNode`
   accesses the inner `TaskStore` for all read operations. This keeps the
   public API stable and avoids a double-conversion penalty.

3. **`UnifiedAgentStore` instead of separate `AgentStore` + `TaskStore`** —
   The blueprint proposed the scheduler use `AgentStore` with `TaskStore`
   alongside. Since the on-disk layout is still `tickets/` (fused), a
   single bidirectional adapter (`UnifiedAgentStore`) is cleaner than
   two stores pointing at the same directory. The split into separate stores
   happens in Phase 2b when the layout actually diverges.

#### Verification

- [x] All existing batch-mode tests pass (339 passed, adapter transparent).
- [x] Hivetool unchanged — still reads from `tickets/`.
- [x] Coordination smoke test: two agents with `watch_events`, broadcast a
      signal, verify delivery via `route_coordination_task` using Agent objects.

### Phase 2b — Box and Mutations Route Through New Stores

The box's `classify_change()` recognizes `agents/` and `tasks/` directories.
Mutation handlers use `AgentStore` and `TaskStore`. On disk, the system now
writes to `agents/` + `tasks/` (with `tickets/` fallback for existing hives).

**Observable proof:** Start a hive. Verify `agents/` directory created on
disk with expected structure. Verify task file in `tasks/` shows `completed`
status. Hivetool still works (still reading from `tickets/` via adapter).

**Layout detection:** A hive's layout is detected by checking whether `agents/`
exists at startup. New hives created after this phase write to `agents/` +
`tasks/`. Existing hives continue using `tickets/` until explicitly migrated
(Phase 6).

#### Python Changes

- [ ] **[MODIFY] `box.py`** — Update `classify_change()`:
      - `agents/` → hot trigger (same role as `tickets/` today).
      - `tasks/` → hot trigger.
      - `tickets/` → hot trigger (backward compat, removed in Phase 6).
- [ ] **[MODIFY] `mutations.py`** — Update handlers to use `AgentStore`
      alongside `TaskStore`. `_handle_reset` clears `agents/`, `tasks/`,
      `logs/`, `mutations/`. Rollback routes through agent session.

#### Verification

- [ ] Agents written to `agents/` on disk.
- [ ] Tasks written to `tasks/` on disk.
- [ ] Existing hives with `tickets/` still load and run.

### Phase 2c — Hivetool Reads From New Layout

Hivetool's `TicketStore` reads from both `agents/` + `tasks/` and `tickets/`
directories. This is the dual-directory scanning mode that enables the
lockstep transition.

**Observable proof:** Start a hive using the new layout. Open hivetool — the
agent appears, transitions to `running`, and completes. Verify hivetool shows
agent lifecycle, workspace, and surface correctly from `agents/` paths.

#### Hivetool Changes

- [ ] **[MODIFY] `ticket-store.ts`** — Accept both `agents/` and `tickets/`
      as root. Scan `tasks/` for task data alongside agent metadata. Update
      `readTree()`, `readSurface()`, `readFileContent()` for agent paths
      (`agents/{uuid}/sessions/{sid}/workspace`). Update `createTask()` to
      create agents + tasks in new layout when operating against new hives.
- [ ] **[MODIFY] `mutation-client.ts`** — Update internal mutation vocabulary.
      Rollback targets agent, not task.
- [ ] **[MODIFY] `ticket-pane.ts`** — Wire agent-based workspace paths.

#### Verification

- [ ] Hivetool shows agents from `agents/` layout in real time.
- [ ] Hivetool shows agents from legacy `tickets/` layout (backward compat).
- [ ] File tree, surface, and session lineage work with agent paths.

---

## Phase 3 — The `agents_*` Function Group

### 🎯 Objective

Replace the `tasks_*` LLM-facing API with `agents_*`. Agent creation is
implicit — the parent assigns tasks by `(type, slug)` and the handler
materializes agents on demand. Hivetool displays the agent→task hierarchy.

**Observable proof:**

1. Write a TEMPLATES.yaml entry that uses `agents_*` functions. The root
   agent's objective instructs it to assign a task to a `"researcher"` agent.
2. Start the hive. Watch hivetool — the root agent runs, a `researcher`
   agent named by its slug appears in the sidebar with a task.
3. The researcher agent completes (finite — calls
   `system_objective_fulfilled`). The root agent receives the result and
   calls `agents_check_status()` — it sees the slug with `completed` status.
4. Assign a second task to the same slug. The scheduler creates a **fresh
   instance** (same slug, new session). This verifies the finite agent path
   only — infinite agent behavior is Phase 4.

### Python Changes

- [ ] **[NEW] `functions/agents.py`** — New function group implementing:
      `agents_list_types`, `agents_assign_task` (with implicit creation),
      `agents_check_status`, `agents_send_event`, `agents_cancel`,
      `agents_await`.
- [ ] **[NEW] `declarations/agents.functions.json`** — Function declarations.
      `agents_assign_task` takes `type`, `slug`, `objective`, and optional
      `options`. Slug is required.
- [ ] **[NEW] `declarations/agents.instruction.md`** — LLM instructions
      explaining the implicit creation model: "assign tasks, agents appear."
- [ ] **[MODIFY] `provisioner.py`** — Wire `agents_*` function group.
- [ ] **[DEPRECATE] `functions/tasks.py`** — Keep for backward compat but
      route through agents internally.

**Function group coexistence rule:** The template's `functions` list in
TEMPLATES.yaml controls which function set is active for each agent type.
Templates using `tasks.*` continue to work unchanged. New templates use
`agents.*`. Both groups are never registered in the same session — the
`function_filter` ensures mutual exclusivity. `events.*` and `system.*` remain
independent groups — they are registered for all agents regardless of whether
the agent uses `tasks.*` or `agents.*`.

### Hivetool Changes

- [ ] **[MODIFY] `ticket-list.ts`** — Show agents by slug in sidebar.
      Agents as primary items, tasks nested or shown as status indicators.
- [ ] **[MODIFY] `ticket-detail.ts`** — Agent detail view: show the agent's
      task queue alongside session, workspace, and surface.

### Verification

- [ ] Unit tests for each `agents_*` handler, including implicit creation
      (new slug), reuse (existing slug, non-terminal), and fresh instance
      (existing slug, terminal).
- [ ] Integration test: parent assigns task → agent appears → check status.
- [ ] Integration test: parent assigns two tasks to same slug → both complete.
- [ ] Hivetool: agent visible by slug with task in sidebar.

---

## Phase 4 — Infinite Agent Lifecycle

### 🎯 Objective

Infinite agents (no `system.*` functions) receive tasks as context updates and
work through them sequentially within a single session. Task assignment
suspends/resumes the agent via the existing context delivery paths. Hivetool
shows the task queue draining in real time.

**Observable proof:**

1. Define an infinite agent type in TEMPLATES.yaml (no `system.*` functions).
   Write a root agent objective that assigns task A, waits, then assigns task B
   to the same slug.
2. Start the hive. Watch hivetool — the infinite agent appears, receives
   task A, completes it.
3. Task B is assigned to the same slug. In hivetool, the agent's session view
   shows continuous context — task A's context is still present when task B
   arrives.
4. Both tasks show `completed` in hivetool. The agent remains `suspended`
   (not terminated), waiting for more work.

### Python Changes

- [ ] **[MODIFY] `scheduler.py`** — When an infinite agent calls
      `events_report_task_done`, the scheduler updates the task status to
      `completed` and auto-delivers the completion update to the parent.
      The infinite agent then calls `agents_await` to suspend and wait for
      more work. The scheduler delivers new task assignments as context
      updates when the agent resumes.
- [ ] **[MODIFY] `functions/events.py`** — Add `events_report_task_done`
      handler. Validates `task_id` against the agent's assigned tasks.
      Sets `task.status = completed`, `task.outcome = outcome`. Returns
      success confirmation to the agent.
- [ ] **[NEW] `declarations/events.functions.json` update** — Add
      `events_report_task_done` declaration with required `task_id` (string)
      and `outcome` (string) parameters.
- [ ] **[MODIFY] `task_runner.py`** — For infinite agents, don't call
      `system_objective_fulfilled` / `system_failed_to_fulfill_objective`
      handling. The agent stays alive across tasks.
- [ ] **[MODIFY] `declarations/`** — Instructions for infinite agents about
      using `events_report_task_done` to report task completion and
      `agents_await` to wait for more work.

### Hivetool Changes

- [ ] **[MODIFY] `ticket-detail.ts`** — Task queue within agent detail:
      show completed tasks, current task, and pending tasks.
- [ ] **[MODIFY] `ticket-list.ts`** — Distinguish infinite agents (persistent
      status badge) from finite agents (appear and disappear).

### Verification

- [ ] End-to-end test: infinite agent receives two tasks sequentially in one
      session, completes both, session context carries over.
- [ ] Verify that finite agent behavior is unchanged.
- [ ] Hivetool: task queue visibly drains as agent works.

---

## Phase 5 — Rollback for Multi-Task Agents

### 🎯 Objective

Rollback on an agent with multiple completed tasks correctly re-queues tasks
that were completed after the fork point. Hivetool shows the re-queuing in the
rollback confirmation dialog.

**Observable proof:**

1. Run an infinite agent through tasks A, B, and C (all complete).
2. In hivetool's session view, click rollback to the turn where task A was
   just completed.
3. The rollback dialog shows: "Tasks B and C will be re-queued."
4. Confirm. Observe in hivetool: tasks B and C revert to `available` status.
5. The agent resumes from the fork point. Task B is delivered as a new context
   update. The agent works on it again.

### Python Changes

- [ ] **[MODIFY] `session.py`** — Add `task_completions` field to turn
      checkpoints in `turns.json`. Each checkpoint records which task IDs
      were completed at that turn boundary, enabling rollback to correlate
      turns with task completion events.
- [ ] **[MODIFY] `mutations.py`** — Update `rollback-to-turn` handler. After
      forking the session, use the turn checkpoint's `task_completions` field
      to identify tasks completed after the fork point. Clear their outcome,
      revert status to `available`.

### Hivetool Changes

- [ ] **[MODIFY] `log-detail.ts`** — Rollback confirmation dialog shows
      which tasks will be re-queued: "Tasks B and C will be re-queued."
- [ ] **[MODIFY] `mutation-client.ts`** — Rollback mutation targets agent ID
      (not task ID). The handler navigates from agent → session.

### Verification

- [ ] Unit test: rollback on agent with 3 completed tasks at mid-point.
- [ ] Unit test: rollback on a finite agent with one completed task.
- [ ] Verify re-queued tasks are delivered to the agent on resume.
- [ ] Hivetool: rollback dialog shows correct task list, post-rollback
      task queue reflects re-queued items.

---

## Phase 6 — Migration and Cleanup

### 🎯 Objective

Migrate existing hives from the `tickets/` layout to `agents/` + `tasks/`.
Remove backward-compat shims. Deprecate `tasks_*` function group.

### Python Changes

- [ ] **[NEW] Migration script** — Reads `tickets/`, creates `agents/`
      directories with same internal structure, extracts task data into
      `tasks/` JSON files. Preserves session data. **Pre-flight guard:**
      aborts if any agent is `running` or `suspended` — migration requires
      quiescence.
- [ ] **[DELETE] Backward compat paths** — Remove `tickets/` fallback from
      stores, `classify_change()`, and hivetool.
- [ ] **[DELETE] `functions/tasks.py`** — Remove deprecated function group.

### Hivetool Changes

- [ ] **[MODIFY] `ticket-store.ts`** — Remove `tickets/` fallback. Read
      exclusively from `agents/` + `tasks/`.
- [ ] **[RENAME]** UI components: `ticket-*` → `agent-*` where appropriate.
      Tab label: "Tasks" → "Agents".

---

## Non-Goals

- **Task reassignment between agents**: A task's assignee is set at creation
  and doesn't change. Reassignment adds complexity with minimal initial value.
- **Task priorities / ordering**: Tasks are delivered in creation order.
  Priority-based scheduling is a future optimization.
- **Context summarization**: Session-layer context management (summarization,
  pruning) is a separate concern from the agent/task split. It benefits all
  sessions regardless of this project.
- **Agent-to-agent communication**: Agents communicate through their parent
  (via context updates). Direct agent-to-agent messaging is out of scope.
- **Dynamic agent type creation**: Agents creating new agent type configurations
  at runtime. The infrastructure supports it (workspace `templates/` directory),
  but the explicit API is deferred.
- **Coordination system redesign**: The current coordination mechanism
  (`kind="coordination"`, `signal_type`, `watch_events`, `delivered_to`,
  `events_broadcast`) predates the agent-tree model. These fields remain on
  the ticket/agent metadata during the migration but are candidates for
  deprecation once agent-tree-scoped routing replaces broadcast-based
  coordination. Redesigning coordination is out of scope.
- **`playbook_run_id` removal**: Currently used in `coordination.py` to scope
  broadcast signals to a single playbook run. In the agent-tree model, this
  scoping is replaced by root-ancestor matching: a coordination signal is only
  delivered to agents that share the same root agent. This is a one-line change
  in `route_coordination_task` — compare the root ancestor instead of
  `playbook_run_id`. The field is not included in the new `Agent` schema and
  will be dropped during Phase 6 cleanup.

---

## Coupling Map

Files that need changes, ordered by coupling density:

### Python (box + backend)

| File | Current Coupling | Required Change |
|------|-----------------|-----------------|
| `bees.py` | Public API returns `TaskNode`/`Ticket` | Returns `AgentNode`/`Agent` |
| `task_node.py` | Wraps `Ticket`, tree via `parent_task_id` | → `agent_node.py`, wraps `Agent` |
| `protocols/events.py` | Events carry `Ticket` payloads | Events carry `Agent` payloads |
| `scheduler.py` | Scheduling unit = ticket | Schedule agents, not tickets |
| `task_runner.py` | Session wiring = per-ticket | Wire sessions for agents |
| `ticket.py` | Identity = task + agent + session | Split into agent + task |
| `task_store.py` | CRUD = tickets only | Manage tasks (lightweight) |
| `playbook.py` | Template = task + agent type config | Template = agent type config |
| `functions/tasks.py` | Create task = create agent | Deprecate → agents_* |
| `functions/events.py` | `events_broadcast` uses ticket ID | Use agent ID |
| `functions/chat.py` | Chat logging uses `workspace_root_id` | Derive from agent |
| `functions/files.py` | File ops scoped to ticket workspace | Scope to agent workspace |
| `functions/sandbox.py` | Sandbox scoped to ticket work dir | Scope to agent work dir |
| `subagent_scope.py` | Scope = ticket-derived | Scope = agent-derived |
| `mutations.py` | Rollback = ticket-scoped | Rollback = agent-scoped |
| `session.py` | Drain + observe = per-ticket, log prefix | Per-agent, add task_completions |
| `provisioner.py` | Provision = ticket params | Provision = agent params |
| `coordination.py` | Event routing = ticket-to-ticket | Agent-to-agent, root-ancestor scoping |
| `box.py` | Watches `tickets/` | Watch `agents/` + `tasks/` |
| `disk_file_system.py` | Workspace path resolves via ticket | Resolve via agent |
| `context_updates.py` | Converts updates to context parts | May need agent awareness |
| `skill_filter.py` | Merges function filters from ticket | Source from agent config |
| `segments.py` | `resolve_segments(task: Ticket, ...)` | Accept `Agent` |
| `config.py` | `HIVE_DIR` constant | No change (layout depth same) |

### Hivetool (TypeScript)

| File | Current Coupling | Required Change |
|------|-----------------|-----------------|
| `ticket-store.ts` | Reads `tickets/` directory | Read `agents/` + `tasks/` |
| `ticket-store.ts` (`createTask`) | Creates tasks in `tickets/` | Create agents + tasks in new layout |
| `mutation-client.ts` | All mutations target `task_id` | Some become agent-scoped |
| `common/types.ts` | `TaskData` = agent + task fused | Split `AgentData` + `TaskData` |
| `ticket-list.ts` | Flat ticket list | Agent→task hierarchy |
| `ticket-detail.ts` | Ticket = everything | Agent detail + task queue |
| `ticket-pane.ts` | Tabbed container per ticket | Per agent |
| `session-lineage.ts` | Session tree via ticket dirs | Via agent dirs |
| `log-store.ts` | Log files named with ticket ID | Use agent ID |
| `session-store-reader.ts` | Reads sessions from ticket subdirs | From agent subdirs |
| `log-detail.ts` | Rollback targets task | Rollback targets agent |
| `app.ts` | "Tasks" tab, `TicketStore` | "Agents" tab, `AgentStore` |
| `opal_backend/sessions/file_store.py` | Session paths from ticket dir | Paths from agent dir |

---

## Context for New Sessions

### Core architecture (read first)

| File | What to learn |
|------|---------------|
| `packages/bees/bees/bees.py` | Public consumer API: Bees class, event dispatch |
| `packages/bees/bees/task_node.py` | DOM-like tree traversal wrapper over Ticket |
| `packages/bees/bees/protocols/events.py` | Typed scheduler events (TaskAdded, TaskDone, etc.) |
| `packages/bees/bees/ticket.py` | Current fused identity: Ticket = agent + task |
| `packages/bees/bees/scheduler.py` | Cycle orchestration, context delivery |
| `packages/bees/bees/task_runner.py` | Session wiring, run/resume paths |
| `packages/bees/bees/playbook.py` | Agent type loading, child task stamping |
| `packages/bees/bees/functions/tasks.py` | LLM-facing task API |
| `packages/bees/bees/subagent_scope.py` | Workspace scoping |

### Hivetool architecture (read for any hivetool phase)

| File | What to learn |
|------|---------------|
| `packages/bees/hivetool/src/ui/app.ts` | Root orchestrator, tab routing, store lifecycle |
| `packages/bees/hivetool/src/data/ticket-store.ts` | Ticket scanning, FileSystemObserver, workspace paths |
| `packages/bees/hivetool/src/data/mutation-client.ts` | Mutation protocol client, fire-and-forget writes |
| `packages/bees/hivetool/src/data/types.ts` | Data types, surface schema |
| `packages/bees/common/types.ts` | Shared backend API contract |
| `packages/bees/bees/box.py` | classify_change, hot/cold processing loop |
| `packages/bees/bees/mutations.py` | Mutation dispatch table, handler implementations |

### Related projects

| Project | Relevance |
|---------|-----------|
| `projects/rewind/PROJECT.md` | Session rollback — the fork mechanism this project extends |
| `projects/air/PROJECT.md` | Unified task model — finite agents (direct_model) |
