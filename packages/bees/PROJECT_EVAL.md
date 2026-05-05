# Project Eval

## Orientation

Key files and concepts for this project:

- [bees/scheduler.py](bees/scheduler.py) — `run_all_waves()` batch mode (exits
  when no work remains)
- [bees/task_runner.py](bees/task_runner.py) — runs/resumes individual tasks,
  handles suspend state
- [bees/session.py](bees/session.py) — `EvalCollector`, `drain_session()`,
  structured JSON logs
- [bees/task_store.py](bees/task_store.py) — `respond(task_id, response)` writes
  `response.json` and flips `assignee`
- [bees/ticket.py](bees/ticket.py) — `TicketMetadata.suspend_event` carries what
  the agent asked
- [bees/functions/chat.py](bees/functions/chat.py) — `waitForInput` and
  `waitForChoice` suspend events
- [bees/box.py](bees/box.py) — filesystem-driven CLI (reference for entry point
  patterns)
- [bees/runners/gemini.py](bees/runners/gemini.py) — real model provider
- [bees/bees.py](bees/bees.py) — `Bees` entry point, event emitter wrapping
  `Scheduler`

## Summary

An eval framework that runs pre-configured hives to completion using real model
calls and a **simulated user** — an LLM session with a persona prompt that
responds when agents ask for user input.

**Input**: a set of pre-configured empty hives (config + skills), each with a
user persona prompt.

**Output**: the same hive directories populated with tickets, session logs, agent
files — the full artifact of a real run.

## Key design decisions

- **The model is real, the user is fake.** The eval framework doesn't replace the
  model (no TestRunner). It replaces the human with an LLM-driven actor.
- **The persona prompt is the spec.** No static scripts, no pattern matching.
  The user persona is a system instruction for a Gemini session that role-plays
  as a specific kind of user.
- **Batch mode, not box mode.** The eval runner drives the scheduler directly
  via `run_all_waves()`, not through the filesystem watcher. Fire everything,
  run to completion, exit.
- **Infrastructure first.** The batch runner is built on existing machinery
  (`Bees` + `Scheduler`). The simulated user layers on top once the plumbing
  works.

---

## Phase 1 — Eval CLI + Batch Runner

Run pre-configured hives from the command line. No simulated user yet — runs
exit when tasks suspend waiting for user input, or when all tasks complete.
This phase proves the plumbing.

- [x] **Eval set format.** A directory of hives, each identified by having
      `config/SYSTEM.yaml`. Eval-specific config lives in an `eval/`
      subdirectory inside each hive:
      ```
      eval_set/
        my-hive/                # A complete hive
          config/
            SYSTEM.yaml
            TEMPLATES.yaml
          skills/...
          eval/                 # Eval-specific config
            persona.md
        another-hive/
          config/...
          eval/
            persona.md
      ```
- [x] **Eval runner module** (`bees/eval/runner.py`). Takes one hive directory
      path. Copies it to a working directory (preserving the original). Creates
      `Bees(work_dir, runners)`, calls `bees.run()` (boots root template,
      recovers stuck tasks, runs batch drain), returns. The runner is a thin
      wrapper — `Bees` and `Scheduler` do the real work.
- [x] **Batch runner** (`bees/eval/batch.py`). Iterates hives in an eval set
      directory, runs each sequentially, reports per-case status (completed,
      suspended, failed, duration).
- [x] **CLI entry point** (`bees/eval/__main__.py`).
      `npm run eval -- run <hive_dir>` — single hive.
      `npm run eval -- run-set <eval_set_dir> --output results/` — batch.
- [x] **npm script** in `package.json`:
      `"eval": ".venv/bin/python -m bees.eval"`.

🎯 `npm run eval -- run-set eval_set/ --output results/` copies N hives to
working directories, runs each to completion (or suspension), and prints
per-case status. Each `results/{case}/hive/` is a populated hive directory with
tickets, logs, and agent files.

---

## Phase 2 — Simulated User

Add an LLM-driven user that responds when agents suspend. Runs now go past
suspensions to completion.

- [x] **Harness-driven simulation.** Instead of a separate API wrapper, the simulated
      user is implemented as a native `Bees` work task with `functions=["chat.*"]` and
      the `eval-persistent-user` tag, using standard session state resumption memory.
- [x] **Runner integration.** The eval runner wraps `bees.run()` in an orchestration
      loop. When business tasks suspend for the user, the runner handles the turn-by-turn
      handoff via `store.respond()` to alternate execution between the agent and the
      simulated user task.
- [x] **Persona loading.** The runner reads `eval/persona.md` from the case directory
      and maps it directly into the simulation task's objective instructions.
- [x] **Interaction logging.** Since the simulated user runs as a regular `Ticket`,
      all its turns, metrics, and complete thought logs are automatically saved natively
      in the `hive/tickets/` directory.

🎯 `npm run eval -- run path/to/case` runs the hive's root template to
completion, with the simulated user answering all `waitForInput` prompts in
character. The populated hive directory is the output.

---

## Phase 3 — Multi-Task User Dispatch

Handle swarms where multiple agents talk to the user simultaneously.

- [ ] **Per-task context assembly.** When multiple tasks suspend, the simulated
      user receives each one's `chat_log.json` independently, plus metadata
      about which agent is asking (template name, title, position in tree).
- [ ] **Conversation coherence.** The simulated user maintains a shared memory
      across all interactions — if it told Agent A "I want a React app", it
      shouldn't tell Agent B "I prefer Vue." Implemented as a growing summary
      of all prior interactions, appended to the persona prompt for each call.
- [ ] **Choice handling.** `waitForChoice` events present structured options
      (list of `{id, content}`). The simulated user sees the options in its
      prompt and returns `{"selected": ["choice-id"]}`. The persona prompt
      should guide selection strategy.

🎯 A multi-agent hive where the root and at least one child agent both ask the
user questions runs to completion with coherent, persona-consistent responses
across agents.

---

## Phase 4 — Structured Results Collection

Produce machine-readable summaries that a future evaluation layer can consume.

- [ ] **Per-case result manifest** (`results/{case}/result.json`). Captures:
      task tree (ids, titles, templates, statuses, outcomes), token usage
      (aggregate and per-task), turn counts, duration, errors, simulated user
      interactions (count, prompts answered).
- [ ] **Eval set summary** (`results/summary.json`). Aggregates across cases:
      pass/fail counts, total tokens, total duration, per-case status.
- [ ] **EvalCollector integration.** Wire the existing `EvalCollector` data
      (per-session structured logs in `hive/logs/`) into the result manifest
      so all data is accessible from a single file per case.

🎯 After a batch run, `results/summary.json` provides a machine-readable
overview and each `results/{case}/result.json` contains the full structured
data needed for automated evaluation (stage 2 of the larger effort).

---
