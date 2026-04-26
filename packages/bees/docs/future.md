# Future Direction

Short- to medium-term work needed to close gaps in the framework and bring about
the vision described in [architecture.md](./architecture.md).

## Zero-Dependency `bees`

**Goal:** `pip install bees` works with no transitive dependencies. The
framework owns orchestration and tools; model providers are pluggable packages
that bring their own auth and API clients.

The [library extraction](./library-extraction.md) decoupled bees from
`opal_backend` at the protocol level. What remains is the physical split — four
packages, four responsibilities:

| Package              | What it is                    | External deps                          |
| -------------------- | ----------------------------- | -------------------------------------- |
| **`bees`**           | Orchestration library + tools | None (stdlib only)                     |
| **`gemini-runners`** | Gemini model provider         | `google-genai`, `httpx`                |
| **`box`**            | Filesystem-driven CLI runner  | `bees`, `gemini-runners`, `watchfiles` |
| **`app`**            | Reference web application     | `bees`, `gemini-runners`, `fastapi`    |

See [package-split.md](./package-split.md) for the full design.

## The Consumption API

With the library extraction as the goal, two sub-problems need to crystallize.

### The Interaction Surface

The controller side of the MVC model (see
[patterns.md](./patterns.md#the-controller-in-progress)) is evolving. The
[mutations system](./mutations.md) provides an atomic interaction model for the
filesystem-based hive. The library API should make responding to suspended tasks
and creating task groups first-class operations on `Bees` or `TaskNode`.

### Hive Abstraction

The hive is currently hard-coded to the filesystem. The
[patterns.md](./patterns.md#the-directory-as-universal-interchange) vision
describes the hive directory as a "universal interchange." The task store needs
a protocol with at least two implementations:

- **Disk** — what exists today. The local development and hivetool story.
- **Database** — for production. Tasks persist in a database; the filesystem
  layer may be backed by object storage.

The configuration surface (templates, skills, system config) can remain
file-based — it's the task runtime state that needs to scale.

## Multi-Modal Sessions

A task currently maps to a single session type. But a conversational task
naturally switches modalities: the user pushes to talk (live session), then
types a follow-up (text session). The task is the same — the session mode
changes.

This implies a task can have **multiple sequential sessions** of different
types. The scheduler already handles suspend/resume across sessions, but the
concept of switching runner type mid-task is new. Key questions:

- **Session continuity.** When switching from live → text, does the text session
  inherit the live session's context? The live session produces a transcript via
  `chat_log.json` and `live_events/` — could these seed the text session's
  initial context?
- **Runner selection.** Currently `runner` is a static field on `TicketMetadata`
  set at task creation. Multi-modal tasks need the runner to be chosen per
  interaction — push-to-talk → `live`, text input → `generate`.
- **UI affordance.** The Talk button and text input already coexist in hivetool.
  The question is whether they target the same task or create separate sessions.

## Agent Artifacts

Agents need a common framework for presenting artifacts to the user — things the
agent creates and wants to display, not just text output in the chat log.

### What an agent can present

Not an exhaustive list, but a starting point:

- **Image** — generated or retrieved, displayed inline.
- **Markdown** — structured text with formatting (reports, summaries, plans).
- **Bundle** — a richer format, possibly HTML, for interactive or composed
  artifacts.

### Requirements

- **Declarative.** The agent signals "show this to the user" through a function
  call or file convention — not by encoding display logic.
- **Persistent.** Artifacts survive the session. The app can load the current
  set of artifacts for a task without replaying the session.
- **Addressable.** Each artifact has an identity so the agent can update or
  replace it.

### Open design space

This could be:

- **A function group** (`artifacts.*`) — `artifacts_present_image`,
  `artifacts_present_markdown`, etc. Explicit and discoverable, but adds
  functions to every agent's toolbox.
- **A convention conveyed through skills** — the skill instruction teaches the
  agent to write files to a known directory (`artifacts/`) with metadata. No
  special function group needed, but the convention is implicit.
- **A hybrid** — a thin function group for signaling intent, backed by files on
  disk for persistence.

The persistence requirement points toward the filesystem — artifacts as files in
the task directory, with a manifest that the app reads on load.

## Shared Directories

Templates could designate certain directories as shared across sibling agent
sessions. A task tree often has multiple agents that need to coordinate through
shared resources:

- **Shared components** — a design system or code library that multiple agents
  contribute to and consume.
- **Accumulated state** — a research corpus, a knowledge base, or a running log
  that grows across sessions.

### The stomping problem

Concurrent writers to the same files is a race condition. Possible mitigations:

- **Append-only** — shared directories are append-only. Each agent writes new
  files; no agent modifies another agent's files.
- **Lock-free partitioning** — each agent gets a subdirectory within the shared
  space. A merge step (manual or automated) reconciles.
- **Explicit coordination** — agents use `events_send_to_sibling` to negotiate
  writes. The shared directory is the _result_ of coordination, not the
  _mechanism_.

### Template surface

```yaml
- name: design-team
  shared_directories:
    - path: components/
      mode: append-only
    - path: design-tokens/
      mode: partitioned
```

Not sure yet whether this belongs in the template schema, the task tree
configuration, or the file system protocol.

## Further out

Speculative, ambitious, and less well-defined ideas live in
[tea-leaves.md](./tea-leaves.md).
