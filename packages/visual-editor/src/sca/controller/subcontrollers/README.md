# Subcontrollers

> **Domain-specific state management** — Individual controllers organized by feature area.

This directory contains all the concrete controller implementations that make up the `AppController` tree.

---

## Controller Hierarchy

```
AppController
├── editor/
│   ├── graph/          GraphController           # Active graph, editor instance
│   ├── selection/      SelectionController       # Selected nodes/edges/assets
│   ├── splitter/       SplitterController        # Panel resizer positions
│   ├── sidebar/        SidebarController         # Sidebar visibility/content
│   ├── step/           StepController            # Step editing state
│   ├── share/          ShareController           # Sharing state
│   ├── theme/          ThemeController           # Theme customization
│   ├── fast-access/    FastAccessController      # Quick-access menu
│   ├── integrations/   IntegrationsController    # MCP/integration state
│   └──               GraphEditingAgentController
│
├── home/
│   └── RecentBoardsController                    # Recently accessed boards
│
├── global/
│   ├── GlobalController                          # Top-level app state
│   ├── FlagController                            # Feature flags
│   ├── DebugController                           # Developer tools
│   ├── FeedbackController                        # Feedback collection
│   ├── FlowgenInputController                    # Flow gen prompt state
│   ├── ToastController                           # Toast notifications
│   ├── SnackbarController                        # Actionable snackbars
│   ├── StatusUpdatesController                    # Status updates
│   ├── ConsentController                         # User consent management
│   └── ScreenSizeController                      # Responsive breakpoints
│
├── board/
│   └── BoardController                           # Current board metadata
│
├── run/
│   ├── RunController                             # Run lifecycle
│   ├── RendererController                        # Graph render state during run
│   └── ScreenController                          # Run view mode
│
└── router
    └── RouterController                          # URL routing
```

---

## Base Class: `RootController`

All controllers extend `RootController`, which provides:

| Feature | Purpose |
|---------|---------|
| `controllerId` | Unique identifier for storage namespacing |
| `isHydrated` | Promise that resolves when all persisted fields load |
| `isSettled` | Promise that resolves when all storage writes complete |
| `registerSignalHydration()` | Called by `@field` to track hydration |
| `hydrated` | Boolean getter for sync hydration check |

```typescript
export class MyController extends RootController {
  constructor() {
    super("MyController");  // Unique controller ID
  }
}
```

---

## Creating a New Controller

### 1. Create the file

```typescript
// subcontrollers/my-controller.ts
import { RootController } from "./root-controller.js";
import { field } from "../decorators/field.js";

export class MyController extends RootController {
  @field()
  accessor currentState = "idle";

  @field({ persist: "local" })
  accessor userPreference = "default";

  // Simple atomic mutation
  setState(state: string) {
    this.currentState = state;
  }

  // Computed value (not a signal, recalculates each access)
  get isActive() {
    return this.currentState === "active";
  }
}
```

### 2. Export from domain barrel

```typescript
// subcontrollers/editor/editor.ts
export * as MyDomain from "./my-controller.js";
```

### 3. Register in AppController

```typescript
// controller/controller.ts
this.editor = {
  // ... existing
  myDomain: new MyDomain.MyController("Editor_MyDomain"),
};
```

---

## Controller Patterns

### Flat Reactive Fields

Prefer flat `@field` properties over nested state objects:

```typescript
// ✅ Good: Flat, granular reactivity
@field()
accessor isLoading = false;

@field()
accessor errorMessage: string | null = null;

@field({ deep: true })  // deep: true for collections that mutate
accessor items: Item[] = [];

// ❌ Avoid: Nested state object
@field({ deep: true })
accessor state = { isLoading: false, error: null, items: [] };
```

### The "Mask" Pattern

Wrap complex legacy objects behind a clean signal interface:

```typescript
class GraphController extends RootController {
  // Internal: the complex legacy object
  #editableGraph: EditableGraph | null = null;

  // External: signal-backed state for UI
  @field()
  accessor graphUrl: string | null = null;

  @field()
  accessor isDirty = false;

  // Controlled access to the internal object
  get editor(): EditableGraph | null {
    return this.#editableGraph;
  }

  setGraph(url: string, graph: EditableGraph) {
    this.graphUrl = url;
    this.#editableGraph = graph;
    this.isDirty = false;
  }
}
```

### Computed Properties

For derived state, use getters (they recompute on access):

```typescript
class FlagController extends RootController {
  @field({ persist: "idb" })
  private accessor _mcp: boolean | null = null;

  #envFlags: RuntimeFlags;

  // Computed: override ?? environment value
  get mcp(): boolean {
    return this._mcp ?? this.#envFlags.mcp;
  }
}
```

---

## Key Controllers

### `GraphController`

Manages the currently open graph:
- `graphUrl` — URL of the loaded graph
- `editor` — The `EditableGraph` instance
- `isDirty` — Whether there are unsaved changes
- `readOnly` — Whether editing is disabled
- `lastNodeConfigChange` — Trigger signal for autonaming

### `SelectionController`

Manages selection state:
- `selectedNodes` — Set of selected node IDs
- `selectedEdges` — Set of selected edge identifiers
- `selectedAssets` — Set of selected asset paths

### `FlagController`

Manages feature flags with override support:
- `flags()` — Returns merged flags (env + overrides)
- `override(flag, value)` — Set a user override
- `clearOverride(flag)` — Remove an override

### `ToastController` / `SnackbarController`

Notification systems:
- `toast(message)` — Show a simple toast
- `snackbar(options)` — Show an actionable snackbar with buttons

### `BoardController`

Manages the current board's metadata:
- `boardServerUrl` — URL of the board server

### `RunController`

Manages execution lifecycle:
- `runStatus` — Current run state (`idle`, `running`, `paused`, `stopping`)
- `events` — Console entries from the run

### `RendererController`

Manages graph render state during runs:
- `runState` — Per-node and per-edge visual state

### `ScreenController`

Manages run view mode:
- `mode` — Current screen mode

### `RouterController`

Manages URL routing state:
- `url` — Current parsed URL
- `urlError` — Error from invalid URL
