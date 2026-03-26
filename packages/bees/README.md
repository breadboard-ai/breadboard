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
```

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

Each ticket becomes a directory under `tickets/{uuid}/` containing
`objective.md` and `metadata.json`.

### Draining the Queue

```bash
npm run ticket:drain -w packages/bees
```

Runs all available tickets in parallel, streaming events to stderr.
Each ticket's metadata is updated with status, turn count, thoughts,
outcome or error. Results print as JSON to stdout.

## Playbooks

Playbooks are ticket templates — YAML files that describe a DAG of
work. Each step becomes a ticket. Dependencies between steps are
expressed as `{{step-name}}` references in objectives.

### Playbook Format

```yaml
name: orchestrator
title: Orchestrator
description: Chat with the user and dispatch playbooks as needed

steps:
  main:
    title: Orchestrator
    objective: >
      You are Opie, a helpful conversational assistant.
    skills: [interview-user]
    functions: ["chat.*", "orchestrator.*"]
```

Step properties: `title`, `objective`, `functions`, `skills`, `tags`,
`assignee`. Dependencies are inferred from `{{step-name}}` references
in `objective`.

Each ticket is stamped with `playbook_id` (the playbook name) and
`playbook_run_id` (a UUID for the run) for traceability.

### Running a Playbook

```bash
npm run playbook:run -w packages/bees -- orchestrator
```

This creates tickets for each step and prints a summary. Then use
`ticket:drain` to execute them.

## Output

All session log files land in `packages/bees/out/` in the eval viewer's
`EvalFileData` format (`bees-session-{date}.log.json`), loadable
directly by `packages/visual-editor/eval/viewer`.
