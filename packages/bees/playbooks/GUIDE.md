# Writing Playbooks

A playbook is a declarative recipe that spins up one or more AI agents to
accomplish a goal. This guide covers everything you need to author, test, and
debug playbooks in the Bees framework.

## Contents

1. [Conceptual Model](#conceptual-model)
2. [Directory Structure](#directory-structure)
3. [PLAYBOOK.yaml Reference](#playbookyaml-reference)
4. [Template Variables](#template-variables)
5. [Function Groups](#function-groups)
6. [Skills](#skills)
7. [Inter-Agent Coordination](#inter-agent-coordination)
8. [Lifecycle Hooks](#lifecycle-hooks-hookspy)
9. [Patterns and Recipes](#patterns-and-recipes)
10. [Testing and Debugging](#testing-and-debugging)

---

## Conceptual Model

A playbook describes a **directed acyclic graph (DAG) of steps**. When a
playbook runs, the engine:

1. **Parses** the YAML file and discovers the steps.
2. **Sorts** steps topologically — dependencies first.
3. **Creates a ticket** for each step. A ticket is a work unit: an objective
   for an agent to fulfill, persisted as a directory on disk.
4. **Stamps** every ticket with:
   - `playbook_id` — the playbook's `name` field.
   - `playbook_run_id` — a unique UUID for this particular run.

The **scheduler** then picks up these tickets and drives them through their
lifecycle:

```
available → running → completed | failed
                    → suspended (waiting for user input or a context update)
```

Each ticket runs an **independent agent session** — a separate LLM conversation
with its own tools, files, and context. Steps don't share memory; they
communicate through outcomes (dependency references) and coordination signals.

### The Scheduler Cycle

The scheduler operates in waves:

1. **Promote** — check `blocked` tickets whose dependencies are now
   `completed`; promote them to `available`.
2. **Collect** — gather all `available` tickets plus `suspended` tickets that
   have received a response.
3. **Execute** — fire collected tickets concurrently as independent agent
   sessions.
4. **Settle** — each session runs until it reaches a resting state
   (`completed`, `failed`, or `suspended`).
5. **Trigger** — if any tickets settled, wake the scheduler to evaluate the
   next wave.

This means independent steps in your playbook execute in parallel automatically.
Sequential ordering only happens when you wire explicit dependencies via template
references.

---

## Directory Structure

Each playbook lives in its own directory under `playbooks/`:

```
playbooks/
  my-playbook/
    PLAYBOOK.yaml          # Required — the step definitions
    hooks.py               # Optional — Python lifecycle hooks
```

The directory name is the playbook's filesystem identifier — it's what you pass
to CLI commands and API calls to run the playbook. The `name` field inside the
YAML is the *logical* identifier used for `playbook_id` on tickets.

---

## PLAYBOOK.yaml Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Logical identifier. Used as `playbook_id` on tickets and by `playbooks_run_playbook`. |
| `title` | string | yes | Human-readable title shown in UI and listings. |
| `description` | string | no | Short summary shown in `playbooks_list` results. Supports YAML `>` for multi-line. |
| `hidden` | boolean | no | If `true`, excluded from `playbooks_list` results. The playbook can still be run directly. Use this for infrastructure playbooks (like Opie) that shouldn't appear as user-facing options. |
| `steps` | mapping | yes | The step definitions (see below). |

### Step Fields

Each key under `steps:` is the step name — a short identifier used for
dependency references. The value is a mapping with these fields:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | string | — | Human-readable title for the ticket. |
| `objective` | string | — | The agent's instructions. This is the core: a natural-language prompt describing what the agent should accomplish. Supports [template variables](#template-variables). Use YAML `>` for multi-line. |
| `functions` | list[string] | `[]` (all) | [Function filter](#function-groups) globs controlling which tools the agent can use. An empty list or omitted field means all functions are available. |
| `skills` | list[string] | `[]` (none) | Names of [skills](#skills) to load into the session. An empty list or omitted field means no skills. Use `["*"]` for all. |
| `tags` | list[string] | — | Metadata tags. Used for UI routing (e.g., `"chat"` tags enable chat UI), lifecycle hook targeting, and coordination signal filtering. |
| `model` | string | — | Override the default model. Example: `gemini-3.1-pro-preview`. If omitted, uses the system default. |
| `watch_events` | list[object] | — | Subscribe to [coordination signals](#inter-agent-coordination). Each entry has `type` (required) and optionally `tags` for filtering. |
| `assignee` | string | — | Initial assignee (`"user"` or `"agent"`). Rarely needed — the scheduler manages this automatically. |

### Example: Minimal Playbook

```yaml
name: hello
title: Hello World
description: A single-step playbook that greets the user.

steps:
  main:
    title: Greeter
    objective: >
      Say hello to the user and ask how they're doing. When they respond,
      wish them a great day and finish.
    functions: ["chat.*", "system.*"]
```

---

## Template Variables

Template variables use `{{...}}` syntax inside `objective` strings. They are
resolved at ticket creation time (not at agent runtime).

### `{{step-name}}`

References another step's **output**. This creates a dependency edge — the
current step won't start until the referenced step completes.

At creation time, the engine replaces `{{step-name}}` with the ticket ID of the
referenced step. At execution time, the scheduler resolves that ticket ID to the
step's outcome content, which is injected into the agent's context as a
structured input segment.

```yaml
steps:
  research:
    objective: >
      Research the topic of quantum computing. Save your findings
      to research-notes.txt.
    functions: ["system.*", "sandbox.*"]

  summarise:
    objective: >
      Read the research from {{research}} and produce a concise summary.
      Save it to summary.txt.
    functions: ["system.*", "sandbox.*"]
```

Here, `summarise` is automatically blocked until `research` completes. When it
runs, `{{research}}` is replaced with the research step's outcome.

You can also use the explicit form `{{playbook.step-name}}` — it behaves
identically but makes the namespace clear.

### `{{system.context}}`

Replaced with the **caller-supplied context string**. This is the `context`
parameter from `playbooks_run_playbook` (when an agent launches the playbook) or
the value passed via CLI.

Only **root steps** (steps with no dependencies on other steps) receive the
context. This prevents context duplication in downstream steps that already
receive structured input from their dependencies.

```yaml
steps:
  interview:
    objective: >
      You are conducting an intake interview. Here is the initial request:

      {{system.context}}

      Ask 3-5 clarifying questions, then produce a specification.
    functions: ["chat.*", "system.*"]
```

### `{{system.ticket_id}}`

Replaced with the ticket's own UUID. Useful when the agent needs to produce
self-referencing links (e.g., `navigateTo('{{system.ticket_id}}')`).

---

## Function Groups

Functions are the tools an agent can call during its session. They're organized
into named **function groups**, each providing a set of related capabilities.

### Filter Syntax

The `functions` field accepts glob patterns in dot-notation. The dot separates
the group prefix from the tool name:

| Pattern | Effect |
|---------|--------|
| `["chat.*"]` | Only chat tools |
| `["chat.*", "system.*"]` | Chat and termination tools |
| `["chat.*", "sandbox.*", "coordination.*"]` | Chat, bash, and coordination |
| not specified / `[]` | **All functions available** (permissive default) |

> **Design note**: Functions default to *everything*. This is the opposite of
> skills, which default to *nothing*. The rationale: most agents need the
> standard toolset; restricting tools is the exception, not the rule.

### Available Groups

#### `system.*` — Termination

| Function | Description |
|----------|-------------|
| `system_objective_fulfilled` | Signals successful completion. The `objective_outcome` parameter becomes the ticket's outcome, which downstream steps can reference. |
| `system_failed_to_fulfill_objective` | Signals failure. The `user_message` parameter is stored as the ticket's error. |

Every session ends by calling one of these. If your step should report a result
for downstream consumption, return it via `system_objective_fulfilled`.

#### `simple-files.*` — File I/O

| Function | Description |
|----------|-------------|
| `system_write_file` | Write text to a file. Use bare filenames (e.g., `report.md`). |
| `system_list_files` | List all files in the working directory. |
| `system_read_text_from_file` | Read a file's text content. |

Files are stored in the ticket's virtual file system and persisted to
`tickets/{uuid}/filesystem/` on disk.

#### `sandbox.*` — Bash Execution

| Function | Description |
|----------|-------------|
| `execute_bash` | Run a bash command in the ticket's working directory. Sandboxed — cannot write outside the ticket dir. |

The sandbox and file tools share the same working directory. A file created via
`system_write_file` is immediately available in bash (`cat report.md`), and vice
versa.

On macOS, commands run inside `sandbox-exec` with a restrictive profile: read
access is unrestricted, but write access is confined to the ticket's working
directory and system temp dirs.

#### `chat.*` — User Interaction

| Function | Description |
|----------|-------------|
| `chat_request_user_input` | Ask the user a freeform question. Suspends the session until a response arrives. |
| `chat_present_choices` | Present structured choices (radio buttons or checkboxes). Suspends until selection. |
| `chat_await_context_update` | Suspend until an external [coordination signal](#inter-agent-coordination) arrives. No user prompt is shown. |

All three functions can return `context_updates` — system notifications from
coordination signals that accumulated while the agent was waiting.

**The `"chat"` tag**: Tickets tagged with `"chat"` get special treatment in the
UI — their chat history is persisted and restored across page reloads. Always
tag steps that use `chat.*` functions with `"chat"`.

#### `skills.*` — Skill Loading (Instruction-Only)

This group has no callable functions. It provides a system instruction that
lists the available skills and mounts their files into the agent's virtual file
system at `$HOME/skills/{skill-name}/SKILL.md`. The agent reads them using
`system_read_text_from_file` or bash.

#### `playbooks.*` — Playbook Management

| Function | Description |
|----------|-------------|
| `playbooks_list` | List available playbooks (name, title, description). Hidden playbooks and those tagged `"testing"` are excluded. |
| `playbooks_run_playbook` | Launch a playbook. The `context` parameter briefs the agents about what to do. Returns immediately — running a playbook is delegation, not blocking. |

#### `coordination.*` — Signal Emission

| Function | Description |
|----------|-------------|
| `coordination_emit` | Emit a typed signal (`signal_type` + `context` payload) that gets routed to all subscribing agents. Fire-and-forget. |

See [Inter-Agent Coordination](#inter-agent-coordination) for the full picture.

---

## Skills

Skills are instruction documents that shape agent behavior without adding new
callable tools. They're loaded from `bees/skills/{name}/SKILL.md` files.

To load a skill, list its `name` in the step's `skills` field:

```yaml
skills: ["interview-user", "ui-generator"]
```

Use `["*"]` to load all available skills. An omitted or empty field loads none.

The skill's `SKILL.md` file (and any companion files like tools or scripts) is
mounted into the agent's virtual file system. The agent is instructed to read
skills referenced in its objective.

---

## Inter-Agent Coordination

The coordination system lets agents communicate across independent sessions. It
has three moving parts:

### 1. Emitting Signals — `coordination_emit`

An agent calls `coordination_emit(signal_type, context)` to broadcast a typed
signal. This creates a **coordination ticket** — a lightweight ticket that
carries no work, only the signal payload.

```yaml
# In the agent's objective:
#   "After each generation, emit a coordination signal by calling
#    coordination_emit with signal_type 'app_update' and a summary."
```

### 2. Subscribing — `watch_events`

A step subscribes to signals via the `watch_events` field:

```yaml
watch_events:
  - type: app_update
  - type: digest_update
```

When the scheduler processes a coordination ticket, it routes the signal to all
tickets whose `watch_events` include the matching `type`.

#### Tag Filtering

You can narrow delivery with tags:

```yaml
watch_events:
  - type: app_update
    tags: ["!testing"]          # Exclude signals from testing-tagged sources
  - type: digest_update
    tags: ["production"]        # Only from production-tagged sources
```

- `"!tag"` — exclude: skip signals whose source ticket has this tag.
- `"tag"` — require: only deliver if the source has this tag.

### 3. Receiving — `chat_await_context_update`

The receiving agent calls `chat_await_context_update()` to suspend its session
until a signal arrives. When a matching coordination ticket is routed to it, the
agent resumes with the signal payload in `context_updates`.

```yaml
steps:
  digest:
    objective: >
      Call chat_await_context_update and wait. When a context update
      arrives, process it, then call chat_await_context_update again.
      Repeat forever.
    functions: ["chat.*", "sandbox.*", "coordination.*"]
    watch_events:
      - type: app_update
```

### How It Works End-to-End

1. Agent A calls `coordination_emit(signal_type="app_update", context="New app created: ...")`.
2. This creates a coordination ticket with `signal_type=app_update`.
3. The scheduler wakes and routes it: scans all tickets for matching `watch_events`.
4. Agent B's ticket has `watch_events: [{type: app_update}]` and is currently
   suspended on `chat_await_context_update`. The scheduler writes the signal
   payload to Agent B's `response.json` and flips its assignee to `agent`.
5. Agent B's session resumes. The `chat_await_context_update` function returns
   `{context_updates: ["New app created: ..."]}`.

### Delivery Semantics

- **Durable**: Coordination tickets persist on disk. If the server restarts,
  undelivered signals are retried on the next scheduler cycle.
- **Busy subscribers are retried**: If the receiving agent is currently running
  (not suspended), the signal is queued and delivered when it next suspends.
- **Playbook completion**: When all tickets in a playbook run reach a terminal
  state, the scheduler automatically emits a `playbook_complete` signal with a
  summary, routed via the same coordination mechanism.

### Context Updates on Chat Functions

When an agent is suspended on `chat_request_user_input` or `chat_present_choices`
(waiting for user input), coordination signals arrive as `context_updates` in
the response. The agent receives both the user's reply and any accumulated
signals in one response. The agent's objective should include instructions for
handling these — typically a brief status acknowledgment woven into the reply.

---

## Lifecycle Hooks (`hooks.py`)

A playbook can include a `hooks.py` Python module alongside its `PLAYBOOK.yaml`.
The engine discovers it automatically and calls recognized functions at specific
lifecycle points.

### `on_startup(tickets: list[Ticket]) → list[Ticket]`

Called once when the server boots, after all tickets have been recovered. The
function receives the full list of existing tickets and should return any new
tickets it creates.

**Use case**: Auto-booting an agent if none exists. Opie uses this to ensure
there's always an Opie session running:

```python
def on_startup(tickets: list[Ticket]) -> list[Ticket]:
    """Boot Opie if no opie-tagged ticket exists."""
    has_opie = any(
        t.metadata.tags and "opie" in t.metadata.tags
        for t in tickets
    )
    if has_opie:
        return []
    return run_playbook("opie")
```

### `on_ticket_done(ticket: Ticket) → None`

Called when a ticket owned by this playbook reaches a terminal state (`completed`
or `failed`). The playbook ownership is determined by matching the ticket's
`playbook_id` to the playbook's `name`.

**Use case**: Post-processing after an agent finishes — for example,
auto-bundling generated UI code:

```python
def on_ticket_done(ticket: Ticket) -> None:
    """Auto-build the UI bundle if the agent produced an App.jsx."""
    if ticket.metadata.status != "completed":
        return
    # ... check for App.jsx, run bundler ...
```

### `on_event(signal_type: str, payload: str, ticket: Ticket) → str | None`

Called when a coordination signal is about to be delivered to a ticket owned by
this playbook. The hook can inspect the signal, apply side effects, and decide
whether the signal reaches the agent.

**Return values**:
- Return a `str` — the (possibly transformed) payload is delivered to the agent.
- Return `None` — the signal is **eaten**: marked as delivered, but the agent
  never sees it.

**Timing**: The hook fires **before the idle check** — it runs for all matching
subscribers regardless of their current state (running, blocked, or suspended).
This ensures side-effect-only hooks (like title renames) take effect immediately,
even while the agent is busy.

**Error handling**: If the hook raises an exception, the signal is delivered
as-is (fail-open). A crashing hook should not silently drop signals.

**Use case**: Renaming tickets when the app's purpose is determined:

```python
def on_event(signal_type: str, payload: str, ticket: Ticket) -> str | None:
    """Rename tickets when the app title is determined."""
    if signal_type == "update_app_title":
        ticket.metadata.title = payload
        ticket.save_metadata()
        return None  # Eaten — agent doesn't need to know.
    return payload
```

The corresponding PLAYBOOK.yaml subscribes to the signal:

```yaml
steps:
  ui-gen:
    title: UI Generator
    watch_events:
      - type: update_app_title
```

When another agent emits `coordination_emit(signal_type="update_app_title",
context="Grocery Tracker")`, the hook renames the ticket from "UI Generator"
to "Grocery Tracker" and eats the signal — the agent continues working
without interruption.

### `on_run_playbook(context: str | None) → str | None`

Called before ticket creation when someone invokes this playbook. It receives the
caller-supplied context and can:

- **Enrich**: Return a modified/enriched context string. Tickets will be created
  with this enriched context.
- **Abort**: Return `None` to cancel the run. A `PlaybookAborted` exception is
  raised and the caller receives a `{status: "skipped"}` response.

**Use case**: Checking preconditions, enriching context with live system state,
or deduplicating runs.

### Import Pattern

Hooks are loaded dynamically via `importlib`. Your `hooks.py` should import from
`bees` modules as needed:

```python
from bees.playbook import run_playbook
from bees.ticket import Ticket
```

---

## Patterns and Recipes

### Pattern 1: Finite Pipeline

A DAG of steps where each step's output feeds the next. The simplest pattern —
steps run in dependency order and the playbook completes when all steps finish.

```yaml
name: research-and-summarise
title: Research and Summarise
description: >
  A two-step playbook that researches a topic and then produces a summary.

steps:
  research:
    title: Research
    objective: >
      Conduct thorough research on the following topic:

      {{system.context}}

      Gather key details, facts, and relevant information. Save your findings
      to a file called research-notes.txt.
    functions: ["system.*", "sandbox.*"]

  summarise:
    title: Summarise
    objective: >
      Read the research from {{research}} and produce a concise,
      well-structured summary. Save it to a file called summary.txt.
    functions: ["system.*", "sandbox.*"]
```

**Key points**:
- `{{system.context}}` is injected into `research` (the root step) from the
  caller.
- `{{research}}` in `summarise` creates the dependency. The summarise step
  receives the research step's outcome as structured input.
- Neither step has `chat.*` — they work autonomously without user interaction.
- Both steps call `system_objective_fulfilled` when done (this is inherent in the
  agent loop — every session ends with a termination call).

### Pattern 2: Interactive Chat Agent

A single step that converses with the user indefinitely. The step never calls
`system_objective_fulfilled` — it stays suspended between turns.

```yaml
name: assistant
title: Assistant
description: A conversational assistant.

steps:
  main:
    title: Assistant
    objective: >
      You are a helpful assistant. Chat with the user and help them with
      whatever they need.
    functions: ["chat.*", "simple-files.*"]
    tags: ["chat"]
```

**Key points**:
- `tags: ["chat"]` enables chat history persistence and UI routing.
- `functions: ["chat.*", "simple-files.*"]` — the agent can chat and manage
  files, but cannot execute code or launch playbooks.
- The agent uses `chat_request_user_input` in a loop. Each call suspends the
  session; each user response resumes it.

### Pattern 3: Infinite Event Loop

An agent that sleeps, wakes on external signals, processes them, and goes back
to sleep. It never terminates.

```yaml
name: rendering
title: Testing Updates
description: A playbook to test updates.

steps:
  main:
    title: Infinite chat that listens for updates.
    objective: >
      As soon as you start, call chat_await_context_update and wait for a
      context update to arrive.

      Once the context update is received, write a poem about it into a new
      file, and then call chat_await_context_update again. Repeat forever.
    tags: ["testing"]
    functions: ["chat.*", "simple-files.*"]
    watch_events:
      - type: test_update
```

**Key points**:
- `watch_events` subscribes to `test_update` signals. Without this, no
  coordination signals would be routed to this ticket.
- The agent calls `chat_await_context_update`, not `chat_request_user_input` —
  it's waiting for system signals, not user input.
- The objective explicitly instructs the loop: process, then call
  `chat_await_context_update` again.

### Pattern 4: Orchestrator + Delegate

One persistent agent (the orchestrator) dispatches work to other playbooks and
receives completion notifications. This is the Opie pattern.

```yaml
name: opie
title: Opie
description: Executive assistant — understands objectives and delivers results
hidden: true

steps:
  main:
    title: Opie
    objective: >
      You are Opie, an executive assistant.

      Your task is to await user requests and act on them. Use playbooks for
      delegating work.

      1. Read the "persona" skill for instructions on how to behave.
      2. Read available playbooks.
      3. Converse with user, and when their request matches a playbook, run it
      to delegate work.
    skills: ["persona"]
    tags: ["opie", "chat"]
    functions: ["chat.*", "simple-files.*", "skills.*", "playbooks.*"]
    watch_events:
      - type: app_update
      - type: digest_update
```

**Key points**:
- `hidden: true` — Opie doesn't show up in the playbook listing (it would be
  circular for Opie to delegate work to itself).
- `functions` includes `playbooks.*` so the agent can discover and run
  playbooks.
- `watch_events` subscribes to coordination signals from delegated work. When a
  child playbook's agents emit `app_update` or `digest_update`, Opie receives
  them as `context_updates` alongside user responses.
- The `hooks.py` uses `on_startup` to auto-boot Opie if no opie-tagged ticket
  exists — Opie is always running.

### Pattern 5: Multi-Step App with Coordination

A playbook with sequential steps that communicate back to the orchestrator via
coordination signals. Each step has both internal work and external signaling.

```yaml
name: app
title: App Builder
description: >
  Builds a custom app: interviews the user, then generates and iterates on a
  React UI.

steps:
  interview:
    title: Interviewer
    objective: >
      You are conducting an intake interview to understand what the user wants
      to build.

      Here is the initial request from the user:

      {{system.context}}

      Ask focused, clarifying questions (3-5 at most), then create a
      specification. Emit a coordination signal with signal_type "app_update"
      and return the specification as outcome.
    functions: ["chat.*", "system.*", "simple-files.*", "skills.*", "coordination.*"]
    skills: ["interview-user"]
    tags: ["chat", "app-builder"]

  ui-gen:
    title: UI Generator
    objective: >
      You are building a React application based on the specification from
      {{interview}}.

      Generate the UI, run the bundler, emit a coordination signal with
      signal_type "app_update". Then ask the user if they'd like changes.
      Iterate indefinitely.
    functions: ["chat.*", "sandbox.*", "coordination.*", "skills.*"]
    skills: ["ui-generator"]
    tags: ["bundle", "app-builder", "chat"]
    model: gemini-3.1-pro-preview
```

**Key points**:
- `interview` is a root step — it receives `{{system.context}}` from whoever
  launched the playbook (typically Opie via `playbooks_run_playbook`).
- `ui-gen` depends on `interview` via `{{interview}}`. It won't start until the
  interview completes.
- Both steps emit `coordination_emit(signal_type="app_update")` — this notifies
  the parent orchestrator (Opie) about progress.
- `interview` uses `coordination.*` even though it's a finite step — it emits a
  signal before finishing to provide an early update.
- `ui-gen` specifies `model: gemini-3.1-pro-preview` to use a more capable model
  for code generation.
- `ui-gen` uses `sandbox.*` for bash execution (running the bundler) and
  `chat.*` for iterating with the user.

---

## Testing and Debugging

### Running a Playbook (CLI)

Create tickets from a playbook without starting the server:

```bash
npm run playbook:run -w packages/bees -- my-playbook
```

This shows which tickets were created and their dependency relationships.

### Draining Tickets (CLI)

Execute all available tickets in batch mode:

```bash
npm run ticket:drain -w packages/bees
```

Runs cycles until no work remains, printing event summaries to stderr. Results
are written as JSON to stdout. This is useful for testing finite playbooks
end-to-end.

### Server Mode

Start the full development server with scheduler, SSE, and REST API:

```bash
npm run dev:server -w packages/bees
```

The server runs on port 3200 with auto-reload for `.py`, `.md`, `.json`, and
`.yaml` files. Changes to your PLAYBOOK.yaml take effect on the next playbook
run without restarting the server.

**API endpoints**:
- `GET /playbooks` — list available playbooks
- `POST /playbooks/{name}/run` — run a playbook
- `GET /tickets` — list all tickets (optionally filter by `?tag=chat`)
- `GET /tickets/{id}` — get a single ticket with metadata
- `POST /tickets/{id}/respond` — submit a response to a suspended ticket
- `GET /events` — SSE stream for real-time updates

### Eval Logs

Every agent session writes a detailed log file in the eval viewer format to
`packages/bees/out/`:

```
bees-{ticket-id-prefix}-{timestamp}.log.json
```

These files contain the full conversation (system instruction, user turns, model
responses, function calls) and can be loaded into the eval viewer for inspection.

### Tags as Debugging Handles

Use `tags` strategically for debugging:

- `"testing"` — steps with this tag are excluded from `playbooks_list`, keeping
  them out of production agent discovery.
- Custom tags let you filter tickets via the API:
  `GET /tickets?tag=app-builder`.

### Common Pitfalls

**Missing `system.*` in functions**: Without `system.*`, the agent can't call
`system_objective_fulfilled` or `system_failed_to_fulfill_objective`. The session
will eventually error out because the agent has no way to terminate. Always
include `system.*` for steps that should complete (or the default, which adds all
functions). Steps that intentionally loop forever (chat agents, event listeners)
can omit it — they rely on session suspension instead.

**Missing `chat.*` tag**: If a step uses `chat_request_user_input` but isn't
tagged `"chat"`, the chat history won't be persisted or restored across page
reloads. The step still functions, but users lose context on refresh.

**Circular dependencies**: `{{step-a}}` referencing `{{step-b}}` and vice versa
will raise a `ValueError` with the cycle information. The topological sort
catches this at playbook run time.

**Context only reaches root steps**: `{{system.context}}` is only injected into
steps that have no dependencies on other steps. If your second step needs the
original context, either thread it through the first step's outcome or design
your first step to pass it along.

**`watch_events` without `chat_await_context_update`**: Subscribing to events
via `watch_events` only sets up the routing. The agent must actually *suspend*
(via `chat_await_context_update` or `chat_request_user_input`) to receive the
signals. If the agent completes without suspending, signals arrive but have no
session to deliver to.

**`chat_await_context_update` without `watch_events`**: Calling
`chat_await_context_update` suspends the session, but without `watch_events`,
no coordination signals will be routed to the ticket. The agent will hang
indefinitely. The only exception is playbook-completion signals, which are routed
by tag matching.
