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

## Output

All session log files land in `packages/bees/out/` in the eval viewer's
`EvalFileData` format (`bees-session-{date}.log.json`), loadable
directly by `packages/visual-editor/eval/viewer`.
