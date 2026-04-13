# Bees — Agent Context

Read this before making changes in `packages/bees`.

## What is Bees

Bees is a Python library for building agent swarm systems. It has two layers:

| Layer         | Responsibility                                                                 | Key file            |
| ------------- | ------------------------------------------------------------------------------ | ------------------- |
| **Session**   | One LLM conversation: agent loop, tools, suspend/resume, context management.   | `bees/session.py`   |
| **Scheduler** | Drives sessions via a task data model. Tasks capture state; scheduler manages. | `bees/scheduler.py` |

Applications (server, web shell, CLI) are built on top of these layers.

For the full architecture reference, see
[docs/architecture.md](docs/architecture.md).

## Directory Structure

```
packages/bees/
  bees/                  # Python source — the library
    session.py           # Session layer: agent loop, context, suspend/resume
    scheduler.py         # Scheduler layer: task lifecycle, coordination
    server.py            # Reference FastAPI server (will be extracted)
    playbook.py          # Template loading, task creation from templates
    ticket.py            # Task data model (on-disk "ticket" format)
    functions/           # Function group implementations
    declarations/        # Function declarations (JSON schemas)
  hive/                  # Runtime configuration — the "hive" directory
    config/
      SYSTEM.yaml        # Boot config: title, root template
      TEMPLATES.yaml     # All task templates
      hooks/             # Python lifecycle hooks per template
    skills/              # Agent skill documents (SKILL.md + assets)
    tickets/             # Runtime task state (on-disk)
    logs/                # Session logs
  web/                   # Reference web shell (React, will be extracted)
  hivetool/              # Built-in dev workbench (Lit, Vite)
  docs/                  # Human + agent documentation
  tests/                 # Python tests
```

## Key Concepts

- **Tasks** are like issues in a bug tracker. They capture objective, status,
  assignee, dependencies, and outcome. Agents work on tasks; tasks form trees.
- **Templates** (`TEMPLATES.yaml`) are blueprints for tasks. They define what
  tools, skills, and delegation powers an agent gets. See
  [docs/patterns.md](docs/patterns.md#appendix-template-schema-reference).
- **Skills** are markdown instruction documents in `hive/skills/`. They use
  [Agent Skills](https://agentskills.io/home) format with `allowed-tools`
  frontmatter.
- **Function groups** are the extensibility seam for the session layer. Each
  group bundles declarations, handlers, and a system prompt fragment.
- **The Hive** is the on-disk directory that holds all configuration and runtime
  state.

## Naming Migration (In Progress)

The code is migrating terminology. When reading code:

| Old term (in code) | New term (in docs) |
| ------------------ | ------------------ |
| `ticket`           | task               |
| `playbook`         | template           |
| `playbook_id`      | template_id        |

Use the **new** terminology in documentation and comments. In code, follow
whatever the surrounding file uses until the codemod lands.

## Python Conventions

- Use `pyproject.toml` for project config. The package is `bees`.
- Tests use `pytest` in `tests/`.
- The developer environment uses a corporate mirror for package repositories. If
  package installation fails, remind the user to run `gcert`.

## Deeper References

| Topic            | Document                                             |
| ---------------- | ---------------------------------------------------- |
| Architecture     | [docs/architecture.md](docs/architecture.md)         |
| Session layer    | [docs/session.md](docs/session.md)                   |
| Scheduler layer  | [docs/scheduler.md](docs/scheduler.md)               |
| Hivetool         | [docs/hivetool.md](docs/hivetool.md)                 |
| Design patterns  | [docs/patterns.md](docs/patterns.md)                 |
| Stability map    | [docs/flux.md](docs/flux.md)                         |
| Interview log    | [docs/interview-log.md](docs/interview-log.md)       |
