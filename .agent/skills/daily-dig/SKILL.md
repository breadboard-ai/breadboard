---
name: daily-dig
description:
  A proactive bug hunt across the Breadboard codebase. Pick an area, go looking,
  and produce a concrete artifact (test, lint rule, or codemod) for anything you
  find.
---

# 🔍 Daily Dig

A proactive bug hunt across the Breadboard codebase. Pick an area, go looking,
and produce a concrete artifact (test, lint rule, or codemod) for anything you
find.

## How it works

1. **Scout** — pick a hunting ground (recent changes, complex modules, untested
   corners).
2. **Catch** — when you find something, name it. Named bugs are memorable bugs.
3. **Tag** — write a test, lint rule, or codemod that documents the finding.
4. **Log** — add a short entry to the Hall of Fame below.

---

## Hall of Fame

### 1. The Silent Stacking

|              |                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------- |
| **Date**     | Feb 23, 2026                                                                              |
| **Area**     | [`layout-graph.ts`](../packages/visual-editor/src/a2/agent/graph-editing/layout-graph.ts) |
| **Artifact** | [`layout-graph.test.ts`](../packages/visual-editor/tests/a2/layout-graph.test.ts)         |

`computePositions` uses Kahn's algorithm, which silently skips nodes in cycles —
their children's depths never propagate, causing them to pile up at `x=0`. The
graph-editing agent bypasses `willCreateCycle()` via raw `EditSpec[]`, so
agent-created cycles hit this path. Our initial hypothesis was wrong too: depth
relaxation partially works for direct children, making the bug subtler than
expected.

### 2. The Unseen Cast

|              |                                                                               |
| ------------ | ----------------------------------------------------------------------------- |
| **Date**     | Feb 23, 2026                                                                  |
| **Area**     | [`sca/actions/`](../packages/visual-editor/src/sca/actions/)                  |
| **Artifact** | [`codemods/transforms/unseen-cast.ts`](../codemods/transforms/unseen-cast.ts) |

26 event-triggered actions cast `evt` to `StateEvent<T>` or `CustomEvent` with
zero runtime safety. If trigger wiring is wrong, `.detail` silently returns
`undefined`. Used as the proving candidate for the `ts-morph` codemod
infrastructure spike.
