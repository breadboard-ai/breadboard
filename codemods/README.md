# Codemods

Repo-wide AST transforms powered by [`ts-morph`](https://ts-morph.com/).

Use a codemod when a refactor is **mechanical, multi-file, and type-aware** —
the kind of change where regex is fragile and manual edits are error-prone.

## Quick start

```bash
# Dry run (default) — reports what would change without writing:
npx tsx codemods/run.ts <transform-name>

# Apply for real:
npx tsx codemods/run.ts <transform-name> --apply
```

## Writing a transform

Create a file in `codemods/transforms/<name>.ts` that exports:

```ts
import type { SourceFile } from "ts-morph";

export const description = "Short human-readable summary";

/** Glob patterns relative to repo root. */
export const include = ["packages/visual-editor/src/sca/actions/**/*.ts"];

/**
 * Called once per matched file. Mutate `file` in place using ts-morph's API.
 * Return `true` if changes were made.
 */
export function transform(file: SourceFile): boolean {
  // ... your transform logic
  return changed;
}
```

The runner handles Project creation, file matching, dry-run reporting, and
saving.

## When to use

| Situation                      | Approach                      |
| ------------------------------ | ----------------------------- |
| < 5 files, simple rename       | Find-and-replace or manual    |
| 5–20 files, structural pattern | Codemod                       |
| Cross-package type migration   | Codemod + build verification  |
| One-off exploratory refactor   | Codemod in dry-run as a scout |
