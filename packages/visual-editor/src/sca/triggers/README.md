# Triggers Layer

> **Reactive side effects** — Automatic actions that respond to state changes.

Triggers are effect-based listeners that react when controller signals change. Think of them as "automatic Actions" that fire without user interaction.

---

## What Triggers Do

Triggers watch signals and perform side effects when they change:

| Trigger | Watches | Side Effect |
|---------|---------|-------------|
| `SaveTrigger` | `editor.graph.isDirty` | Auto-saves the graph |
| `AutonameTrigger` | `editor.graph.lastNodeConfigChange` | Generates AI names for nodes |

---

## How Triggers Work

### The Trigger Binder

Similar to Actions, Triggers use dependency injection via `makeTrigger()`:

```typescript
import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

export function registerAutonameTrigger() {
  bind.register("Autoname Trigger", async () => {
    const { controller, services } = bind;

    // Read the signal — this registers the dependency
    const change = controller.editor.graph.lastNodeConfigChange;
    if (!change) return;

    // Do the side effect
    await services.autonamer.autoname(change);
  });
}
```

### Reactive Effect Registration

Triggers use `reactive()` from `sca/reactive.ts` under the hood. This is a custom
implementation that avoids bugs in `signal-utils/subtle/microtask-effect`.

When you call `bind.register()`:

1. The callback is wrapped in `reactive()`
2. Any signals read during execution become dependencies
3. When dependencies change, the effect re-runs
4. **Important:** Initial execution is deferred to a microtask (see Testing section)

---

### Event Bridges

For native browser events (like `popstate`, `resize`, or media query changes), use `registerEventBridge()` for proper lifecycle management:

```typescript
bind.registerEventBridge("Router URL Change", window, "popstate", handler);
```

Event bridges are automatically cleaned up when `bind.clean()` is called.

---

## Trigger Lifecycle

### Registration

Triggers are registered after hydration completes:

```typescript
// In sca.ts
controller.isHydrated.then(() => {
  Triggers.triggers(controller, services, actions);
});
```

### Cleanup

Triggers can be cleaned up (useful for testing):

```typescript
import { clean, destroy } from "./triggers/triggers.js";

// Stop all trigger effects
clean();

// Full cleanup and reset
destroy();
```

### Listing

For debugging, you can list registered triggers:

```typescript
import { list } from "./triggers/triggers.js";

console.log(list());
// { board: ["[effect] Save Trigger", "[bridge] Save Status Bridge"], ... }
```

---

## Action vs Trigger: Decision Guide

| Scenario | Use |
|----------|-----|
| User clicks a button → do something | **Action** |
| Signal changes → do something automatically | **Trigger** |
| Show "Saving..." then "Saved!" | **Action** (lifecycle within one flow) |
| Detect new version available → show banner | **Trigger** (reactive to version signal) |
| Delete selection → update graph | **Action** (explicit user intent) |
| Graph marked dirty → auto-save | **Trigger** (background reactive) |

**Key distinction:**
- **Actions** are called imperatively by UI or other code
- **Triggers** run automatically when their watched signals change

---

## Creating a New Trigger

### 1. Add to a domain file

```typescript
// triggers/board/board-triggers.ts
import { makeTrigger } from "../binder.js";

export const bind = makeTrigger();

export function registerMyTrigger() {
  bind.register("My Trigger Name", () => {
    const { controller, services, actions } = bind;

    // Read signals to establish dependency
    const someValue = controller.some.signal;
    if (!someValue) return;

    // Perform side effect
    console.log("Signal changed:", someValue);
  });
}
```

### 2. Call register in triggers.ts

```typescript
// triggers/triggers.ts
export function register() {
  Board.registerSaveTrigger();
  Node.registerAutonameTrigger();
  Board.registerMyTrigger();  // Add your trigger
}
```

---

## Guard Conditions

Triggers often need guard conditions to avoid running unnecessarily:

```typescript
bind.register("Autoname Trigger", async () => {
  const { controller } = bind;
  const { lastNodeConfigChange, editor, readOnly } = controller.editor.graph;

  // Multiple guard conditions
  if (!lastNodeConfigChange) return;  // No change to process
  if (readOnly) return;                // Can't modify read-only graph
  if (!editor) return;                 // No active editor

  // Safe to proceed
  await doAutonaming(lastNodeConfigChange);
});
```

---

## Abort Handling

For async operations, handle aborts gracefully:

```typescript
bind.register("Long Running Trigger", async () => {
  const { controller } = bind;
  const input = controller.someInput;
  if (!input) return;

  const abortController = new AbortController();

  // Abort if graph changes during operation
  controller.editor.graph.editor?.addEventListener(
    "graphchange",
    () => abortController.abort(),
    { once: true }
  );

  try {
    await expensiveOperation(input, abortController.signal);
  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Trigger aborted due to graph change");
      return;
    }
    throw err;
  }
});
```

---

## Testing Triggers

Testing triggers requires understanding that `reactive()` **defers initial execution** to a microtask. This has several implications:

### Flush Effects Before Cleanup

Effects may still be pending when a test completes. Use `flushEffects()` in `afterEach`:

```typescript
import { flushEffects } from "./utils.js";

afterEach(async () => {
  await flushEffects(); // Wait for pending microtasks
  MyTriggers.bind.clean();
});
```

### Bind Dependencies Before Registering

If a trigger calls actions (e.g., `syncConsoleFromRunner`), those action binders must be set up **before** the trigger is registered. Even if your test doesn't use the actions, the deferred effect will access them:

```typescript
test("trigger registers without error", () => {
  RunTriggers.bind({ controller, services, actions: {} as AppActions });
  // Actions binder needed because trigger's deferred effect calls actions
  RunActions.bind({ controller, services });

  RunTriggers.registerGraphSyncTrigger();
});
```

### Testing Signal Changes

To observe trigger side effects from signal changes:

```typescript
test("trigger reacts to signal change", async () => {
  setupTrigger();
  await flushEffects(); // Initial deferred execution

  controller.some.signal = newValue;
  await flushEffects(); // Effect reacts to change

  assert.strictEqual(observed, expectedValue);
});
```

---

## Directory Structure

```
triggers/
├── triggers.ts         # AppTriggers interface, register(), clean()
├── binder.ts           # makeTrigger() with reactive() management
├── board/
│   └── board-triggers.ts   # Board-related triggers (save)
└── node/
    └── node-triggers.ts    # Node-related triggers (autoname)
```

