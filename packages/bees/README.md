# Bees

Agent swarm orchestration framework. Uses the opal-backend agent loop to run
sessions, coordinated by a scheduler that manages tasks as a tree.

For the full documentation, see [docs/README.md](docs/README.md).

## Setup

```bash
npm run setup -w packages/bees
```

This creates a `.venv` and installs opal-backend (with its local deps) plus
bees.

## Configuration

Create a `.env` file in `packages/bees/`:

```
GEMINI_KEY=your-gemini-api-key
BEES_HIVE_DIR=hive
```

`BEES_HIVE_DIR` controls the hive directory where bees stores configuration and
runtime state (templates, skills, tasks, logs). Defaults to `hive`.

## Running

### Server

```bash
npm run dev:server -w packages/bees
```

Starts the FastAPI server on port 3200. The server boots the scheduler, recovers
any stuck tasks, and begins draining. The web shell is served alongside it.

See [docs/reference-app.md](docs/reference-app.md) for the full server and web
shell documentation.

### Single session (CLI)

```bash
npm run session:start -w packages/bees -- "Your prompt here"
```

Events stream to stderr. The final result prints as JSON to stdout.

### Tickets (CLI)

```bash
# Create tickets
npm run ticket:add -w packages/bees -- "Tell me a joke"

# Drain the queue (run all available tickets)
npm run ticket:drain -w packages/bees
```

Each ticket becomes a directory under `hive/tickets/{uuid}/` containing
`objective.md` and `metadata.json`.

## Output

Session log files land in `hive/logs/` in the eval viewer's `EvalFileData`
format (`bees-session-{date}.log.json`).
