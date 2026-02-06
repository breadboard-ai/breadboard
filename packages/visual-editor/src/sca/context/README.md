# SCA Context

> **Lit Context for dependency injection** — How UI components access SCA.

This directory contains the Lit Context definition that provides SCA to UI components.

---

## The `scaContext`

```typescript
import { createContext } from "@lit/context";
import { SCA } from "../sca.js";

export const scaContext = createContext<SCA | undefined>("SCA");
```

---

## Usage

### Providing SCA (in the app shell)

The main application shell provides SCA to all descendants:

```typescript
import { provide } from "@lit/context";
import { scaContext } from "./sca/context/context.js";

@customElement("app-main")
class AppMain extends LitElement {
  @provide({ context: scaContext })
  accessor sca = sca(config, flags);  // Create singleton
}
```

### Consuming SCA (in components)

Components consume SCA via the `@consume` decorator:

```typescript
import { consume } from "@lit/context";
import { scaContext } from "../sca/context/context.js";
import { SignalWatcher } from "@lit-labs/signals";

@customElement("my-component")
class MyComponent extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    // Access controllers
    const flags = this.sca?.controller.global.flags;

    // Access actions
    // this.sca?.actions.graph.addNode(...)

    // Access services (rarely needed in UI)
    // this.sca?.services.fileSystem
  }
}
```

---

## Why Context?

### Before: Prop Drilling

```typescript
// ❌ Every component needs the prop
<parent-component .sca=${sca}>
  <child-component .sca=${sca}>
    <grandchild-component .sca=${sca}>
```

### After: Context Injection

```typescript
// ✅ Provided once at the top, consumed anywhere
<app-main>  <!-- provides scaContext -->
  <parent-component>
    <child-component>
      <grandchild-component>  <!-- consumes scaContext -->
```

---

## The Reactive Component Pattern

Combine `SignalWatcher` with `scaContext` for fully reactive components:

```typescript
@customElement("bb-flag-display")
class FlagDisplay extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    // Reading signals auto-registers reactivity
    const gulfRendererEnabled = this.sca?.controller.global.flags.gulfRenderer;

    return html`
      <div>Gulf Renderer: ${gulfRendererEnabled ? "ON" : "OFF"}</div>
    `;
  }
}
```

When `flags.gulfRenderer` changes, the component automatically re-renders.
