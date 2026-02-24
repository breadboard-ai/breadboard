# Daily Dig — Hall of Fame

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

### 3. The Phantom Polyfill

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Date**     | Feb 24, 2026                                                                                                       |
| **Area**     | Multiple files across `visual-editor`                                                                              |
| **Artifact** | [`deja-code-prefer-can-parse.js`](packages/visual-editor/eslint-rules/deja-code-prefer-can-parse.js) (ESLint rule) |

Stale `URL.canParse` polyfill patterns —
`if ("canParse" in URL) { ... } else { try { new URL(url) } catch { ... } }` —
lingered across the codebase long after all target browsers shipped native
support. The guard (including string-concat obfuscation variants) was dead code
adding complexity for zero value. Paved with a Déjà Code ESLint rule that
detects the multi-statement polyfill guard and points developers to use
`URL.canParse()` directly.
