# Bees Documentation

## Start here

- [architecture.md](architecture.md) — The two-layer model (Session →
  Scheduler), function groups, task trees, scoped filesystems, and the hive
  directory. The primary reference for how bees is built.
- [api.md](api.md) — Reference for the `Bees` and `TaskNode` classes — the
  public consumption surface for applications.

## Layer deep dives

- [session.md](session.md) — The session layer in detail: agent loop, context
  window, suspend/resume, function groups, and how opal_backend is wrapped.
- [scheduler.md](scheduler.md) — The scheduler layer in detail: task lifecycle,
  cycle mechanics, event delivery, and template resolution.

## The reference application

- [reference-app.md](reference-app.md) — How the bundled server and web shell
  consume the bees framework. Traces the MVC pattern from architecture through
  REST endpoints, SSE wiring, and the Lit frontend.

## Configuration

- [system-config.md](system-config.md) — The `SYSTEM.yaml` reference: hive
  identity, root template, and MCP server registration (transports, env var
  expansion, runtime behavior).

## Guides

- [oauth-setup.md](oauth-setup.md) — Step-by-step: create a Google OAuth
  client, configure credentials, authenticate in hivetool, and connect
  Google Workspace MCP servers (Gmail, Drive, Calendar, etc.).

## Tooling

- [box.md](box.md) — The filesystem-driven orchestrator. Watches the hive for
  changes and drives the scheduler without an HTTP server.
- [mutations.md](mutations.md) — The mutation log: atomic filesystem commands
  for multi-step operations (reset, respond, batch task creation).
- [hivetool.md](hivetool.md) — The built-in developer workbench for inspecting
  and editing hive configuration.
- [eval.md](eval.md) — Batch evaluation framework: `Bees.run()`, eval sets,
  the `eval/` hive subdirectory, and the CLI.

## Design knowledge

- [patterns.md](patterns.md) — Design patterns and mental models: the three
  levers, delegation economics, context philosophy, the consumption model, and
  the template schema reference (appendix).
- [flux.md](flux.md) — Stability map classifying each subsystem as solid,
  settling, or fluid.
- [library-extraction.md](library-extraction.md) — Record of the completed
  library extraction: specs, migration phases, and remaining `opal_backend`
  imports.
- [interview-log.md](interview-log.md) — Raw architect insights captured during
  the Phase 3 design interview. Primary source material for patterns.md.

## Concept explorations

Design docs that traced the path to the current architecture. Each has been
realized (with divergences noted in their banners) and is kept as a historical
record.

- [delegated-sessions.md](delegated-sessions.md) — What if session execution is
  owned by the browser? Shipped as Project Acoustic.
- [delegated-sessions-2.md](delegated-sessions-2.md) — What if _all_ sessions
  are delegated? Led to the `SessionRunner` protocol.
- [package-split.md](package-split.md) — The delegated sessions insight as a
  packaging concern. Remaining step in the library extraction.

## Forward arrow

- [future.md](future.md) — What's next: the package split, consumption API,
  and hive abstraction.
