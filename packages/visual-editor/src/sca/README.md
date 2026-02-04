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
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │
│   │   editor.*  │  │   home.*    │  │        global.*         │    │
│   │  graph      │  │  recent     │  │  flags, toasts, consent │    │
│   │  selection  │  │             │  │  debug, feedback, etc.  │    │
│   │  splitter   │  │             │  │                         │    │
│   └─────────────┘  └─────────────┘  └─────────────────────────┘    │
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
│   Examples: graphStore, fileSystem, googleDriveClient, autonamer    │
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
| `graphStore` | Central repository and cache for graph definitions |
| `fileSystem` | Local and persistent file system access |
| `googleDriveClient` | Google Drive API interactions |
| `autonamer` | Automatic name generation for nodes |
| `signinAdapter` | Unified auth provider abstraction |
| `mcpClientManager` | MCP (Model Context Protocol) client lifecycle |

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

### 🔄 Triggers — "The Side Effects"

Triggers are **reactive listeners** that perform side effects when state changes. Think of them as "automatic Actions" that react to signal updates.

**Examples:**
- Auto-save when graph is modified
- Auto-name nodes when configuration changes

📁 See [`triggers/README.md`](./triggers/README.md)

---

## Directory Structure

```
sca/
├── sca.ts              # Bootstrap: creates singleton SCA instance
├── types.ts            # Shared type definitions
├── utils.ts            # Re-exports utilities
│
├── actions/            # Business logic functions
│   ├── actions.ts      # AppActions interface & factory
│   ├── binder.ts       # makeAction() dependency injection
│   ├── board/          # Board-related actions
│   └── graph/          # Graph mutation actions
│
├── controller/         # Signal-backed state management
│   ├── controller.ts   # AppController interface & factory
│   ├── decorators/     # @field decorator implementation
│   ├── subcontrollers/ # Domain-specific controllers
│   ├── context/        # Pending writes tracking
│   └── migration/      # State migration utilities
│
├── context/            # Lit Context for SCA injection
│   └── context.ts      # scaContext definition
│
├── services/           # Infrastructure services
│   ├── services.ts     # AppServices interface & factory
│   └── autonamer.ts    # Node autonaming service
│
├── triggers/           # Reactive side effects
│   ├── triggers.ts     # AppTriggers interface & registration
│   ├── binder.ts       # makeTrigger() with reactive() management
│   ├── board/          # Board-related triggers
│   └── node/           # Node-related triggers (autonaming)
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
| React automatically to state changes | Trigger | `triggers/` |

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
