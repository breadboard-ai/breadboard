# SCA Architecture

> **Services, Controllers, and Actions** — The reactive architecture for the Breadboard Visual Editor.

This directory contains the modern, signal-backed architecture that is gradually replacing the legacy `Runtime` and `StateManager` patterns. It provides a testable, decoupled approach to managing UI state and business logic.

---

## Mental Model: The Three Layers

Think of SCA as three collaborating layers, each with a distinct responsibility:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER INTERFACE                             │
│                    (Lit Components + SignalWatcher)                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ reads state, dispatches actions
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           CONTROLLERS                               │
│                   (Signal-backed reactive state)                    │
│                                                                     │
│  ┌──────────────┐ ┌────────┐ ┌────────────────────────────────────┐ │
│  │   editor.*   │ │ home.* │ │           global.*                │ │
│  │ graph,select │ │ recent │ │ flags, toasts, consent, snackbars │ │
│  │ splitter,    │ └────────┘ │ debug, feedback, flowgenInput,    │ │
│  │ sidebar,step │            │ screenSize, statusUpdates         │ │
│  │ share,theme  │ ┌────────┐ └────────────────────────────────────┘ │
│  │ fastAccess,  │ │board.* │ ┌────────────────────────────────────┐ │
│  │ integrations │ │ main   │ │   run.*                           │ │
│  │ graphEditing │ └────────┘ │   main, renderer, screen          │ │
│  │ Agent        │            └────────────────────────────────────┘ │
│  └──────────────┘ ┌─────────────────┐                              │
│                   │ router (single) │                              │
│                   └─────────────────┘                              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ mutated by
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            ACTIONS                                  │
│                (Cross-cutting business logic)                       │
│                                                                     │
│   Examples: graph.edit(), graph.addNode(), board.save()             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ coordinates with
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            SERVICES                                 │
│                  (Infrastructure & External APIs)                   │
│                                                                     │
│   Examples: googleDriveClient, autonamer, signinAdapter, sandbox    │
└─────────────────────────────────────────────────────────────────────┘
```

### The Data Flow Cycle

1. **Render**: UI components read state from Controllers via Signals
2. **Interact**: User triggers an event (click, drag, keyboard)
3. **Dispatch**: Component calls an Action
4. **Execute**: Action coordinates Services and mutates Controllers
5. **React**: Signal updates cause automatic UI re-render

---

## Layer Responsibilities

### 🔧 Services — "The Infrastructure"

Services provide access to external capabilities: file system, network, graph processing, authentication. They are **stateless** with respect to the UI and injected once at boot.

| Service | Purpose |
|---------|---------|
| `actionTracker` | Records user actions for analytics |
| `autonamer` | Automatic name generation for nodes |
| `googleDriveClient` | Google Drive API interactions |
| `googleDriveBoardServer` | Board server backed by Google Drive |
| `flowGenerator` | AI-powered flow/graph generation |
| `mcpClientManager` | MCP (Model Context Protocol) client lifecycle |
| `signinAdapter` | Unified auth provider abstraction |
| `shellHost` | Communication with the host shell (Opal) |
| `sandbox` | Sandboxed module execution factory |
| `agentContext` | Agent lifecycle and trace management |

📁 See [`services/README.md`](./services/README.md)

### 🧠 Controllers — "The State"

Controllers are the **reactive source of truth**. They hold state via the `@field` decorator which wraps values in Signals, enabling automatic UI updates.

**Key patterns:**
- **Hierarchical**: Organized as a tree (`app.editor.graph`, `app.global.flags`)
- **Flat Reactive Fields**: Prefer flat `@field` properties over nested objects
- **The "Mask" Pattern**: Wrap legacy objects (like `EditableGraph`) behind clean signal APIs
- **Atomic Mutations**: Expose simple setters; complex workflows belong in Actions

📁 See [`controller/README.md`](./controller/README.md)

### ⚡ Actions — "The Logic"

Actions are **functions** that orchestrate multi-step workflows across Services and Controllers. They implement the "verbs" of the user interface.

**The Golden Rule:**
> **Action = Services + Controllers**
> If logic only touches one Controller, it's a Controller method.
> If logic coordinates Services AND Controllers, it's an Action.

📁 See [`actions/README.md`](./actions/README.md)

### 🔄 Triggers — "The Reactive Bridge"

Triggers connect **reactive state changes** to **action execution**. They are defined inline with actions using the `asAction` helper's `triggeredBy` option.

**Trigger types:**
- **Signal triggers** (`signalTrigger`): Fire when reactive conditions become truthy
- **Event triggers** (`eventTrigger`): Fire on DOM/custom events
- **State event triggers** (`stateEventTrigger`): Fire on specific `StateEvent` types dispatched to the event bus
- **Keyboard triggers** (`keyboardTrigger`): Fire on key combinations (e.g., `"Cmd+s"`, `"Delete"`)

**Example:**
```typescript
export const autoname = asAction(
  "Node.autoname",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onNodeConfigChange(bind),  // Single factory function
  },
  async () => { /* action logic */ }
);
```

📁 See [`coordination.ts`](./coordination.ts) for trigger utilities

---

## Directory Structure

```
sca/
├── sca.ts              # Bootstrap: creates singleton SCA instance
├── coordination.ts     # Trigger-action coordination system
├── reactive.ts         # Reactive effect primitives
├── types.ts            # Shared type definitions
├── utils.ts            # Re-exports utilities
│
├── actions/            # Business logic functions
│   ├── actions.ts      # AppActions interface & factory
│   ├── binder.ts       # makeAction() dependency injection
│   ├── agent/          # Agent lifecycle actions
│   ├── asset/          # Asset management actions
│   ├── board/          # Board persistence actions + triggers
│   ├── flowgen/        # Flow generation actions
│   ├── graph/          # Graph mutation actions
│   ├── host/           # Host/shell actions
│   ├── integration/    # Integration management actions
│   ├── node/           # Node actions + triggers
│   ├── router/         # URL routing actions + triggers
│   ├── run/            # Run execution actions + triggers
│   ├── screen-size/    # Responsive layout actions + triggers
│   ├── share/          # Sharing actions
│   ├── shell/          # Shell/chrome actions + triggers
│   ├── sidebar/        # Sidebar actions + triggers
│   ├── step/           # Step editing actions + triggers
│   └── theme/          # Theme actions + triggers
│
├── controller/         # Signal-backed state management
│   ├── controller.ts   # AppController interface & factory
│   ├── decorators/     # @field decorator implementation
│   ├── migration/      # State migration utilities
│   └── subcontrollers/ # Domain-specific controllers
│
├── context/            # Lit Context for SCA injection
│   └── context.ts      # scaContext definition
│
├── services/           # Infrastructure services
│   ├── services.ts     # AppServices interface & factory
│   ├── autonamer.ts    # Node autonaming service
│   ├── graph-editing-agent-service.ts
│   ├── integration-managers.ts
│   ├── notebooklm-api-client.ts
│   ├── run-service.ts
│   └── status-updates-service.ts
│
└── utils/              # Helper utilities
    ├── helpers/        # isHydrating, PendingHydrationError
    ├── logging/        # Debug logging infrastructure
    ├── sentinel.ts     # PENDING_HYDRATION symbol
    └── serialization.ts # Storage serialization
```

---

## Key Abstractions

### The `@field` Decorator

The central mechanism for reactive state. Wraps class properties in Signals with optional persistence:

```typescript
class MyController extends RootController {
  @field()                           // In-memory only
  accessor currentSelection = [];

  @field({ persist: "local" })       // localStorage
  accessor userPreference = "dark";

  @field({ persist: "idb" })         // IndexedDB
  accessor recentBoards = [];
}
```

📁 See [`controller/decorators/README.md`](./controller/decorators/README.md)

### Hydration Lifecycle

Controllers track when persisted state has loaded. Before hydration completes, accessing a `@field` throws `PendingHydrationError`. Use `controller.isHydrated` to wait:

```typescript
await sca.controller.isHydrated;
// Now safe to access all persisted fields
```

For synchronous checks (e.g., in render functions), use `isHydrating()` with a callback:

```typescript
import { isHydrating } from "./utils/helpers/helpers.js";

// Returns true if the callback would throw PendingHydrationError
if (isHydrating(() => controller.myField)) {
  return html`<loading-spinner></loading-spinner>`;
}

// Safe to use the value
return html`<div>${controller.myField}</div>`;
```

### The SCA Context

UI components consume the SCA singleton via Lit Context:

```typescript
import { scaContext } from "../sca/context/context.js";

@customElement("my-component")
class MyComponent extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    // Reading from signals auto-registers reactivity
    const flags = this.sca?.controller.global.flags;
    return html`...`;
  }
}
```

---

## Quick Reference: When to Add What

| You need to... | Add a... | Location |
|----------------|----------|----------|
| Store reactive UI state | Controller with `@field` | `controller/subcontrollers/` |
| Call external APIs or heavy processing | Service | `services/` |
| Coordinate multiple controllers/services | Action | `actions/` |
| React automatically to state changes | Trigger (via `asAction`) | `actions/<domain>/triggers.ts` |

---

## Migration from Legacy Runtime

The SCA architecture coexists with the legacy `Runtime` during transition. Key differences:

| Aspect | Legacy Runtime | Modern SCA |
|--------|----------------|------------|
| **Organization** | Monolithic Object | Decoupled layers |
| **State** | Mixed with logic, EventTarget-based | Signal-backed, unitary source of truth |
| **Logic** | Methods on classes | Pure functional Actions |
| **Reactivity** | Manual event listeners | Automatic via SignalWatcher |

See the knowledge base for detailed migration artifacts and patterns.
