---
name: deja-code
description:
  A system that detects when you're writing code that already exists as a shared
  utility. Instead of relying on memory or discipline, ESLint rules surface
  existing helpers in real-time through IDE errors.
---

// turbo-all

# 🔄 Déjà Code

A system that detects when you're writing code that already exists as a shared
utility. Instead of relying on memory or discipline, ESLint rules surface
existing helpers in real-time through IDE errors.

## Philosophy

- **Complexity threshold.** Only flag multi-statement patterns where extraction
  genuinely reduces complexity. One-liners are never flagged — that's noise, not
  help.
- **Error, not warning.** If we lint it, we error. Warnings train people to
  ignore lint output.
- **Point, don't block.** The error message always names the existing utility
  and its file path. The fix is obvious.

## How to Pave a New Path

1. **Identify candidates.** Grep for structural patterns that appear 3+ times:
   - `Map.set(key, [])` + `Map.get(key)!.push(value)` (groupBy)
   - `new Map<K, V[]>()` + population loops (adjacency lists)
   - `Array.filter` with the same predicate shape in multiple files
   - Any multi-statement sequence that looks like a utility wanting to exist

2. **Assess complexity.** Only proceed if the pattern is genuinely
   multi-statement. One-liners are not desire paths — they're just code. The
   bar: if extracting it wouldn't meaningfully reduce cognitive load, skip it.

3. **Check for existing utilities.** Search `packages/utils/src/` and
   `packages/visual-editor/src/utils/` for an existing helper. If one exists,
   skip to step 5 (write the rule, point to the helper).

4. **Extract the utility** (if none exists). Create or extend a file in the
   appropriate utils package. Follow existing export conventions. Add tests.

5. **Write the ESLint rule.** Create
   `packages/visual-editor/eslint-rules/deja-code-<name>.js` following the
   existing rule format (see `prefer-bind-destructure.js` for the template). The
   rule must:
   - Match the multi-statement AST pattern structurally
   - Report with severity `error`
   - Include a clear message naming the utility and its path
   - Prefix the rule name with `deja-code-`

6. **Register the rule.** In `eslint.config.js`:
   - Import the new module
   - Add to `localRulesPlugin.rules`
   - Enable as `"error"` in the visual-editor src config block

7. **Update the catalog.** Add an entry to the Paved Desire Paths table below.

8. **Verify.** Run `npx eslint <affected-files>` and confirm the rule fires.

## How it works

1. **Detect** — ESLint rules in `eslint-rules/deja-code-*.js` match structural
   AST patterns that correspond to known utilities.
2. **Surface** — The IDE shows an error with a message like: _"Déjà Code: this
   pattern is already implemented as `groupBy()` — see
   packages/utils/src/collections.ts"_
3. **Grow** — When the agent (or a human) extracts a new utility from a desire
   path, a corresponding ESLint rule is written. The catalog grows organically.

## Paved Desire Paths

See [`.agent/deja-code.md`](../../deja-code.md) — kept separate so this skill
file stays lean in context.
