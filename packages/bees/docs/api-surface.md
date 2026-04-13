# Bees API Surface used by App

This document outlines the classes and functions from the `bees` core library that are consumed by the reference application in `packages/bees/app`.

> [!NOTE]
> The goal here is to clean up the API surface so that we can design it properly. So deprecating callers is part of this work.

## Summary

The application layer (`app/`) consumes `bees` primarily for:
- Task management (creation, listing, loading).
- Orchestration (running the scheduler loop).
- Session management (running individual sessions, loading keys).

## API Surface by Module

### `bees.playbook`

- `run_playbook(name: str)`: Used in `app/run_playbook.py` to create a task from a template.
  - [x] TODO: Remove this capability and remove `run_playbook` from the public API. (DONE)

### `bees.session`

- `load_gemini_key()`: Used in `app/cli.py`, `app/drain.py`, and `app/server.py` to load the API key.
  - [x] TODO: Move key loading to the `app` layer. The library should receive the key as a parameter. (DONE)
- `run_session(...)`: Used in `app/cli.py` to run a session directly.
  - [x] TODO: Remove this capability from the CLI and remove `run_session` from the public API. (DONE)

### `bees.scheduler`

- `Scheduler`: The core orchestrator. Used in `app/drain.py` and `app/server.py`.
  - Added `startup()` to handle recovery and root template booting.
  - Added `create_task()` to create tasks and notify hooks.
- `SchedulerHooks`: Interface for receiving callbacks from the scheduler. Used in `app/drain.py` and `app/server.py`.
  - Added `on_ticket_added` hook.

### `bees.ticket`

- `Ticket`: The task data model. Used in `app/server.py` and `app/respond.py`.
  - [ ] TODO: Alias to `Task` when exposing in the public API.
- `create_ticket(...)`: Used in `app/add_ticket.py`. (Note: `app/server.py` now uses `scheduler.create_task()`).
- `list_tickets(...)`: Used in `app/respond.py` and `app/server.py` to list tasks.
- `load_ticket(id: str)`: Used in `app/edit_tags.py` and `app/server.py` to load a specific task.
- [ ] TODO: `app/respond.py` directly manipulates ticket files (writing `response.json`). We need a proper API for updating task state (e.g., responding to a task) to fix this abstraction leak.
- [ ] TODO: Consider introducing a `TaskStore` (Repository pattern) to encapsulate task CRUD operations (`create_ticket`, `list_tickets`, `load_ticket`), preparing for non-filesystem storage backends.

## Rationale for API Exposure

These entry points represent the minimal set needed to build an application on top of `bees`. In a future refactor, these should be exposed via a clean, flat API in `bees/__init__.py` (e.g., `from bees import Scheduler, Ticket`).
