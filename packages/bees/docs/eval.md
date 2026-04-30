# Eval — Batch Evaluation Framework

Bees includes an evaluation framework for running hives in batch mode — no
server, no file watcher, no user interaction. The eval runner copies a hive to
a working directory, boots the root template, runs all tasks to completion (or
suspension), and produces a populated hive directory with tickets, logs, and
agent-produced files.

## Core API: `Bees.run()`

The batch mode entry point is `Bees.run()` — the one-shot counterpart to
`Bees.listen()`.

```python
bees = Bees(hive_dir, runners)
summaries = await bees.run()  # startup → drain → shutdown
```

`run()` calls `scheduler.startup()` (recovers stuck tasks, boots the root
template), `scheduler.run_all_waves()` (batch drain with post-completion
coordination), and `scheduler.shutdown()` (MCP cleanup).

Unlike `listen()`, `run()` does **not** start the filesystem watcher or the
background trigger loop. It runs cycles until no available or resumable tasks
remain, then exits.

### Swarm Coordination

`run_all_waves()` includes post-completion hooks that enable swarm hives
(parent delegates to children, waits for results):

1. When a child task completes, its result is delivered as a context update
   to the parent task.
2. The parent's assignee flips from `"user"` to `"agent"`, making it
   resumable.
3. The next cycle picks up the parent and resumes it with the child's
   outcome.

This mirrors the server-mode `_wrap_execution` hooks but operates within the
batch gather loop.

## Eval as a Hive Concept

Eval configuration is a **first-class subdirectory** inside a hive, not an
external wrapper. A hive that supports evaluation contains an `eval/`
directory:

```
my-hive/
  config/
    SYSTEM.yaml
    TEMPLATES.yaml
  skills/...
  eval/                   # Eval-specific configuration
    persona.md            # Simulated user persona (Phase 2)
```

This design keeps the hive self-contained: the same directory is both the
runtime hive and the eval case. The `eval/` directory is ignored by the
scheduler — it holds configuration consumed only by the eval framework.

## Eval Sets

An eval set is a directory of hives:

```
eval_set/
  my-hive/
    config/SYSTEM.yaml
    skills/...
    eval/persona.md
  another-hive/
    config/SYSTEM.yaml
    eval/persona.md
```

Discovery is based on the `config/SYSTEM.yaml` marker — any child directory
that contains it is treated as a hive (eval case).

## CLI

```bash
# Single hive:
npm run eval -- run path/to/hive

# Batch (eval set):
npm run eval -- run-set path/to/eval_set --output results/

# Help:
npm run eval -- --help
```

The `run` command copies the hive to an output directory (default:
`results/<timestamp>`) and runs it.  The `run-set` command discovers all
hives in the set directory, runs each sequentially, and prints a summary
table.

## Module Structure

| Module | Responsibility |
|--------|---------------|
| `bees/eval/__init__.py` | Package marker, exports `run_case`, `run_set` |
| `bees/eval/runner.py` | Single-case runner: copy hive → create runners → `Bees.run()` → `CaseResult` |
| `bees/eval/batch.py` | Batch runner: discover hives → run sequentially → summary table |
| `bees/eval/__main__.py` | CLI with `run` and `run-set` subcommands |

## Result Types

**`CaseResult`** — result of running a single eval case:

| Field | Type | Description |
|-------|------|-------------|
| `case_name` | `str` | Human-readable name (defaults to hive directory name) |
| `status` | `str` | Derived: `"completed"`, `"suspended"`, `"failed"`, or `"mixed"` |
| `duration_s` | `float` | Wall-clock duration in seconds |
| `task_count` | `int` | Number of tasks in the hive after the run |
| `summaries` | `list[dict]` | Raw per-cycle summaries from `run_all_waves()` |
| `tasks` | `list[TaskSummary]` | Per-task detail (id, title, template, status) |
| `error` | `str \| None` | Error message if the run failed |

**`TaskSummary`** — per-task detail:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `str` | Task identifier |
| `title` | `str \| None` | Task title |
| `template` | `str \| None` | Playbook template name |
| `status` | `str` | Final task status |
| `error` | `str \| None` | Error message if failed |
| `outcome` | `str \| None` | Task outcome if completed |
