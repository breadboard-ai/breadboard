# Future Direction

Short- to medium-term work needed to close gaps in the framework and bring about
the vision described in [architecture.md](./architecture.md). Each section
identifies a concrete gap, explains why it matters, and sketches the direction.

## The Consumption API

The biggest open question in bees: how do applications build on this framework?

Today's answer is ad-hoc. The [reference app](./reference-app.md) wires
`SchedulerHooks` callbacks to SSE and exposes REST endpoints. This works, but
the boundary between "bees the library" and "the application built on bees" is
blurry. Three pieces need to crystallize.

### The Interaction Surface

The controller side of the MVC model (see [patterns.md](./patterns.md#the-controller-in-progress))
has no clean API. When an agent suspends with `assignee == "user"`, the consumer
must reach into the task directory and write `response.json`, then flip
`assignee` to `"agent"`. This is editing the model's internals.

**What's needed**: A framework-provided method for responding to a suspended
task — something like `scheduler.respond(ticket_id, response)`. The scheduler
owns the task lifecycle; responding to a task is a lifecycle transition, not a
file edit. The response format itself (text, selected choices, context updates)
is already well-understood from the reference app's `RespondRequest` model.

### The Observation API

`SchedulerHooks` is a bag of callbacks with no lifecycle contract. It's
invasive — the hooks reach deep into the scheduler's internals — and it only
supports one consumer. There's no way to have two independent observers of the
same scheduler (e.g., an SSE broadcaster and a metrics collector).

**Direction, not design**: The observation API should support multiple observers,
provide a typed event stream rather than positional callbacks, and cleanly
separate read-only observation from write-side interaction. Whether this is an
`AsyncIterable`, a subscribe/unsubscribe pattern, or something else is an open
design question. The reference app's SSE `Broadcaster` is evidence of the
pattern: it already fans out to multiple clients. The framework should do the
same at the scheduler level.

### The Library Extraction

The architecture doc states: "This reference application will be extracted from
the bees package." This means bees becomes a library that applications `import`,
not a server they fork.

**What extraction requires**:

- A clean `Scheduler` constructor that accepts configuration and a storage
  backend, with no implicit globals (currently the hive path is module-level).
- The interaction and observation APIs above — without them, every consumer ends
  up rebuilding `server.py`.
- A pluggable storage backend interface so the task store can be backed by a
  database, not just disk.

## Hive Abstraction

The hive is currently hard-coded to the filesystem. The
[patterns.md](./patterns.md#the-directory-as-universal-interchange) vision
describes the hive directory as a "universal interchange" that works for local
dev and as a live projection of production state. This requires two things:

### Storage backend protocol

The task store (reading/writing task state, listing tasks, filesystem access)
needs a protocol that `Scheduler` consumes, with at least two implementations:

- **Disk** — what exists today. The local development and hivetool story.
- **Database** — for production. Tasks persist in a database; the filesystem
  layer may be backed by object storage.

The configuration surface (templates, skills, system config) can remain
file-based — it's the task runtime state that needs to scale.

### Production attachment

The aspirational workflow: attach to a production instance and have task data
stream to local disk for observation with hivetool. This is a sync protocol:
the production store projects its state onto a local hive directory, and
hivetool reads it as if it were a local run.

This is further out, but the storage backend protocol is a prerequisite.

## Multi-Hive Support

A user should be able to run multiple hives simultaneously. Use cases: A/B
testing different template configurations, running evaluations against a
baseline, comparing swarm behavior across variants.

**What's blocking**: The scheduler currently assumes a single hive. The hive
path, template registry, and ticket store are effectively singletons. Supporting
multiple hives means making these instance-scoped rather than module-scoped —
which overlaps with the library extraction work above.

## Event Delivery

The event system works but is [settling](./flux.md#event-delivery). Three
specific concerns:

- **Discovery**: Agents must declare `watch_events` in their template to receive
  events. There's no way for an agent to discover what event types exist at
  runtime.
- **Subscription scope**: `events_broadcast` goes to all subscribers.
  `tasks_send_event` goes to a specific child. There's no middle ground (e.g.,
  broadcast to a subtree, or to tasks matching a filter).
- **Event typing**: Events are untyped dicts. As the system grows, there's
  pressure for a schema — both for documentation and for runtime validation.

These are not urgent but will compound if left unaddressed.

## Filesystem Scoping

The shared filesystem with slug-based write fencing is
[settling](./flux.md#filesystem-sharing). One open question from the
[patterns.md](./patterns.md#isolated-file-systems) dead ends:

**Isolates**: A future need may arise for subagents that intentionally do _not_
inherit the parent filesystem. No use case has required this yet, but the
pressure may come as agents handle more sensitive or compartmentalized workloads.
The current model is too open for some scenarios (e.g., an agent working on
credentials should not share its workspace upward).

## Template Open Questions

From [flux.md](./flux.md#task-templates):

- **Hooks**: The `on_ticket_done` / `on_event` Python hook mechanism has unclear
  boundaries. Should hooks be replaced by event-driven templates? By a more
  structured plugin system? The current mechanism works but feels like an escape
  hatch rather than a design.
- **Root template**: The `SYSTEM.yaml` → `boot_root_template` mechanism is a
  special case that probably shouldn't be special. Why isn't the root template
  just an `autostart` entry — the same mechanism used for all other automatic
  task creation?
- **Top-level entry points**: There's no clean external API for "start this
  work." Today it requires calling `run_playbook` (code) or the server endpoints
  (HTTP). The library API should make this a first-class operation.

## Naming Migration

The codebase uses legacy names (`ticket`, `playbook`, `playbook_id`) while the
documentation uses the new names (`task`, `template`, `template_id`). This is a
mechanical migration — well-suited for a codemod — but it needs to happen
across Python source, TypeScript source, YAML config, REST endpoints, and SSE
event types. The migration should be coordinated as a single change to avoid a
prolonged mixed-terminology state.

## Dead Code Removal

The [DAG-based workflow model](./patterns.md#dag-based-workflows) left fossils
in the codebase: `depends_on`, `blocked` status, `promote_blocked_tickets`,
topological sort logic, and the old `GUIDE.md` playbook syntax. These should be
removed once we're confident no downstream consumer depends on them.
