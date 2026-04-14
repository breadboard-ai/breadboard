# Actions Layer

> **Cross-cutting business logic** — Functions that orchestrate Services and Controllers.

Actions are the "verbs" of the application. They coordinate multi-step workflows that touch multiple services and controllers, and can be automatically triggered by reactive state changes.

---

## The Golden Rule

> **Action = Cross-Cutting Logic**

Actions are appropriate when logic is **cross-cutting**:

- **Services + Controllers**: Using services AND mutating controller state
- **Multiple Subcontrollers**: Accessing different parts of the controller tree
  (e.g., `controller.editor.graph` AND `controller.global.main`)

Actions are **NOT** appropriate when:

- Logic only touches **one subcontroller** → make it a Controller method
- Logic only uses **services** without state → consider if it belongs in the Service

---

## How Actions Work

### The `asAction` Pattern

Actions are defined using the `asAction` helper, which provides:
- **Coordination**: Automatic ordering with other actions
- **Triggers**: Reactive activation via `triggeredBy`
- **Priority**: Control activation order

```typescript
// In step-actions.ts
import { asAction, ActionMode } from "../../coordination.js";
import { onSelectionOrSidebarChange } from "./triggers.js";

export const bind = makeAction();

export const applyPendingEdits = asAction(
  "Step.applyPendingEdits",
  {
    mode: ActionMode.Immediate,
    priority: 100,  // Higher = activates first
    triggeredBy: () => onSelectionOrSidebarChange(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    // Action implementation...
  }
);
```

### One Trigger Per Action

**Each action supports exactly one trigger.** This is a deliberate constraint that enforces a clear 1:1 relationship between triggers and actions:

- ✅ **One signal trigger** watching one or more signals in its condition
- ✅ **One event trigger** listening for a specific event
- ❌ **Cannot mix** signal and event triggers on the same action

If you need to respond to multiple signals, consolidate them into a single signal trigger's condition:

```typescript
// Correct: One trigger watching multiple signals
export const myAction = asAction(
  "Domain.myAction",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => signalTrigger(
      "Selection or Sidebar Change",
      () => {
        const { controller } = bind;
        // Watch both signals - fires when either changes
        return !!(controller.editor.selection.node || controller.sidebar.active);
      }
    ),
  },
  async () => { /* ... */ }
);

// Incorrect: Can't have multiple triggers
// triggeredBy: [trigger1, trigger2]  // ← Not supported
```

### ActionMode

Actions declare their coordination behavior:

| Mode | Behavior |
|------|----------|
| `ActionMode.Immediate` | Runs without waiting — for trigger-activated actions, pure UI updates |
| `ActionMode.Awaits` | Waits for pending triggers — use from user events only |
| `ActionMode.Exclusive` | Like Awaits but also prevents concurrent exclusive actions |

### Priority

Actions with triggers can specify an activation `priority`:
- Higher values activate first
- Default is `0`
- Range: `-1000` to `1000` (clamped)

Use priority when one action must complete before another (e.g., apply pending edits before autosave):

```typescript
// High priority - runs first
export const applyPendingEdits = asAction(
  "Step.applyPendingEdits",
  { mode: ActionMode.Immediate, priority: 100, triggeredBy: () => onSelectionOrSidebarChange(bind) },
  async () => { /* ... */ }
);

// Default priority - runs after
export const save = asAction(
  "Board.save",
  { mode: ActionMode.Awaits, triggeredBy: () => onVersionChange(bind) },
  async () => { /* ... */ }
);
```

---

## Triggers

Triggers connect **reactive state changes** to **action execution**. They are defined in companion `triggers.ts` files alongside actions.

### Trigger Types

| Type | Creator | Fires When |
|------|---------|------------|
| Signal | `signalTrigger(name, condition)` | Condition returns truthy value (and changes) |
| Event | `eventTrigger(name, target, eventType)` | DOM/custom event fires |
| StateEvent | `stateEventTrigger(name, target, eventType)` | Specific `StateEvent` dispatched to the event bus |
| Keyboard | `keyboardTrigger(name, keys, guard?)` | Key combination pressed (e.g., `"Cmd+s"`, `"Delete"`) |

### Example: Signal Trigger

```typescript
// In triggers.ts
export function onVersionChange(bind: ActionBind): SignalTrigger {
  return signalTrigger(
    "Graph Version Change",
    () => {
      const { controller } = bind;
      // Returns true when action should fire
      // Condition is re-evaluated each time dependencies change
      return controller.editor.graph.version >= 0;
    }
  );
}
```

> **Note:** Signal trigger conditions must return `boolean`. The reactive system tracks which signals are read during execution, and the boolean controls whether the action fires on each change.

### Example: Event Trigger

```typescript
// In triggers.ts
export function onNarrowQueryChange(): EventTrigger | null {
  // Return null in SSR environments
  if (typeof window === "undefined") return null;

  const query = window.matchMedia("(max-width: 800px)");
  return eventTrigger("Narrow Query Change", query, "change");
}
```

### Using Triggers with Actions

```typescript
export const save = asAction(
  "Board.save",
  {
    mode: ActionMode.Awaits,
    triggeredBy: () => onVersionChange(bind),  // Single factory function
  },
  async () => { /* save logic */ }
);
```

**Important**: `triggeredBy` takes a factory function `() => Trigger | null` to enable lazy evaluation and SSR safety (return `null` when trigger cannot be created).

---

## Available Action Modules

| Module | Domain | Key Actions |
|--------|--------|-------------|
| `agent` | Agent lifecycle | `invalidateResumableRuns` |
| `asset` | Asset management | `updateAsset`, `deleteAsset` |
| `board` | Board persistence | `load`, `close`, `save`, `saveAs`, `deleteBoard` |
| `flowgen` | Flow generation | `generateFlow` |
| `graph` | Graph mutations | `addNode`, `changeEdge`, `changeNodeConfiguration` |
| `host` | Host/shell | `updatePageTitle`, `updateIcon` |
| `integration` | Integration management | `register`, `unregister`, `syncFromGraph` |
| `node` | Node operations | `autoname` |
| `router` | URL handling | `updateUrl` |
| `run` | Execution | `syncConsoleFromRunner` |
| `screen-size` | Responsive | `updateScreenSize` |
| `share` | Sharing | `shareToGoogleDrive` |
| `shell` | Chrome/UI | `updateShellState` |
| `sidebar` | Sidebar | `reconcileSidebar` |
| `step` | Step editing | `applyPendingEdits` |
| `theme` | Theme | `applyTheme` |

---

## Creating a New Action

### 1. Create the action file

```typescript
// actions/mydomain/mydomain-actions.ts
import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";

// Module-level bind
export const bind = makeAction();

// Simple action (no triggers)
export const myAction = asAction(
  "MyDomain.myAction",
  ActionMode.Awaits,  // Can pass mode directly if no triggers
  async (param: string): Promise<void> => {
    const { controller, services } = bind;
    // Action logic...
  }
);

// Triggered action
export const myTriggeredAction = asAction(
  "MyDomain.myTriggeredAction",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onSomeCondition(bind),
  },
  async (): Promise<void> => {
    const { controller } = bind;
    // Reactive logic...
  }
);
```

### 2. Create triggers (if needed)

```typescript
// actions/mydomain/triggers.ts
import { signalTrigger, type SignalTrigger } from "../../coordination.js";

type ActionBind = { controller: AppController; services: AppServices };

export function onSomeCondition(bind: ActionBind): SignalTrigger {
  return signalTrigger("Some Condition", () => {
    const { controller } = bind;
    return controller.editor.someState;
  });
}
```

### 3. Register in actions.ts

Add your module to `actions/actions.ts`:

```typescript
import * as MyDomain from "./mydomain/mydomain-actions.js";

// In actions():
MyDomain.bind({ controller, services });
instance = {
  // ... existing
  mydomain: MyDomain,
};

// In activateTriggers():
const allActions = [
  // ... existing
  ...Object.values(MyDomain),
];
```

---

## Directory Structure

```
actions/
├── actions.ts              # AppActions factory, activateTriggers()
├── binder.ts               # makeAction() dependency injection
├── agent/
│   ├── agent-actions.ts
│   └── triggers.ts
├── asset/
│   ├── asset-actions.ts
│   └── triggers.ts
├── board/
│   ├── board-actions.ts
│   └── triggers.ts
├── flowgen/
│   └── flowgen-actions.ts
├── graph/
│   └── graph-actions.ts
├── host/
│   └── host-actions.ts
├── integration/
│   ├── integration-actions.ts
│   └── triggers.ts
├── node/
│   ├── node-actions.ts
│   └── triggers.ts
├── router/
│   ├── router-actions.ts
│   └── triggers.ts
├── run/
│   ├── run-actions.ts
│   └── triggers.ts
├── screen-size/
│   ├── screen-size-actions.ts
│   └── triggers.ts
├── share/
│   └── share-actions.ts
├── shell/
│   ├── shell-actions.ts
│   └── triggers.ts
├── sidebar/
│   ├── sidebar-actions.ts
│   └── triggers.ts
├── step/
│   ├── step-actions.ts
│   └── triggers.ts
└── theme/
    ├── theme-actions.ts
    └── triggers.ts
```

---

## Error Handling

Actions should throw meaningful errors that callers can handle:

```typescript
export const editGraph = asAction(
  "Graph.edit",
  ActionMode.Awaits,
  async (spec: EditSpec[], label: string): Promise<void> => {
    const { controller } = bind;
    const { editor } = controller.editor.graph;

    if (!editor) {
      throw new Error("No active graph to edit");
    }

    const result = await editor.edit(spec, label);
    if (!result.success) {
      throw new Error(`Edit failed: ${result.error}`);
    }
  }
);
```

---

## Testing Actions

Actions can be tested by mocking `bind`:

```typescript
import { MyActions } from "../src/sca/actions/mydomain/mydomain-actions.js";

test("myAction does something", async () => {
  const mockController = { /* ... */ };
  const mockServices = { /* ... */ };

  MyActions.bind({ controller: mockController, services: mockServices });

  await MyActions.myAction("param");

  assert.strictEqual(mockController.someState, expectedValue);
});
```
