# Controller Layer

> **The reactive source of truth** — Signal-backed state management for the Visual Editor.

The controller layer holds all application state using [Signals](https://github.com/lit/lit/tree/main/packages/signals). UI components automatically re-render when the signals they read are updated.

---

## Architecture Overview

```
AppController (singleton)
├── editor                              # Editor workspace state
│   ├── graph          (GraphController)       # Active graph, editor instance
│   ├── selection      (SelectionController)   # Selected nodes/edges/assets
│   ├── splitter       (SplitterController)    # Panel resizer positions
│   ├── sidebar        (SidebarController)     # Sidebar visibility/content
│   ├── step           (StepController)        # Step editing state
│   ├── share          (ShareController)       # Sharing state
│   ├── theme          (ThemeController)       # Theme customization
│   ├── fastAccess     (FastAccessController)  # Quick-access menu
│   ├── integrations   (IntegrationsController) # MCP/integration state
│   └── graphEditingAgent (GraphEditingAgentController)
│
├── home                                # Home screen state
│   └── recent         (RecentBoardsController) # Recently accessed boards
│
├── global                              # Application-wide state
│   ├── main           (GlobalController)      # Top-level app state
│   ├── flags          (FlagController)        # Feature flags
│   ├── debug          (DebugController)       # Developer tools
│   ├── feedback       (FeedbackController)    # Feedback collection
│   ├── flowgenInput   (FlowgenInputController) # Flow gen prompt state
│   ├── toasts         (ToastController)       # Toast notifications
│   ├── snackbars      (SnackbarController)    # Actionable snackbars
│   ├── statusUpdates  (StatusUpdatesController)
│   ├── consent        (ConsentController)     # User consent management
│   ├── screenSize     (ScreenSizeController)  # Responsive breakpoints
│   └── performMigrations()                     # State migration runner
│
├── board                               # Board metadata
│   └── main           (BoardController)       # Current board state
│
├── run                                 # Execution state
│   ├── main           (RunController)         # Run lifecycle
│   ├── renderer       (RendererController)    # Graph render state during run
│   └── screen         (ScreenController)      # Run view mode
│
└── router             (RouterController)      # URL routing (single controller)
```

---

## Creating a Controller

### 1. Extend `RootController`

```typescript
import { RootController } from "./root-controller.js";
import { field } from "../decorators/field.js";

export class MyController extends RootController {
  // In-memory state (resets on page refresh)
  @field()
  accessor isLoading = false;

  // Persisted to localStorage
  @field({ persist: "local" })
  accessor userPreference = "default";

  // Persisted to IndexedDB (for larger data)
  @field({ persist: "idb" })
  accessor savedItems: string[] = [];
}
```

### 2. Register in AppController

Add your controller to the appropriate domain in `controller.ts`:

```typescript
this.global = {
  // ... existing controllers
  myController: new MyController("MyController"),
};
```

### 3. Update the Interface

Add the type to the `AppController` interface:

```typescript
export interface AppController {
  global: {
    // ... existing
    myController: MyController;
  };
}
```

---

## Key Patterns

### The `@field` Decorator

The `@field` decorator transforms class accessor properties into Signal-backed reactive state. See [`decorators/README.md`](./decorators/README.md) for full details.

**Storage options:**
- No persistence: `@field()` — state lost on refresh
- localStorage: `@field({ persist: "local" })` — small strings, survives refresh
- sessionStorage: `@field({ persist: "session" })` — survives refresh, cleared on tab close
- IndexedDB: `@field({ persist: "idb" })` — large data, survives refresh

### The Hydration Lifecycle

When a controller has persisted fields, those values must be loaded from storage before use. During loading, the field value is the `PENDING_HYDRATION` sentinel.

```typescript
// Wait for all controllers to hydrate
await sca.controller.isHydrated;

// Now safe to access any persisted field
const flags = sca.controller.global.flags.flags();
```

**For UI components**: Wrap in `SignalWatcher` and access in `render()` — the component will re-render when hydration completes.

### The "Mask" Pattern

Controllers often wrap complex legacy objects (like `EditableGraph`) behind a clean, signal-based interface:

```typescript
class GraphController extends RootController {
  // The legacy object is held internally
  #editableGraph: EditableGraph | null = null;

  // Signal-backed state for UI consumption
  @field()
  accessor graphUrl: string | null = null;

  // Clean getter that masks the complexity
  get editor(): EditableGraph | null {
    return this.#editableGraph;
  }
}
```

### Atomic Mutations

Controllers expose simple, atomic mutations. Complex multi-step workflows belong in **Actions**, not controllers:

```typescript
// ✅ Good: Simple atomic mutation
controller.editor.selection.deselectAll();

// ❌ Bad: Complex workflow in controller
controller.saveGraphAndNotifyAndRefresh(); // This should be an Action
```

---

## Directory Structure

```
controller/
├── controller.ts       # AppController interface & factory
├── decorators/         # @field decorator implementation
│   ├── field.ts        # The @field decorator
│   ├── debug.ts        # Debug bindings for Tweakpane
│   ├── storage/        # Storage wrappers (local, idb)
│   └── utils/          # Type matching, wrap/unwrap
├── context/            # Pending writes tracking
│   └── writes.ts
├── migration/          # State migration utilities
│   └── migrations.ts
└── subcontrollers/     # Domain-specific controllers
    ├── root-controller.ts   # Base class
    ├── board/               # Board domain
    ├── editor/              # Editor domain (graph, selection, sidebar, etc.)
    ├── global/              # Global domain (flags, toasts, consent, etc.)
    ├── home/                # Home domain
    ├── router/              # Router domain
    └── run/                 # Run domain
```

---

## Accessing Controllers

### From UI Components (via Context)

```typescript
import { scaContext } from "../sca/context/context.js";

@customElement("my-element")
class MyElement extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    const isLoading = this.sca?.controller.editor.graph.isLoading;
    // Component auto-rerenders when signal changes
  }
}
```

### From Actions

```typescript
export function myAction() {
  const { controller } = bind;  // Injected via makeAction()
  controller.global.toasts.toast("Success!");
}
```

### From Actions and Triggers

```typescript
// In actions where bind is available
export const myAction = asAction(
  "MyDomain.myAction",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onSomeCondition(bind),
  },
  async () => {
    const { controller } = bind;  // Injected via bind
    controller.global.toasts.toast("Success!");
  }
);
```

