---
trigger: always_on
---

## Build System

Monorepo using wireit. `npm run build` / `npm run build:tsc` builds all deps
then compiles. `npm run test` builds deps then runs tests.

When making changes, check if the user has `npm run build --watch` running. If
not, prompt them to start one. Use its output to verify compilation instead of
running separate `tsc --noEmit` commands.

## Packages

- `packages/types` — cross-package type definitions only (avoids circular refs).
- `packages/utils` — shared helpers. Check here before writing new utilities.
- `packages/visual-editor` — the frontend (Lit + Signals).
- `packages/unified-server` — the Node.js backend.

## SCA Architecture

The frontend uses **Services, Controllers, Actions** (SCA). All new frontend
logic must follow this pattern. Read `packages/visual-editor/src/sca/README.md`
for the full reference.

- **Services** — stateless infrastructure (APIs, file system). No UI state.
- **Controllers** — signal-backed reactive state (`@field` decorator).
  Hierarchical (`app.editor.graph`, `app.global.flags`).
- **Actions** — cross-cutting orchestration via `asAction`. Appropriate when
  logic touches Services AND Controllers, or multiple subcontrollers.
  Single-controller logic belongs on the Controller itself.
- **Triggers** — reactive bridge (`signalTrigger`, `eventTrigger`,
  `keyboardTrigger`). Defined in companion `triggers.ts` files.

### SCA as Single Context

UI components access the entire SCA singleton via Lit Context (`scaContext`).
Consume with `@consume({ context: scaContext })` on `SignalWatcher(LitElement)`.
Never prop-drill individual controllers or services.

### Canonical Imports

Import shared types and constants from `sca/types.ts` and `sca/constants.ts`,
not from UI-specific locations. Cross-package types go in `packages/types`.

### Action Conventions

- Wrap business logic in `asAction` for coordination visibility.
- Access deps via the module-level `bind` object, never as function params.
- Return `Outcome<T>` (`ok(value)` / `err("message")`). Use fail-early guards.
- Actions must never import other action modules. Cross-domain coordination uses
  Triggers (Triggered Delegation pattern).
- One trigger per action. Consolidate multi-signal conditions into one trigger.

### Trigger Conventions

- **Version + 1** pattern to avoid the Sticky Trigger Hazard:
  `return controller.editor.graph.version + 1;`
- For presence-based triggers, the action must clear the signal as its final
  step.
- Wrap `triggeredBy` in a factory function for lazy evaluation and SSR safety.

### UI Components

UI elements should be thin rendering shells. Push state and business logic into
SCA Controllers and Actions — elements should only hold DOM-intrinsic state
(scroll position, focus, animation frames). Read application state from
Controllers via signals; dispatch mutations through Actions.

When working in an element that encodes business state locally (e.g., tracking
run status, managing lists, or holding derived data in the component itself),
gently encourage a refactor to move that state into a Controller and the logic
into an Action. This makes the behavior testable without the DOM.

## Signals

The repo uses `signal-polyfill` and `signal-utils` as its signal infrastructure.

## Decision Making

Follow established principles over cautious defaults. This codebase has PRs,
code review, and a rollback strategy. When an established principle (e.g.,
"error, not warning") conflicts with a cautious instinct (e.g., "this might
break the build"), follow the principle and find a compatible solution — don't
silently downgrade the principle. If there's a genuine reason to deviate,
surface the tension explicitly rather than making the choice unilaterally.

When applying a principle, trace its implications across every place it
manifests — config files, rule metadata, runtime defaults, documentation. Don't
stop at the first fix.

## Inclusive Language

All human-readable text — JSDoc, README files, PR summaries, code comments, and
error messages — must use inclusive, people-first, bias-free language. If you
spot non-inclusive language while editing a file, fix it as part of the change.

## Coding Conventions

Use ES Module syntax. Define exports explicitly at the top of the file, right
below imports:

```ts
import { foo } from "./foo";
export { bar, baz };
function bar() {
  /* ... */
}
function baz() {
  /* ... */
}
```

## Refactoring Patterns

- **Interface removal as discovery**: delete from the interface, build, then fix
  all consumers the compiler surfaces.
- **Flags**: defined in `packages/types/src/flags.ts` (type + metadata),
  `FlagController` (frontend), and `unified-server/src/flags.ts` (backend). When
  adding/removing a flag, update all three locations plus tests.

## Codemods

For mechanical, multi-file, type-aware refactors, use `ts-morph` codemods in the
`codemods/` directory at the repo root. See `codemods/README.md` for the full
reference.

```bash
# Dry run (reports what would change):
npx tsx codemods/run.ts <transform-name>

# Apply changes:
npx tsx codemods/run.ts <transform-name> --apply
```

Write each transform in `codemods/transforms/<name>.ts`, exporting
`description`, `include` (globs), and `transform(file): boolean`. Prefer
dry-run-first to scout the pattern before committing to a rewrite shape.

## Codebase Practices

The `.agent/` directory contains practices, workflows, and skills. Read
`.agent/README.md` for the full index. Each practice has a corresponding skill
in `.agent/skills/` with detailed instructions.

- **Daily Dig** (`/daily-dig`) — proactive bug hunts. Scout an area, find bugs,
  name them, write tests.
- **Déjà Code** (`/deja-code`) — detect repeated multi-statement patterns and
  pave them with shared utilities + ESLint rules that error when the inline
  pattern reappears. ESLint rules are prefixed `deja-code-*` in
  `packages/visual-editor/eslint-rules/`.

## Tests

Use Node's built-in test framework (`node:test`). Tests run in Node, not a
browser. Name tests as `[source-file].test.ts` in `packages/[package]/tests/`.
In `packages/visual-editor`, mirror `src/sca/` structure under `tests/sca/`.

For DOM globals (`document`, `window`, etc.): call `setDOM()` from
`tests/fake-dom.ts` in `beforeEach` and `unsetDOM()` in `afterEach`. Never
access DOM globals at the module level — defer to function bodies so modules
import safely in Node.

### Mocking

Always use `mock.method` from `node:test`. Never directly overwrite properties
on globals. Call `mock.restoreAll()` in `afterEach`. See
`.agent/workflows/testing-conventions.md` for details.

### SCA Action Tests

- Bind action modules to mock controller/services via `Module.bind(...)`.
- When actions call other modules, bind ALL participating modules.
- Reset `coordination.reset()` in `beforeEach` to prevent cross-test deadlocks.
- Use `createMockEditor` from `tests/sca/helpers/mock-controller.ts` — avoid
  inline mocks.
- Capture transforms via `onApply` callback; return `{ success: true }`.
- Test all fail-early guards with partial/null bindings.

### Signal / Async Tests

If the code under test contains signals, use the `signal-watcher.ts` helper. For
async signal derivations, use the "Settled and Wait" pattern:
`await store.isSettled` then `await new Promise(r => setTimeout(r, 50))`.

Use `npm run test:file` to run subsets:

```bash
npm run test:file -- './dist/tsc/tests/sca/actions/share/**/*.js'
```

## Daily Dig

The Daily Dig (`/daily-dig`) is a proactive bug hunt. Check the Hall of Fame in
`.agent/skills/daily-dig/SKILL.md` — if it's been more than a couple of days
since the last entry, suggest running one at the start of the session. Each dig
should produce a concrete artifact (test, lint rule, or codemod) for any
finding.

## Python

The developer environment uses corporate mirror for package repositories. When
unable to install packages, remind the user to run `gcert` to enable access to
the mirror.
