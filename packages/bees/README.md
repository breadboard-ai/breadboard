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

## Running a Session

```bash
npm run session:start -w packages/bees -- "Your prompt here"
```

Events stream to stderr with live emoji summaries. The final result
prints as JSON to stdout.

Output files land in `packages/bees/out/` in the eval viewer's
`EvalFileData` format (`bees-session-{date}.log.json`), loadable
directly by `packages/visual-editor/eval/viewer`.
