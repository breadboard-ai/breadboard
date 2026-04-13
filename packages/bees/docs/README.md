# Bees Documentation

## Start here

- [architecture.md](architecture.md) — The two-layer model (Session →
  Scheduler), function groups, task trees, scoped filesystems, and the hive
  directory. The primary reference for how bees is built.

## Layer deep dives

- [session.md](session.md) — The session layer in detail: agent loop, context
  window, suspend/resume, function groups, and how opal_backend is wrapped.
- [scheduler.md](scheduler.md) — The scheduler layer in detail: task lifecycle,
  cycle mechanics, event delivery, and template resolution.

## The reference application

- [reference-app.md](reference-app.md) — How the bundled server and web shell
  consume the bees framework. Traces the MVC pattern from architecture through
  REST endpoints, SSE wiring, and the Lit frontend.

## Tooling

- [hivetool.md](hivetool.md) — The built-in developer workbench for inspecting
  and editing hive configuration.

## Design knowledge

- [patterns.md](patterns.md) — Design patterns and mental models: the three
  levers, delegation economics, context philosophy, the consumption model, and
  the template schema reference (appendix).
- [flux.md](flux.md) — Stability map classifying each subsystem as solid,
  settling, or fluid.
- [interview-log.md](interview-log.md) — Raw architect insights captured during
  the Phase 3 design interview. Primary source material for patterns.md.

## Forward arrow

- [future.md](future.md) — Short- to medium-term work: the consumption API,
  hive abstraction, multi-hive support, event delivery, and naming migration.
