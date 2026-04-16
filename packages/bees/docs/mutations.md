# Mutation Log — Atomic Filesystem Commands

The mutation log (`hive/mutations/`) is a filesystem-based command channel.
Clients write mutation files; the box processes them atomically.

## Why

The box and hivetool both observe the hive directory, but the filesystem
is not transactional. Multi-step operations need to appear atomic to both
sides. The mutation log solves this by funneling operations through the
box — the single writer — which executes all writes before triggering the
scheduler.

## Processing Modes

Mutations come in two flavors:

- **Hot** mutations are processed inline while the scheduler is running.
  The box executes the writes, then triggers the scheduler once.
  Examples: `respond-to-task`, `create-task-group`.

- **Cold** mutations require quiescence. The box shuts down Bees, processes
  the mutation in the gap between shutdown and restart. Examples: `reset`.

```
┌─────────────────────────────────────────────────────────┐
│               Hivetool (browser)                        │
│    writes mutations/{uuid}.json                         │
│                      │                                  │
│              filesystem ↕                               │
├─────────────────────────────────────────────────────────┤
│              Hive Directory (disk)                      │
│   mutations/   tickets/   logs/   config/               │
│       │                                                 │
│       ↓ watchfiles detects new .json file               │
├─────────────────────────────────────────────────────────┤
│                Box (bees.box)                           │
│                                                         │
│   Hot path:                                             │
│     1. Execute writes (response.json, metadata.json)    │
│     2. Write result file                                │
│     3. Trigger scheduler                                │
│                                                         │
│   Cold path:                                            │
│     1. Break inner loop                                 │
│     2. Shutdown Bees (cancel tasks, disconnect MCP)     │
│     3. Execute mutation (delete tickets/, logs/)        │
│     4. Write result file                                │
│     5. Restart Bees (re-boots root template)            │
└─────────────────────────────────────────────────────────┘
```

## File Format

### Mutation File

Written by the client (hivetool, script, etc.):

```
mutations/{uuid}.json
```

```json
{
  "type": "reset",
  "timestamp": "2026-04-16T10:25:00Z"
}
```

### Result File

Written by the box after processing:

```
mutations/{uuid}.result.json
```

```json
{
  "status": "ok",
  "timestamp": "2026-04-16T10:25:01Z"
}
```

Or on failure:

```json
{
  "status": "error",
  "error": "Unknown mutation type: frobnicate",
  "timestamp": "2026-04-16T10:25:01Z"
}
```

## Supported Mutations

### `reset` (cold)

Deletes all tasks (`tickets/`) and session logs (`logs/`). The directories
themselves are preserved (so filesystem handles and observers remain valid).
After restart, the root template re-boots automatically because no task with
a matching `playbook_id` exists.

### `respond-to-task` (hot)

Writes `response.json` and flips `metadata.assignee` to `"agent"` atomically.
Both writes complete before the scheduler is triggered, preventing the race
where the scheduler sees the assignee flip before the response file exists.

```json
{
  "type": "respond-to-task",
  "task_id": "uuid",
  "response": { "text": "user's reply" }
}
```

### `create-task-group` (hot)

Creates multiple tasks as a batch with intra-group dependency resolution.
Each task may include a `ref` name and a `depends_on` list of refs. Refs
are resolved to real task IDs within the batch. The scheduler is triggered
once after all tasks are created.

```json
{
  "type": "create-task-group",
  "tasks": [
    {
      "ref": "research",
      "objective": "Research the topic",
      "playbook_id": "researcher"
    },
    {
      "ref": "writer",
      "depends_on": ["research"],
      "objective": "Write a summary",
      "playbook_id": "writer"
    }
  ]
}
```

Result includes the ref → task ID mapping:

```json
{
  "status": "ok",
  "created": {
    "research": "abc123...",
    "writer": "def456..."
  }
}
```

### `pause-all` (hot)

Cancels all in-flight asyncio tasks and flips every non-terminal task
(`available`, `blocked`, `running`, `suspended`) to `paused`. Stashes the
pre-pause status in `paused_from` so resume can restore it. When processed
inline, the box passes the scheduler reference so the handler can cancel
live coroutines — not just update metadata. Aliases: `cancel-all`.

```json
{
  "type": "pause-all"
}
```

Result includes the count of affected tasks:

```json
{
  "status": "ok",
  "paused": 5
}
```

### `resume-paused` (hot)

Flips all `paused` tasks back to their pre-pause status (from `paused_from`).
Pure filesystem operation. Aliases: `resume-cancelled`.

```json
{
  "type": "resume-paused"
}
```

Result:

```json
{
  "status": "ok",
  "resumed": 5
}
```

### `pause-task` (hot)

Pauses a single task by ID. Cancels its asyncio task if running, then
flips status to `paused` with `paused_from` set for later resume.

```json
{
  "type": "pause-task",
  "task_id": "uuid"
}
```

### `resume-task` (hot)

Resumes a single paused task by ID, restoring its pre-pause status.

```json
{
  "type": "resume-task",
  "task_id": "uuid"
}
```


## Driving Mutations from the Command Line

```bash
# Reset the hive:
MUTATION_ID=$(uuidgen)
echo '{"type":"reset","timestamp":"'$(date -u +%FT%TZ)'"}' \
  > hive/mutations/$MUTATION_ID.json

# Check the result:
cat hive/mutations/$MUTATION_ID.result.json
```

## Startup Processing

When the box starts, it scans `mutations/` for unprocessed files (those
without a matching `.result.json`) and processes them before creating the
first `Bees` instance. This handles mutations submitted while the box was
down.

## Adding New Mutation Types

1. Add a handler function in `bees/mutations.py`.
2. Add a `case` to `_dispatch()`.
3. If it's a cold mutation, add its type to `COLD_MUTATIONS`.
4. Add a method to `MutationClient` in `hivetool/src/data/mutation-client.ts`.
5. Wire up UI in the appropriate component.

Hot mutation handlers run while the scheduler is live — they should only
write files, not delete directories or cancel tasks. Cold mutation handlers
run in a fully quiescent state — safe for any destructive operation.

## Garbage Collection

Result files accumulate in `mutations/` indefinitely. They're small (a few
hundred bytes each) and serve as an audit log. No automatic cleanup is
implemented — if it becomes necessary, a sweep on startup (e.g., delete
results older than 24h) is a bounded addition.

## Future Candidates

Not every filesystem write needs to become a mutation. The dividing line:
if a **partial execution could cause the box to take wrong action** (not
just see stale data), it's a mutation candidate. Simple single-file writes
where the worst case is "scheduler picks it up a beat late" are fine as
direct writes.

### Weak candidates (could benefit but aren't urgent)

| Mutation | Why it's borderline |
|----------|---------------------|
| `create-task` (single) | One `mkdir` + two file writes. `watchfiles` debounce usually batches them. The risk is low and the latency cost of a mutation is disproportionate. |
| `config-update` | Already handled by the config restart path. Could become a mutation if config updates need to carry metadata (e.g., "who changed this and why"). |

### Not candidates (direct writes are fine)

| Operation | Why |
|-----------|-----|
| Reads / scans | Inherently safe. Stale data self-corrects on next observer tick. |
| Single-file edits (skill content, template YAML) | One write, one observer reaction. No intermediate state. |
| Log file writes (box → disk) | Box is the sole writer. No cross-process race. |
