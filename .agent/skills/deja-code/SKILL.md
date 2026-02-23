---
name: deja-code
description:
  A system that detects when you're writing code that already exists as a shared
  utility. Instead of relying on memory or discipline, ESLint rules surface
  existing helpers in real-time through IDE errors.
---

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

## How it works

1. **Detect** — ESLint rules in `eslint-rules/deja-code-*.js` match structural
   AST patterns that correspond to known utilities.
2. **Surface** — The IDE shows an error with a message like: _"Déjà Code: this
   pattern is already implemented as `groupBy()` — see
   packages/utils/src/collections.ts"_
3. **Grow** — When the agent (or a human) extracts a new utility from a desire
   path, a corresponding ESLint rule is written. The catalog grows organically.

## Paved Desire Paths

| Pattern                                 | Rule                                     | Utility                            |
| --------------------------------------- | ---------------------------------------- | ---------------------------------- |
| Group items by key into `Map<K, V[]>`   | `deja-code-prefer-group-by`              | `utils/group-by.ts`                |
| Summarize LLM content to preview string | `deja-code-prefer-summarize-llm-content` | `utils/summarize-llm-content.ts`   |
| Inline error unwrap + message extract   | `deja-code-prefer-format-error`          | `utils/formatting/format-error.ts` |
