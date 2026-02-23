---
trigger: always_on
---

## Build System

Monorepo using wireit. `package.json` commands invoke the full build system.
`npm run build` / `npm run build:tsc` builds all deps then compiles.
`npm run test` builds deps then runs tests.

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

## Tests

Use Node's built-in test framework (`node:test`). Tests run in Node, not a
browser. If the code under test references DOM globals (`document`, `window`,
etc.), call `setDOM()` from `tests/fake-dom.ts` in `beforeEach` and `unsetDOM()`
in `afterEach` to ensure a clean environment between tests. Modules must never
access DOM globals at the module level (e.g., top-level
`document.createElement`) — defer all DOM access to function bodies so the
module can be imported safely in Node. Name tests as `[source-file].test.ts` in
`packages/[package]/tests/`. In `packages/visual-editor`, mirror `src/sca/`
structure under `tests/sca/`.

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

The Daily Dig (`/daily-dig`) is a proactive bug hunt. Check the last entry date
in `.agent/daily-dig.md` — if it's been more than a couple of days, suggest
running one at the start of the session. Each dig should produce a concrete
artifact (test, lint rule, or codemod) for any finding.
