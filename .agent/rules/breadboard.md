---
trigger: always_on
---

## Build system

This is a monorepo that uses wireit as a build system. This means that the
commands in `package.json` files are typically wireit commands that invoke the
full build system to first ensure that all dependencies are satisfied. For
example:

- `npm run build` or `npm run build:tsc` builds all monorepo dependencies and
  then runs tsc to compile the target.
- `npm run test` first invokes build (or `build:tsc`) for all dependencies, then
  runs testing.

## Packages

These are some significant packages:

- `packages/types` -- contains only type definitons. This is package is designed
  to allow defining types that are used across the package to avoid circular
  references. Any time you need to add a cross-package type, add it here.

- `packages/utils` -- contains commonly used functions and classes. If you're
  looking to implement a helper function, first look in `packages/utils` to see
  if it might be already present there.

- `packages/breadboard`, `packages/runtime`, `packages/data`, `packages/loader`
  -- contain the core runtime engine for the project and all the data
  transformation/processing code.

- `packages/visual-editor` -- contains the majority of the frontend code for the project.

- `unified-server` -- contains the nodejs server, the backend of the project.

## Signals

The repo is using `signal-polyfil` and `signal-utils` as its signal infrastructure.

## Coding Conventions

### Exports

Use ES Module syntax for imports/exports.

Define exports explicitly at the top of the file, right below the imports.

```ts
import { foo } from "./foo";
// ... more imports

export { bar, baz };

function bar() {
  // function impl.
}

function baz() {
  // function impl.
}

// not exported
function quz() {
  // function impl.
}
```

## Tests

To write tests, use node's built-in test framework. Use the `npm run test` command within the package to run tests.

Name tests as `[name of tested file].test.ts` and place it into
`packages/[package name]/tests/` directory. All packages are configured to pick
up that file with `npm run test`.

If you're writing a test in `packages/visual-editor/tests` and the code-to-be-tested
contains signals, use the `packages/visual-editor/tests/signal-watcher.ts` helper
for easy reactivity testing.

In `packages/visual-editor/package.json`, there's an `npm run test:only` command that enables the `--test-only` flag. Use it to narrow the scope of tests.