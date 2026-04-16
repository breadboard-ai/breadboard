# Mutation Log — Atomic Filesystem Commands

The mutation log (`hive/mutations/`) is a filesystem-based command channel.
Clients write mutation files; the box processes them atomically between
shutdown and restart.

## Why

The box and hivetool both observe the hive directory, but the filesystem
is not transactional. Multi-step operations like "reset" (delete all tasks
and logs) need to appear atomic to both sides. The mutation log solves this
by funneling destructive operations through the box — the single writer —
which processes them in a quiescent gap where no tasks are running and no
observers are reacting.

## How It Works

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
│   1. Break inner loop (like config restart)             │
│   2. Shutdown Bees (cancel tasks, disconnect MCP)       │
│   3. Process mutation (delete tickets/, logs/)          │
│   4. Write mutations/{uuid}.result.json                 │
│   5. Restart Bees (re-boots root template)              │
├─────────────────────────────────────────────────────────┤
│                Bees Framework                           │
│           Fresh Scheduler → Root Template               │
└─────────────────────────────────────────────────────────┘
```

The key insight: mutations are processed in the same gap the box already uses
for config restarts. No new concurrency model is needed.

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

### `reset`

Deletes all tasks (`tickets/`) and session logs (`logs/`). The directories
themselves are preserved (so filesystem handles and observers remain valid).
After restart, the root template re-boots automatically because no task with
a matching `playbook_id` exists.

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
3. Add a method to `MutationClient` in `hivetool/src/data/mutation-client.ts`.
4. Wire up UI in the appropriate component.

The handler runs in a fully quiescent state — no tasks running, no MCP
connections open. Safe for any destructive operation.

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

### Strong candidates (intermediate state is dangerous)

| Mutation | Why |
|----------|-----|
| `respond-to-task` | Currently two writes: `response.json` then `metadata.json` (flip assignee). The box could see the metadata flip before the response file lands, resuming the agent with no response. |
| `create-task-group` | Template-driven multi-task creation with `{{dep-ref}}` dependencies. If the box triggers the scheduler after task 1 is written but before tasks 2–5 exist, dependency resolution fails. |

### Weak candidates (could benefit but aren't urgent)

| Mutation | Why it's borderline |
|----------|---------------------|
| `create-task` (single) | One `mkdir` + two file writes. `watchfiles` debounce usually batches them. The risk is low and the latency cost of a mutation (shutdown/restart) is disproportionate. |
| `config-update` | Already handled by the config restart path. Could become a mutation if config updates need to carry metadata (e.g., "who changed this and why"). |
| `cancel-all` | Emergency stop: cancel running asyncio tasks and set status to `cancelled`. The filesystem alone can't stop in-flight coroutines — only the box can. But without a `resume-task` mutation, the recovery story is thin: cancelled tasks stay cancelled, and the system freezes. Needs a resume path to justify its own mutation type. |

### Not candidates (direct writes are fine)

| Operation | Why |
|-----------|-----|
| Reads / scans | Inherently safe. Stale data self-corrects on next observer tick. |
| Single-file edits (skill content, template YAML) | One write, one observer reaction. No intermediate state. |
| Log file writes (box → disk) | Box is the sole writer. No cross-process race. |

