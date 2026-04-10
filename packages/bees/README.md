# Bees

Agent swarm orchestration framework. Uses the opal-backend agent loop
to run sessions from the command line.

## Setup

```bash
npm run setup -w packages/bees
```

This creates a `.venv` and installs opal-backend (with its local deps) plus bees.

## Configuration

Create a `.env` file in `packages/bees/`:

```
GEMINI_KEY=your-gemini-api-key
BEES_HIVE_DIR=hive
```

`BEES_HIVE_DIR` controls the name of the directory where Bees stores
runtime data (tickets, logs). It defaults to `hive`.

## Running a Single Session

```bash
npm run session:start -w packages/bees -- "Your prompt here"
```

Events stream to stderr with live emoji summaries. The final result
prints as JSON to stdout.

## Tickets

Tickets are work units — an objective for the agent to fulfill.

### Creating Tickets

```bash
npm run ticket:add -w packages/bees -- "Tell me a joke"
npm run ticket:add -w packages/bees -- "Write a haiku about the sea"
```

Each ticket becomes a directory under `hive/tickets/{uuid}/` containing
`objective.md` and `metadata.json`.

### Draining the Queue

```bash
npm run ticket:drain -w packages/bees
```

Runs all available tickets in parallel, streaming events to stderr.
Each ticket's metadata is updated with status, turn count, thoughts,
outcome or error. Results print as JSON to stdout.

---

## Status Query Syntax

The `/status` endpoint (replacing `/pulse`) provides a summary of active work. It supports query parameters for filtering tickets before they are aggregated into task summaries.

### Parameters

*   `kind`: Filter by ticket kind (e.g., `work`, `coordination`).
    *   Negation: `kind=!coordination`
*   `status`: Filter by status (comma-separated list).
    *   Example: `status=available,running,blocked,suspended`
    *   Negation: `status=!completed,!failed`
*   `tags`: Filter by tags (comma-separated list).
    *   Example: `tags=foo,bar`
    *   Negation: `tags=!opie,!digest`

### Filtering Logic

*   **Negation (`!`)**: Excludes the ticket if the value matches (e.g., `tags=!opie` hides opie tickets).
*   **Multiple Values (Comma-separated)**: Treated as `OR` (e.g., `status=running,suspended` shows either running or suspended tickets).
*   **Multiple Parameters**: All parameters must be satisfied (`AND`).

---

## Functions

Functions are the tools an agent can call during a session. They are
organized into **function groups** — named modules that each provide a
set of related tools.

### Naming Convention

Actual function names use underscores: `{group}_{tool_name}`. The
filter notation replaces the **first** underscore with a dot to
separate the group prefix from the tool name:

| Actual function name | Filter notation |
| --- | --- |
| `chat_request_user_input` | `chat.request_user_input` |
| `chat_present_choices` | `chat.present_choices` |
| `system_write_file` | `system.write_file` |

### Function Filters

The `functions` field on a ticket (or playbook step) controls which
tools are available to the agent. It accepts a list of dot-notation
glob patterns:

| Pattern | Effect |
| --- | --- |
| `["chat.*"]` | Only chat tools |
| `["chat.*", "system.*"]` | Chat and system tools |
| `["chat.*", "orchestrator.*"]` | Chat plus orchestrator-specific tools |
| not specified / `[]` | All functions available (no filtering) |

When a filter is set, only functions whose dot-notation name matches
at least one pattern are included in the session.

> **Note:** The default for functions is permissive — omitting the field
> means "everything available". This is the opposite of skills, where
> omitting the field means "nothing loaded". See
> [Tying It Together](#tying-it-together-functions-and-skills-in-playbooks)
> for the rationale.

### Available Function Groups

| Group | Filter prefix | Functions | Source |
| --- | --- | --- | --- |
| `system` | `system.*` | `system_objective_fulfilled`, `system_failed_to_fulfill_objective` | `bees/functions/system.py` — overrides the built-in system group to expose only the termination functions. Uses a `FunctionGroupFactory` to late-bind against the session's controller and file system. |
| `simple-files` | `simple-files.*` | `system_list_files`, `system_write_file`, `system_read_text_from_file` | `bees/functions/simple_files.py` — file operations split out from the built-in system group into a standalone group. Uses a `FunctionGroupFactory`. |
| `sandbox` | `sandbox.*` | `execute_bash` | `bees/sandbox.py` — sandboxed bash execution in the ticket's working directory. |
| `skills` | `skills.*` | _(instruction-only)_ | `bees/functions/skills.py` — mounts skill files into the agent's virtual file system at `/mnt/skills/`. |

The `system` and `simple-files` groups use the **factory pattern**: they
receive a `SessionHooks` object at session startup which provides access
to the session's controller, file system, and task tree manager. Their
handlers are identical to the built-in opal-backend implementations.

Declarations for each group live in `bees/declarations/{name}.*`.

### Adding a New Function Group

Function groups are defined in `opal-backend` as declarations (JSON
metadata + markdown instruction). To add a new function group for Bees:

1. Create declaration files in `bees/declarations/`:
   - `{name}.functions.json` — tool schemas
   - `{name}.instruction.md` — system instruction for the group
   - `{name}.metadata.json` — group metadata

2. Implement handlers if the group has callable tools (instruction-only
   groups like `skills` skip this step).

3. Register the group so it's included in sessions.

---

## Skills

Skills are instruction-only additions that shape the agent's behavior
without adding new callable tools. They're loaded from markdown files
that the agent can read during its session.

### Directory Structure

```
hive/skills/
  interviewer/
    SKILL.md
  another-skill/
    SKILL.md
```

Each skill is a subdirectory of `hive/skills/` containing a `SKILL.md`
file. The directory name is the skill's filesystem identifier.

### SKILL.md Format

```markdown
---
name: interview-user
title: Interview User
description: >
  Use it whenever the user asks an open ended question
  to fully understand their needs.
---

[Instruction content the agent reads during its session...]
```

The YAML frontmatter provides metadata:
- `name` — the identifier used in ticket/playbook `skills` lists
- `title` — display name in the skill listing
- `description` — short summary shown alongside the title

The markdown body below the frontmatter is the actual instruction
content. It gets mounted into the agent's virtual file system at
`/mnt/skills/{dir_name}/SKILL.md`, where the agent can read it.

### Skill Filters

The `skills` field on a ticket (or playbook step) controls which skills
are loaded into the session:

| Value | Effect |
| --- | --- |
| not specified / `[]` | No skills loaded |
| `["interview-user"]` | Only the named skill |
| `["interview-user", "another"]` | Multiple specific skills |
| `["*"]` | All available skills |

Skills default to **none**. You must explicitly list them or use `*`.

### Adding a New Skill

1. Create a directory: `hive/skills/{your-skill-name}/`
2. Add a `SKILL.md` with YAML frontmatter (`name`, `title`,
   `description`) and the instruction body.
3. Reference it by `name` in ticket or playbook `skills` lists.

No code changes needed — skills are discovered by scanning the
`hive/skills/` directory at import time.

---

## Playbooks

Playbooks are ticket templates — YAML files that describe a DAG of
work. Each step becomes a ticket. Dependencies between steps are
expressed as `{{step-name}}` references in objectives.

### Playbook Format

```yaml
name: opie
title: Opie
description: Chat with the user and dispatch playbooks as needed

steps:
  main:
    title: Opie
    objective: >
      You are Opie, a helpful conversational assistant. Your job is
      to chat with the user. You are done when the user says "goodbye".
    skills: []
    tags: ["opie"]
    functions: ["chat.*"]
```

Step properties: `title`, `objective`, `functions`, `skills`, `tags`,
`assignee`. Dependencies are inferred from `{{step-name}}` references
in `objective`.

Each ticket is stamped with `playbook_id` (the playbook name) and
`playbook_run_id` (a UUID for the run) for traceability.

### Dependencies

Use `{{step-name}}` in an objective to reference another step's output.
The playbook engine resolves these into `{{ticket-id}}` references when
creating tickets in topological order:

```yaml
steps:
  research:
    objective: Research the topic of quantum computing.
    functions: ["system.*"]

  summarize:
    objective: >
      Summarize the research from {{research}} into a short article.
    functions: ["system.*"]
```

Here, `summarize` depends on `research`. The engine creates the
`research` ticket first, then substitutes its ticket ID into the
`summarize` objective before creating that ticket.

### Tying It Together: Functions and Skills in Playbooks

The `functions` and `skills` fields on each step control the agent's
capabilities for that specific ticket. This lets you build pipelines
where each step has exactly the tools it needs:

```yaml
steps:
  gather:
    objective: Interview the user about their app idea.
    functions: ["chat.*"]
    skills: ["interview-user"]

  build:
    objective: >
      Build the app described in {{gather}}.
    functions: ["system.*", "sandbox.*"]
    skills: []
```

- `gather` can only chat (no file system, no code execution) and
  uses the interviewer skill to guide the conversation.
- `build` can use system and sandbox tools but has no chat — it works
  autonomously from the gathered requirements.

### Running a Playbook

CLI:

```bash
npm run playbook:run -w packages/bees -- opie
```

Web UI: Open the devtools, switch to the "Run Playbooks" tab, and
click **Run** on the playbook card.

Both methods create tickets for each step and trigger the drain.

### Adding a New Playbook

1. Create a YAML file in `hive/playbooks/{name}/PLAYBOOK.yaml`.
2. Define `name`, `title`, `description`, and `steps`.
3. Use `functions` and `skills` on each step to scope capabilities.
4. Use `{{step-name}}` in objectives to wire dependencies.

The filename (without `.yaml`) is the playbook identifier used by the
CLI and web UI.

## Output

All session log files land in `packages/bees/hive/logs/` in the eval
viewer's `EvalFileData` format (`bees-session-{date}.log.json`), loadable
directly by `packages/visual-editor/eval/viewer`.
