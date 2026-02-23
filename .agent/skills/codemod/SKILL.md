---
name: codemod
description:
  Mechanical, multi-file, type-aware refactors powered by ts-morph. Use when a
  pattern repeats across many files and regex is too fragile.
---

# 🔧 Codemods

Mechanical, multi-file, type-aware refactors powered by
[`ts-morph`](https://ts-morph.com/). Use when a pattern repeats across many
files and regex is too fragile.

## When to use

| Situation                      | Approach                      |
| ------------------------------ | ----------------------------- |
| < 5 files, simple rename       | Find-and-replace or manual    |
| 5–20 files, structural pattern | Codemod                       |
| Cross-package type migration   | Codemod + build verification  |
| One-off exploratory refactor   | Codemod in dry-run as a scout |

## How to run

```bash
# Dry run (default) — reports what would change without writing:
npx tsx codemods/run.ts <transform-name>

# Apply for real:
npx tsx codemods/run.ts <transform-name> --apply
```

Always dry-run first to scout the pattern before committing to a rewrite shape.

## Writing a transform

Create `codemods/transforms/<name>.ts` exporting three things:

```ts
import type { SourceFile } from "ts-morph";

/** Human-readable summary shown by the runner. */
export const description = "Short summary of what this does";

/** Glob patterns relative to repo root. */
export const include = ["packages/visual-editor/src/**/*.ts"];

/**
 * Called once per matched file. Mutate `file` in place via ts-morph's API.
 * Return `true` if changes were made, `false` otherwise.
 */
export function transform(file: SourceFile): boolean {
  // ... your transform logic
  return changed;
}
```

The runner (`codemods/run.ts`) handles Project creation, file matching, dry-run
reporting, and saving — transforms only need to focus on the AST logic.

## Best practices

- **Scout first** — Start with a detection-only transform (return `false`
  always) to find and count all instances before deciding on the rewrite shape.
- **Bottom-up node replacement** — When replacing multiple nodes in the same
  file, process them in reverse order to avoid position shifts invalidating
  later references.
- **Capture before replace** — Any data you need from a node (line number, text)
  must be captured _before_ calling `replaceWithText`, which invalidates the
  node reference.
- **Verify the build** — After applying, always run `tsc --noEmit` and the
  relevant test suite. Codemods can introduce type errors in consumers.

## Existing transforms

| Transform     | Description                                                                          |
| ------------- | ------------------------------------------------------------------------------------ |
| `unseen-cast` | Rewrites unsafe `(evt as StateEvent<T>).detail` casts in actions to typed parameters |
