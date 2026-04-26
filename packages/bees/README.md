# Bees

Agent swarm orchestration framework. Manages tasks as a tree, with pluggable
session runners for different modalities (batch text, live voice).

For the full documentation, see [docs/README.md](docs/README.md).

## Setup

```bash
npm run setup -w packages/bees
```

This creates a `.venv` and installs dependencies (including `opal-backend` for
the batch runner).

## Configuration

Create a `.env` file in `packages/bees/`:

```
GEMINI_KEY=your-gemini-api-key
BEES_HIVE_DIR=hive
```

`BEES_HIVE_DIR` controls the hive directory where bees stores configuration and
runtime state (templates, skills, tasks, logs). Defaults to `hive`.

## Running

### Box (filesystem-driven)

```bash
npm run dev:box -w packages/bees
```

Watches the hive directory for changes and drives the scheduler through
filesystem events. Use with [hivetool](#hivetool) for a browser-based developer
workbench. See [docs/box.md](docs/box.md) for the full documentation.

### Hivetool

```bash
npm run dev:hivetool -w packages/bees
```

Browser-based developer workbench for inspecting and editing hive configuration,
templates, skills, and task state. Reads and writes hive files directly via the
File System Access API. See [docs/hivetool.md](docs/hivetool.md).

Also hosted at: https://breadboard-ai.github.io/breadboard/hivetool/

### Server (reference app)

```bash
npm run dev -w packages/bees
```

Starts the FastAPI server on port 3200 alongside the web shell. The server boots
the scheduler, recovers any stuck tasks, and begins draining. See
[docs/reference-app.md](docs/reference-app.md) for the full documentation.

## Output

Session log files land in `hive/logs/` as structured JSON
(`bees-{task-id}-{date}.log.json`). These can be inspected in hivetool's
Sessions tab.
