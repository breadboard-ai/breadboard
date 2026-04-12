# Design Interview Log

Raw insights from the architect, captured during the Phase 3 interview.
These will be distilled into `docs/patterns.md`.

---

## What Failed

### Playbooks → Agent-driven delegation

The original model was **playbooks**: pre-declared DAGs of steps with
dependency edges, resolved by the scheduler. A playbook defined the entire
workflow upfront — step A feeds step B, step B feeds step C — and the scheduler
orchestrated execution topologically. Analogous to a CI/CD pipeline or an
Airflow DAG.

**What replaced it**: Agent-driven delegation. Instead of the scheduler knowing
the workflow graph upfront, agents create child tasks dynamically as they run
via `tasks_create_task`. The agent is a program that calls subroutines
(subagents). The workflow emerges at runtime, not at declaration time.

**Why it failed**: The DAG model was too rigid. Real agent workflows aren't
known in advance — the agent discovers what work needs to be done as it
executes. The subroutine model is more flexible because the calling agent can
decide when, whether, and how many times to delegate based on what it learns.

**Fossils in the code**: `depends_on` field, `blocked` status,
`promote_blocked_tickets()`, topological sort in playbook creation, the old
GUIDE.md's `{{step-name}}` dependency syntax. These are mostly dead code but
retained for now.

### Isolated file systems → Shared by default

The original model gave each agent its **own isolated file system**. Data
sharing happened explicitly — passing files through events or outcomes, like
message passing between processes.

**What replaced it**: Shared file systems. Subagents inherit their parent's
filesystem by default, scoped by write fencing (slug paths). Every agent can
read the entire workspace; they can only write to their own subdirectory.

**Why it failed**: Explicit file passing was too cumbersome. In practice,
agents in a hierarchy need to share data freely via the file system — one agent
writes a file, the next reads it. The shared filesystem model made this natural.

**Open question**: The current model may be *too* open. There may be a future
need for "isolates" — subagents that intentionally do *not* inherit the parent
filesystem. This hasn't been needed yet, but the pressure may come as use cases
grow.

---

## What Makes a Good Agent

### The three levers: functions, system instruction, objective

Agent behavior is shaped by three interacting controls:

1. **Functions** — what the agent *can* do (tools available).
2. **System instruction** — how the agent *should* behave (assembled from
   function group instructions + skill instructions).
3. **Objective** — what the agent *must* accomplish (the prompt).

These aren't independent. They interact, and sometimes fight each other.

**Diagnostic signal**: If you're fighting the prompt — adding more and more
instructions trying to force a behavior — stop. The problem is likely in the
other two levers. The functions available (or their system instructions) may be
preventing or discouraging the behavior you need. Fix the environment, not the
prompt.

### The escalation ladder

When an agent isn't behaving as expected, work through this sequence:

1. **Check capabilities first.** Do you have the right functions? Functions are
   capabilities — if the agent can't do what you need, no amount of prompting
   will fix it.
2. **Check system instructions.** The function group instructions might need
   tweaking. But don't overfit to your specific use case. Think systemically:
   what's the general way to reframe the instruction that resolves the problem
   for all agents using this function group, not just yours?
3. **Add new functions — as a last resort.** This is a HAMMER. Before adding a
   function, make sure it belongs at the right layer. Don't add functions that
   solve your particular app's problem to the framework. Instead, ask: what's
   the scheduler or session abstraction that would serve this purpose
   generally? The function should feel like a natural part of the framework,
   not a patch for one use case.

### Writing good objectives

Don't yell at the agent. Don't use strongly imperative directives. Don't write
"code in English" — trying to procedurally script the agent's behavior through
prose. Instead, write objectives as **mental models**: give the agent the right
frame of thinking and let it figure out how to accomplish the goal.

**Never use LLMs to write prompts.** This follows directly from Ashby's Law of
Requisite Variety: the regulator (prompt) must have at least as much variety as
the system being regulated (agent behavior). An LLM-generated prompt has the
same variety as the LLM that will interpret it — it can't add information. A
human's richer, differently-structured mental model is what creates the delta
that steers the agent somewhere useful.

---

## The Economics of Delegation

### Free the main thread

Always delegate when chatting with the user. The chat agent is like a UI thread
— the less work it does itself, the more available it is to respond. Delegate
work to subagents to keep the chat agent responsive.

### Right-size task granularity

Subagents are capable — they can do a lot. Don't break work into smaller agents
than necessary. If a workflow requires step 1 → step 2 → step 3 and those
steps always run in sequence without needing to restart mid-step, that's one
subagent, not three. The boundary for a new subagent is where you need
independent restartability, parallelism, or a different capability set — not
where you'd put a function boundary in code.

### Agents are free

Presume that subagents are "free." Don't sweat over creating too many. Swarms
like to grow — that's the design intent. The framework handles the
orchestration; the template author should think about what needs doing, not
about the cost of spinning up another agent.

---

## Context Budget

### The aspiration: skills carry the knowledge

Ideally, the subagent model is:

1. Add skills to the template — they define *how* the agent behaves.
2. Leave the objective as a direct pass-through of `{{system.context}}` — it
   defines *what* the agent works on.
3. Profit.

Skills carry the behavioral specification. The objective carries the task
specification. The template wires capabilities (functions) and knowledge
(skills) together; the delegating agent fills in intent (context).

We're not there yet — many templates still have complex objectives with
embedded behavioral instructions — but this is the target. The pressure should
be toward moving behavioral knowledge into skills and keeping objectives thin.

### Context is infinite

Don't fret over going over the line. It's the session layer's responsibility to
ensure context is properly compacted and cached. Template authors should treat
context as infinite and focus on giving the agent the information it needs, not
on fitting within a token budget.

### Context is wisdom

Modern LLMs have very low to no context degradation. More context makes agents
*better*, not worse — an agent that has been running for a long time has
accumulated wisdom from its interactions. Infinitely running agents are the
future. Don't design for short-lived sessions; design for agents that grow
wiser over time.

### Have file system, will learn

The shared file system isn't just storage — it's a knowledge reservoir. Teach
agents to explore the file system and learn from what's already there. Even an
agent that starts from scratch should be able to bootstrap by reading existing
files written by previous agents. This is how swarm-level knowledge accumulates
across agent boundaries without passing data through LLM context.

---

## The Consumption API Shape

### MVC: the scheduler delivers a Model

The mental model is MVC. The scheduler delivers a **Model** — tasks and their
data. The consumer (application) provides the **Views** and **Controllers**.

Views are projections of tasks based on tags. This is why tags are so important
in templates: they form the contract between the framework and the application.
Tags are application-specific — they connect the model to the views.

### Tags as the API contract

A tag on a template declares: "tasks created from this template will need this
kind of treatment from the consumer." The consumer queries the model for tasks
matching specific tags and renders the appropriate UI.

**Concrete example**: A task with a `"chat"` tag tells the consumer that there's
an agent that needs a chat UI. The consumer:

1. Queries the model for all tasks tagged `"chat"`.
2. Displays them as threads.
3. Reads task status (`suspended`, `running`) to show activity state.
4. Reads the chat log on the task to display the conversation.

The task model is decoupled from the UI — different applications can project the
same tasks into different views. The framework doesn't know what a "chat UI"
looks like. It just provides tasks with tags and data; the consumer decides
what to do with them.

### The Controller gap

The controller side works similarly: when a task is suspended with
`assignee == "user"`, the consumer knows it needs to provide input. The
framework signals "I need something from you" via task state; the consumer
responds.

The part that's in flux: there's no clean API for this. Today, the consumer
has to edit the ticket directly — write `response.json`, flip `assignee` to
`"agent"`. The consumer is reaching into the model's internals instead of going
through a proper interaction surface. This is the main thing that needs to be
designed for the consumption API to mature.

### SchedulerHooks: undercooked

`SchedulerHooks` is the closest thing to a plugin API for consumers, but it's
very undercooked. It's invasive — the hooks reach deep into the scheduler's
internals — which *might* be OK, but it's not clear this is the right
abstraction. Needs very careful examination for patterns before committing to a
design. This is exploratory territory, not something to stabilize prematurely.

---

## The Hive as a Product Concept

### The directory as universal interchange

The hive directory on disk serves two roles:

1. **Local development** — the config surface where you author templates,
   skills, and hooks. You run the hive locally, iterate with hivetool until it
   works, then deploy.
2. **Production snapshot** — a projection of production state onto the local
   filesystem.

The aspirational workflow:

1. Create a local config on disk. Run it. Iterate with hivetool until the
   swarm behaves as intended.
2. Push a button to deploy. The config is deployed to production, where the
   task store is backed by a database (not files) and built for scale.
3. Attach to a production instance. Task data streams to the local disk as
   files. Observe what's happening using hivetool — the same tool used for
   local development.
4. Tweak the local config. Redeploy.

The disk format is the universal interchange — it works for local authoring and
as a live projection of production state. The backing store changes (disk → DB),
but the configuration surface is always the hive directory.

### Multiple hives

A user should be able to open and run multiple hives simultaneously. Use cases:
A/B testing different configurations, running evaluations against a baseline,
comparing swarm behavior across template variants. Each hive is self-contained
— the directory-as-config model makes this natural, since spinning up a second
hive is just pointing at a different directory.
