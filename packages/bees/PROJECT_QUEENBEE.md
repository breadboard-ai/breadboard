# Project Queen Bee — Comprehensive Bees Documentation

The bees framework has outgrown its documentation. The code has evolved through
several architectural shifts (playbooks → templates, multi-step DAGs → flat
templates + hierarchical tasks, `playbooks.*` → `tasks.*`), but the docs still
describe the old world. This project produces documentation that captures both
the current system and its directional intent.

**Audience**: Contributors to bees — people who need to understand how the
system is layered, how pieces fit, and which layer to extend for the result they
want.

**Organizing principle**: Bees is a library with two layers. Applications are
built on top of it.

| Layer         | Responsibility                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **Session**   | The atom. One LLM conversation with tools, suspend/resume, context management. Nothing is smaller. |
| **Scheduler** | Drives sessions via the task data model. Tasks capture state; scheduler flips bits.                |

---

## Phase 1: The Organizing Document

🎯 **Objective**: A contributor reads `docs/architecture/index.md` and can
identify which file to open for any given change.

- [x] Write `docs/architecture/index.md` — the three-layer model, per-layer
      module map, extensibility seams, and cross-cutting concerns (task
      hierarchy, shared workspaces, context delivery).
- [x] Remove or replace `docs/architecture/manager-agent-pattern.md` (obsolete).

---

## Phase 2: Layer Deep Dives

🎯 **Objective**: A contributor can trace a task from creation through execution
to completion using the docs alone.

- [x] `docs/session.md` — The session concept, the agent loop implementation
      (`opal_backend`), how `opal_backend` provides the full function inventory
      and bees filters it, function group anatomy (declarations + handlers +
      factory pattern), context window lifecycle (including future compaction),
      suspend/resume/pause mechanics.
  - [x] Gaps section — code changes needed to match `index.md`.
- [x] `docs/scheduler.md` — Task lifecycle states, dependency promotion,
      coordination routing, cycle waves, context delivery (three paths:
      mid-stream, immediate, buffered), `SubagentScope` and the task hierarchy
      (unbounded nesting depth by design).
  - [x] Gaps section — code changes needed to match `index.md`.
- [x] `docs/hivetool.md` — The built-in hive inspector: what it shows, how to
      extend it. Distinct from the web shell — hivetool is part of the
      framework; the web shell is an application built on bees.
  - [x] Gaps section — code changes needed to match `index.md`.

---

## Phase 3: Design Patterns & Mental Models

🎯 **Objective**: A template author understands not just the syntax, but the
_design reasoning_ behind agent composition — the load-bearing mental models
that are currently unwritten.

Mechanical extension tasks (adding a function group, writing a skill) are
inferable from existing code. What's missing is the design knowledge: the
grammar of capability composition, the delegation patterns, the coordination
model, the context flow. This phase surfaces that knowledge.

### Step 1: Stability map (`docs/flux.md`)

Before surfacing design patterns, establish what's solid and what's moving.
For each major subsystem, classify as **solid** (stable API, think before
changing), **settling** (works but patterns still forming), or **fluid**
(actively changing, expect breakage). Sources: the Gaps sections in
`session.md` and `scheduler.md`, plus architect input.

- [x] Write `docs/flux.md` — the stability map.

### Step 2: Interview

Structured conversation to discern the architect's unwritten mental models.
Candidate topics (to be refined during the interview):

- **What failed** — approaches tried and abandoned, and why. The code shows what
  survived, not what didn't. Dead ends are design knowledge.
- **What makes a good agent** — what separates a template that works well from
  one that doesn't? What are the antipatterns? Quality heuristics can't be
  inferred from framework code.
- **The economics of delegation** — when should an agent do the work itself vs.
  delegate? The framework supports both but doesn't encode the judgment.
- **Context budget** — how to think about what goes in an objective vs. a skill
  vs. what the agent discovers on its own. The template schema supports all
  three, but the reasoning about when to use which is unwritten.
- **The consumption API shape** — `flux.md` establishes it's fluid, but what's
  the shape you're reaching toward? What should the boundary between bees and
  its applications look like?
- **The hive as a product concept** — why a directory on disk? Why not a
  database, or an API? What's the design philosophy, and where does it break
  down?

### Step 3: Write `docs/patterns.md`

Distill the interview into a design guide. Not a YAML reference (that's
`template_schema.md`), but the reasoning that precedes the YAML.

- [x] Conduct interview — surface and name the mental models.
- [x] Write `docs/patterns.md` — the design guide.
- [x] Absorb `docs/template_schema.md` content (field reference, interpolation,
      globs) as an appendix or companion reference card.
- [x] Delete `hive/playbooks/GUIDE.md` — the old guide is fully superseded.

---

## Phase 4: Future Direction

🎯 **Objective**: A contributor understands where the framework is heading and
why — the forward arrow that `architecture.md` doesn't cover.

`architecture.md` captures the vision of how bees works today. This phase
documents where it's going: planned capabilities, known limitations with
intended solutions, and the trajectory of the framework's evolution. Authored
collaboratively.


- [ ] `docs/future.md` — planned changes, intended direction, and the reasoning
      behind upcoming architectural decisions. Key topics:
  - Context window compaction — the session layer's future responsibility.
  - Event dispatch redesign — replacing coordination tickets.
  - Bees as an installable library — extracting server + web shell.
  - The naming migration (ticket → task, playbook → template).

---

## Resolved Questions

1. **Context window compaction** — Mention as a future agent loop concern. Don't
   document the approach yet; document that this is the layer's job.
2. **Task hierarchy depth** — Unbounded by design.
3. **Function inventory** — `opal_backend` provides the full set of functions.
   Bees adds its own function groups (`tasks.*`, `events.*`, etc.) and template
   authors filter the combined inventory using `functions` and `allowed-tools`
   directives. Functions like `generate.text` are opal_backend built-ins that
   bees passes through.
4. **Hivetool vs. web shell** — Intentionally distinct. Hivetool is the built-in
   hive inspector (ships with bees, always available). The web shell is a
   reference application built on top of bees. Future direction: bees becomes an
   installable library; authors build their own surfaces. The server + web shell
   will be extracted from the framework.
5. **Extension guides are inferable** — Mechanical tasks (adding a function
   group, writing a skill, adding a template field) are learnable from existing
   code. The docs should focus on the design reasoning that precedes
   implementation, not the implementation recipe.

