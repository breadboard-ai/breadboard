---
description: Proactive daily bug hunt — scout, catch, tag, and log
---

# Daily Dig

A proactive bug hunt. Pick an area, go looking, and produce a concrete artifact
for anything you find.

## Steps

1. **Scout** — Choose a hunting ground. Good options:
   - Recently changed files (`git log --oneline -20 -- <path>`)
   - Complex modules with low test coverage
   - `TODO`, `FIXME`, `HACK`, `WORKAROUND` comments
   - Error handling patterns (`catch` blocks, `as any` casts)
   - Event listener add/remove symmetry
   - Async race conditions

// turbo 2. **Hunt** — Search for bugs, quirks, or gaps using grep, code
reading, and pattern analysis. Look for:

- Silent failures (errors swallowed, missing null checks)
- Algorithm edge cases (empty inputs, cycles, overflow)
- Missing cleanup (listeners, timers, subscriptions)
- Bypassed guards (code paths that skip validation)

3. **Catch** — When you find something, name it. Good names are memorable and
   descriptive (e.g., "The Silent Stacking", "The Phantom Caret").

4. **Tag** — Write a concrete artifact:
   - **Test** (preferred) — documents the bug and prevents regression
   - **Lint rule** — prevents the pattern from recurring
   - **Convention test** — enforces architectural invariants
   - **Codemod** — fixes all instances of a pattern

// turbo 5. **Log** — Add a short entry to `.agent/daily-dig.md` in the Hall of
Fame. Keep entries to 2–3 sentences max.

// turbo 6. **Verify** — Run the test to confirm it passes (for BUG-prefixed
tests, assert the current broken behavior so it passes now but documents what's
wrong).
