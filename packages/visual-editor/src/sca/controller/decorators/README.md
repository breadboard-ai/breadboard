# Decorators

> **Signal-backed class property decorators** — The `@field` decorator and related utilities.

This directory contains the decorators that power SCA's reactive state management.

---

## The `@field` Decorator

The `@field` decorator transforms class accessor properties into Signal-backed reactive state with optional persistence.

### Basic Usage

```typescript
import { field } from "./field.js";
import { RootController } from "../subcontrollers/root-controller.js";

class MyController extends RootController {
  // Simple reactive state (no persistence)
  @field()
  accessor isLoading = false;

  // Persisted to localStorage
  @field({ persist: "local" })
  accessor theme = "light";

  // Persisted to sessionStorage
  @field({ persist: "session" })
  accessor temporaryData = null;

  // Persisted to IndexedDB (for larger data)
  @field({ persist: "idb" })
  accessor recentItems: string[] = [];
}
```

---

## Storage Options

| Option | Storage | Survives Refresh | Survives Tab Close | Best For |
|--------|---------|------------------|-------------------|----------|
| (none) | Memory | ❌ | ❌ | Transient UI state |
| `"local"` | localStorage | ✅ | ✅ | User preferences, small strings |
| `"session"` | sessionStorage | ✅ | ❌ | Temporary state within session |
| `"idb"` | IndexedDB | ✅ | ✅ | Large data, complex objects |

---

## Deep Tracking

By default, `@field` uses **shallow** signal tracking. This means only full property replacement triggers reactivity, which is more efficient for primitive values:

```typescript
@field()
accessor theme = "light";

// This triggers reactivity
this.theme = "dark";
```

For objects and arrays where you need mutations (like `.push()` or `.set()`) to trigger reactivity, enable deep tracking:

```typescript
@field({ deep: true })
accessor items: string[] = [];

// This triggers reactivity because deep: true
this.items.push("new item");
```

Without `deep: true`, you would need full replacement:

```typescript
@field()  // deep: false by default
accessor items: string[] = [];

// Only full replacement triggers reactivity
this.items = [...this.items, "new item"];
```

---

## Hydration

When a field has `persist` enabled, its value must be loaded from storage before use. During loading, accessing the field throws `PendingHydrationError`.

### Waiting for Hydration

```typescript
// At the controller level
await myController.isHydrated;

// At the app level (waits for ALL controllers)
await sca.controller.isHydrated;
```

### In UI Components

Use `SignalWatcher` — it handles hydration automatically:

```typescript
@customElement("my-component")
class MyComponent extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    try {
      const theme = this.sca?.controller.myController.theme;
      return html`<div class=${theme}>...</div>`;
    } catch {
      // Field still hydrating — will re-render when ready
      return html`<loading-spinner></loading-spinner>`;
    }
  }
}
```

---

## Restrictions

### No HTMLTemplateResults

You cannot persist Lit `html` templates — they don't serialize/deserialize correctly:

```typescript
// ❌ Will throw PersistEntityError
@field({ persist: "local" })
accessor template = html`<div>...</div>`;

// ✅ Persist the data, render the template
@field({ persist: "local" })
accessor message = "Hello";

render() {
  return html`<div>${this.message}</div>`;
}
```

---

## Internals

### Signal Creation

Each `@field` creates a `Signal.State` that wraps the property value:

```
┌─────────────────────────────────────────────┐
│ @field() accessor theme = "light";          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Signal.State<"light" | pending>             │
│   ├── get() → returns value or throws      │
│   └── set() → updates signal, triggers UI  │
└─────────────────────────────────────────────┘
```

### Persistence Watcher

For persisted fields, a `Signal.subtle.Watcher` observes changes and writes to storage:

```
Signal changes → Watcher fires → queueMicrotask → Store.set()
```

---

## Directory Structure

```
decorators/
├── field.ts            # The @field decorator
├── debug.ts            # Debug bindings for Tweakpane UI
├── storage/
│   ├── local.ts        # WebStorageWrapper (local/session)
│   └── idb.ts          # IdbStorageWrapper (IndexedDB)
└── utils/
    ├── types-match.ts  # Type comparison for hydration
    ├── wrap-unwrap.ts  # Deep signal wrapping
    └── is-lit-template.ts  # Template detection
```
