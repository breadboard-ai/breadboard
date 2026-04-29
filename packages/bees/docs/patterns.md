# Design Patterns

This document captures the design knowledge behind the Bees framework — the
mental models, rules of thumb, and hard-won lessons that shape how agents are
built. It is not an architecture guide (see `architecture.md` for the layer
model). It is the reasoning that precedes the architecture. A template field
reference is included as an [appendix](#appendix-template-schema-reference).

## Dead Ends

Not everything in the framework survived contact with reality. These dead ends
are design knowledge — understanding why they failed prevents re-inventing them.

### DAG-based workflows

The original model was **playbooks**: pre-declared directed acyclic graphs of
steps with dependency edges, resolved by the scheduler at boot time. A playbook
defined an entire workflow upfront — step A feeds step B, step B feeds step C —
and the scheduler orchestrated execution topologically.

This was too rigid. Real agent workflows aren't known in advance. The agent
discovers what work needs to be done as it executes. The model that replaced it
— agents create child tasks dynamically via `tasks_create_task` — is more like a
program calling subroutines. The workflow emerges at runtime, not at declaration
time.

Code fossils remain (`depends_on`, `blocked` status, topological sort). These
are mostly dead code, retained for now.

### Isolated file systems

The original model gave each agent its own isolated file system. Data sharing
happened explicitly — passing files through events or outcomes, like message
passing between processes.

This was too cumbersome. In practice, agents in a hierarchy need to share data
freely — one agent writes a file, the next reads it. Shared file systems with
write fencing replaced this: every agent can read the entire workspace but only
write to its own subdirectory.

Open question: the current model may be too open. A future need may arise for
"isolates" — subagents that do not inherit the parent filesystem. This hasn't
been needed yet.

## Building Agents

### The three levers

Agent behavior is shaped by three interacting controls:

| Lever                  | Role                              |
| ---------------------- | --------------------------------- |
| **Functions**          | What the agent _can_ do (tools).  |
| **System instruction** | How the agent _should_ behave.    |
| **Objective**          | What the agent _must_ accomplish. |

These aren't independent — they interact, and sometimes fight. If you're adding
more and more prompt instructions trying to force a behavior, stop. The problem
is likely in the other two levers. Fix the environment, not the prompt.

### The escalation ladder

When an agent isn't behaving right, work through this sequence:

1. **Check capabilities.** Do you have the right functions? Functions are
   capabilities — if the agent can't do what you need, no amount of prompting
   will fix it.
2. **Check system instructions.** The function group's system instruction might
   need tweaking. But don't overfit to your use case. Think systemically: what's
   the general reframing that resolves the problem for all agents using this
   function group?
3. **Add new functions — last resort.** This is a hammer. Before adding a
   function, make sure it belongs at the right layer. Don't add functions that
   solve your particular app's problem. Ask: what's the scheduler or session
   abstraction that would serve this purpose generally?

### Writing good objectives

Write objectives as **mental models**, not as commands. Don't yell at the agent.
Don't use strongly imperative directives. Don't write "code in English" —
procedurally scripting the agent's behavior through prose. Give the agent the
right frame of thinking and let it figure out the how.

**Don't let LLMs write prompts.** Ashby's Law of Requisite Variety says the
regulator must have at least as much variety as the system it regulates. An
LLM-generated prompt has the same variety as the LLM that interprets it — it
can't add information. A human's richer, differently-structured mental model is
what creates the delta that steers the agent somewhere useful. Put differently,
if LLM generated the prompt, it already knows how to do what you want it to do
and you don't need to write a prompt for it.

## Delegation

Three rules of thumb:

### Free the main thread

Always delegate when chatting with the user. The chat agent is the UI thread —
the less work it does itself, the more available it is to respond. Heavy lifting
belongs in subagents.

### Right-size granularity

Subagents are capable. Don't decompose into smaller agents than necessary. If a
workflow runs step 1 → step 2 → step 3 in sequence and never restarts mid-step,
that's one subagent, not three. The boundary for a new subagent is where you
need independent restartability, parallelism, or a different capability set —
not where you'd put a function boundary in code.

### Agents are free

Presume that subagents are "free." Don't sweat over creating too many. Swarms
like to grow — that's the design intent. Focus on what needs doing, not on the
cost of spinning up another agent.

## Context

### Skills carry the knowledge

The target model for subagents is:

1. Add skills to the template — they define _how_ the agent behaves.
2. Leave the objective as a pass-through of `{{system.context}}` — it defines
   _what_ the agent works on.

Skills carry the behavioral specification. The objective carries the task
specification. The template wires capabilities (functions) and knowledge
(skills) together; the delegating agent fills in intent (context). We're not
fully there yet — many templates still embed behavioral instructions in the
objective — but this is the direction. Move behavioral knowledge into skills;
keep objectives thin.

### Context is infinite

The session layer is responsible for compaction and caching. Template authors
should treat context as infinite and focus on giving the agent the information
it needs, not on fitting within a token budget.

### Context is wisdom

Modern LLMs have very low to no context degradation. More context makes agents
better, not worse — an agent that has been running for a long time has
accumulated wisdom from its interactions. Infinitely running agents are the
future. Design for agents that grow wiser over time.

### Have file system, will learn

The shared file system is a knowledge reservoir, not just storage. Teach agents
to explore existing files and learn from them. Even an agent starting from
scratch can bootstrap by reading what previous agents have written. This is how
swarm-level knowledge accumulates across agent boundaries — through files, not
through LLM context.

## The Consumption Model

### MVC

The scheduler delivers a **Model** — tasks and their data. The consumer
(application) provides **Views** and **Controllers**.

Views are projections of tasks based on tags. Tags on templates are
application-specific — they form the contract between the framework and the
consumer, connecting the model to the views.

### Tags as the API contract

A tag on a template declares: "tasks created from this template will need this
kind of treatment from the consumer." The consumer queries the model for tasks
matching specific tags and renders the appropriate UI.

Example: a task with a `"chat"` tag tells the consumer that an agent needs a
chat UI. The consumer queries for all `"chat"` tasks, displays them as threads,
reads task status for activity state, and reads the chat log for conversation
history. Different applications can project the same tasks into entirely
different views.

### The Controller (in progress)

The controller side works similarly: when a task is suspended with
`assignee == "user"`, the consumer knows it needs to provide input. The
framework signals "I need something from you" via task state.

Today, the consumer has to edit the task directly — write `response.json`, flip
`assignee`. This is reaching into the model's internals. A proper interaction
surface is the main thing needed for the consumption API to mature.

### Typed Events

Applications observe the scheduler through typed events via the `Bees` class
(`bees.on(TaskDone, callback)`). Each event is a `@dataclass` subclassing
`SchedulerEvent`. This replaced the earlier `SchedulerHooks` callback bag and
is now settled — see [flux.md](./flux.md) for stability classification.

## The Hive

### The directory as universal interchange

The hive directory on disk serves two roles:

1. **Local development** — the config surface where you author templates,
   skills, and hooks. Run locally, iterate with hivetool, deploy when ready.
2. **Production snapshot** — a live projection of production state onto the
   local filesystem.

The aspirational workflow:

1. Author a local config on disk. Run it. Iterate with hivetool.
2. Deploy to production, where the task store is backed by a database and built
   for scale.
3. Attach to the production instance. Task data streams to local disk. Observe
   with hivetool — the same tool used for local development.
4. Tweak, redeploy.

The disk format is the universal interchange. The backing store changes (disk →
DB), but the configuration surface is always the hive directory.

### Multiple hives

A user should be able to open and run multiple hives simultaneously — A/B
testing, evaluations, configuration comparisons. Each hive is self-contained;
spinning up a second one is just pointing at a different directory.

---

## Appendix: Template Schema Reference

Each entry in `hive/config/TEMPLATES.yaml` defines a single task template. When
a template is "run", the engine creates a task from it: an objective for an
agent to fulfill, persisted as a directory on disk.

### Fields

| Field          | Type     | Required | Description                                                                                                                                                                   |
| -------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | string   | **yes**  | Logical identifier. Used as `playbook_id` on tasks and for delegation via `tasks_create_task`. Must be unique across all templates.                                           |
| `title`        | string   | no       | Human-readable title shown in UI and task type listings.                                                                                                                      |
| `description`  | string   | no       | Short summary shown in task type listings.                                                                                                                                    |
| `objective`    | string   | no       | The agent's instructions (natural-language prompt). Supports `{{system.context}}` and `{{system.ticket_id}}` interpolation.                                                   |
| `functions`    | string[] | no       | Function filter globs controlling which tools the agent can use. Empty/omitted = all functions available. Examples: `"files.*"`, `"tasks.*"`, `"system.*"`.            |
| `skills`       | string[] | no       | Names of skill directories to load into the session. Each name must match a subdirectory of `hive/skills/`.                                                                   |
| `tags`         | string[] | no       | Metadata tags for UI routing, lifecycle hooks, and filtering. Special tags: `"chat"` enables persistent chat history; `"bundle"` marks templates that produce bundled output. |
| `model`        | string   | no       | Override the default model (e.g., `"gemini-3.1-pro-preview"`).                                                                                                                |
| `watch_events` | object[] | no       | Subscribe to inter-agent coordination events. Each entry has a `type` field (e.g., `{type: "digest_ready"}`).                                                                 |
| `tasks`        | string[] | no       | Allowlist of template names this agent can delegate to via `tasks_create_task`.                                                                                               |
| `autostart`    | string[] | no       | Template names to stamp as child tasks automatically when this template is run. Each entry creates a subagent task linked to the parent.                                      |
| `runner`       | string   | no       | Which session runner to use: `"generate"` (batch text, default) or `"live"` (Gemini Live API for voice sessions).                                                             |
| `voice`        | string   | no       | Prebuilt voice name for Live API audio output (e.g., `"Kore"`). Only used with `runner: live`.                                                                                |
| `assignee`     | string   | no       | Initial assignee: `"user"` (start suspended, waiting for input) or `"agent"` (start immediately). Default is `"agent"`.                                                        |

### Interpolation

Template objectives support placeholder interpolation:

- **`{{system.context}}`** — replaced with the context string passed when the
  task is created (typically the parent agent's delegation instructions).
- **`{{system.ticket_id}}`** — replaced with the created task's UUID.

### Function Globs

The `functions` field uses glob patterns to filter which tools are available:

- `"files.*"` — all functions in the `files` group.
- `"system.*"` — all system functions (terminate, context access).
- `"tasks.*"` — task delegation functions.
- `"chat.*"` — chat functions (request user input, await context updates).
- `"events.*"` — event broadcasting.
- `"sandbox.*"` — sandboxed code execution.
- `"generate.text"` — a single specific function.

Omitting `functions` entirely grants access to all available functions.

### Example

```yaml
- name: researcher
  title: Researcher
  description: Deeply researches a given topic
  objective: >
    Your job is to deeply research the following topic:

    {{system.context}}

    Compile relevant, accurate information. Save your findings to a file called
    research-data.json or research-notes.md.

    Return the relative path of the file with research.
  functions: ["system.*", "sandbox.*", "files.*", "generate.text"]
```
