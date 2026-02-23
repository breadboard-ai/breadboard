---
description: Find desire paths in the codebase and pave them with ESLint rules
---

// turbo-all

# Déjà Code — Pave a Desire Path

Scan the codebase for repeated multi-statement patterns, extract utilities where
needed, and write ESLint rules that prevent future inline reimplementations.

## Steps

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

7. **Update the catalog.** Add an entry to `.agent/deja-code.md` in the "Paved
   Desire Paths" table.

8. **Verify.** Run `npx eslint <affected-files>` and confirm the rule fires.
