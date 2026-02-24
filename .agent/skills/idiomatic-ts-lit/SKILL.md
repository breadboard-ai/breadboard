---
name: idiomatic-ts-lit
description:
  A living reference for writing idiomatic TypeScript and Lit in the Breadboard
  Visual Editor. Covers type safety, import hygiene, component design, and the
  patterns that distinguish a great frontender from a merely competent one.
---

# 💎 Idiomatic TypeScript + Lit

A living reference for what "great" looks like in this codebase. Each section
names a pattern (or anti-pattern) and shows exactly what to write instead. Think
of this as the bar for code review — the things that make you smile or wince
when you see them.

---

## 1. Type Safety — Say What You Mean

### 1.1 No Unsafe Casts — "The Unseen Cast"

Our codemod rewrote 26 event casts in a single session. The pattern was hiding
real bugs — when trigger wiring changed, `.detail` silently returned
`undefined`.

```typescript
// ❌ The Unseen Cast — runtime bomb
async (evt?: Event): Promise<void> => {
  const detail = (evt as StateEvent<"node.change">).detail;
};

// ✅ Type the parameter — let the compiler work for you
async (evt?: StateEvent<"node.change">): Promise<void> => {
  const detail = evt!.detail;
};
```

**Principle:** A cast says "I know better than the compiler." That's almost
always a lie. Move the type to the signature.

### 1.2 `as any` Is a Fire Alarm

`as any` in production code means the type system has a gap. Four remaining
instances in our `src/` are all accounted for — if you need another, explain why
in a comment. But be prepared for pushback from the user.

```typescript
// ❌ Silences the compiler, hides the bug
const result = someValue as any;

// ✅ Narrow first, assert only when necessary
if (isValidResult(result)) {
  const typed: SpecificType = result;
}
```

**Acceptable escapes:**

- **Test mocks** — `as unknown as AppServices` with a partial mock is fine;
  that's the point of a mock.
- **Library boundaries** — When a third-party type is wrong, cast with a
  `// TODO(types):` comment linking the issue.
- **Trust boundaries** — Trusted types (CSP) require casts by design.

### 1.3 `as unknown as T` — The Double Cast

25 occurrences in our source. Some are legitimate (decorators, trusted types,
signal-backed collection wrappers). Some are hiding a missing generic. Before
writing one, ask:

> _Can I add a type parameter, use a type guard, or restructure the API to avoid
> this?_

```typescript
// ❌ Symptom of a missing generic
const transformer = raw as unknown as DataPartTransformer;

// ✅ Fix the source — add the generic to the factory
const transformer = createTransformer<DataPartTransformer>(raw);
```

### 1.4 Discriminated Unions Over Type Assertions

When you have a value that could be one of several shapes, use discriminated
unions with exhaustive checks.

```typescript
// ❌ Casting your way through variants
if ((result as ErrorResult).$error) { ... }

// ✅ Exhaustive discrimination
type Outcome<T> = { value: T } | { $error: string };

function handle(outcome: Outcome<Data>) {
  if ("$error" in outcome) {
    return err(outcome.$error);
  }
  return ok(outcome.value);    // TypeScript narrows automatically
}
```

---

## 2. Import Hygiene — Dependencies at a Glance

### 2.1 Static `import type` Over Inline `import()`

We codified this as "Standard 5.30" in our linting patterns. Inline imports
clutter signatures and hide dependencies.

```typescript
// ❌ Cluttered signature — reader can't scan the dependencies
export function mapState(
  state: import("@breadboard-ai/types").NodeLifecycleState
): import("@breadboard-ai/types").NodeRunStatus { ... }

// ✅ Types at the top — dependencies are visible at a glance
import type { NodeLifecycleState, NodeRunStatus } from "@breadboard-ai/types";

export function mapState(state: NodeLifecycleState): NodeRunStatus { ... }
```

### 2.2 Dynamic `import()` — Only for Lazy Loading

Dynamic imports are for code splitting and lazy loading. If the module is always
used, it should be a static import.

```typescript
// ❌ Dynamic import for something you always need
const { html } = await import("lit");

// ✅ Dynamic import for optional heavyweight deps
const pdfLib = await import("pdfjs-dist/build/pdf.mjs");
```

Current legitimate uses: bootstrap entry points, polyfills, PDF viewer, debug
tools. If your dynamic import doesn't fall into "user may never trigger this
code path," make it static.

### 2.3 Explicit Exports at the Top

Canonical pattern in this repo: imports first, then explicit exports, then
implementations. This makes the public API scannable without scrolling.

```typescript
import { foo } from "./foo.js";
export { bar, baz };

function bar() {
  /* ... */
}
function baz() {
  /* ... */
}
```

---

## 3. Lit Components — Thin Rendering Shells

### 3.1 Components Are Not Controllers

If your component class has a `Map`, a `Set`, or any business logic beyond DOM
intrinsic state (scroll position, focus, animation frames), it's doing too much.

```typescript
// ❌ Business logic trapped in the DOM
@customElement("my-list")
class MyList extends LitElement {
  private items = new Map<string, Item>();   // ← state belongs in a Controller
  private async loadItems() { ... }          // ← logic belongs in an Action
}

// ✅ Thin shell — state and logic live in SCA
@customElement("my-list")
class MyList extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  render() {
    const items = this.sca.controller.editor.items;  // signal read
    return html`${items.map(i => html`<my-item .data=${i}></my-item>`)}`;
  }
}
```

### 3.2 Definite Assignment for Context

Context is guaranteed by the application shell. Optional chaining on `this.sca`
is noise — it hides real bootstrap errors behind silent `undefined`.

```typescript
// ❌ "Safety" that silences real bugs
@consume({ context: scaContext })
protected accessor sca: SCA | undefined = undefined;
// ... this.sca?.controller?.editor?.graph  ← defensive noise

// ✅ Definite assignment — fail loudly if bootstrap is broken
@consume({ context: scaContext })
protected accessor sca!: SCA;
// ... this.sca.controller.editor.graph    ← clean and honest
```

### 3.3 `SignalWatcher` Is Non-Negotiable

If a component reads from SCA controllers, it **must** extend
`SignalWatcher(LitElement)`. Without it, signal reads don't trigger re-renders.

The one exception: pure "service locator" consumers that only call imperative
methods (not read signals) in event handlers. Document this with an eslint
disable comment.

### 3.4 No `@consume` Reads in Constructors or Initializers

Context values aren't injected until `connectedCallback`. Accessing them during
class setup phase gives you `undefined`.

```typescript
// ❌ Context not available yet
@customElement("my-thing")
class MyThing extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  private tools = this.sca.controller.tools; // 💥 undefined at init time!
}

// ✅ Defer access — lazy evaluation in arrow functions is safe
@customElement("my-thing")
class MyThing extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  // Access in render(), event handlers, or explicit lifecycle methods
  render() {
    const tools = this.sca.controller.tools; // ✅ connected by now
    return html`...`;
  }
}
```

---

## 4. Signal Patterns — Reactivity with Precision

### 4.1 `@field` for All Controller State

No `SignalMap`, `SignalSet`, `SignalArray`, or `@signal` from
`@lit-labs/signals` in SCA controllers. They bypass hydration and persistence.

```typescript
// ❌ Reactivity island — invisible to persistence
private _myMap = new SignalMap<string, string>();

// ✅ Unified lifecycle
@field({ deep: true })
private accessor _myMap: Map<string, string> = new Map();
```

### 4.2 `void` for Intentional Signal Reads

When you read a signal purely for subscription (side effect), the linter flags
it as an unused expression. Use `void` to communicate intent.

```typescript
// ❌ Linter: "Expected an assignment or function call"
controller.editor.graph.version;

// ✅ Explicit intent — "I'm subscribing, not using the value"
void controller.editor.graph.version;
```

### 4.3 Version + 1 for Triggers

A trigger condition that returns `0` is falsy — the trigger never fires. Always
offset by 1.

```typescript
// ❌ The Sticky Trigger Hazard — version 0 is falsy, trigger never fires
return controller.editor.graph.version;

// ✅ Always truthy, always changes
return controller.editor.graph.version + 1;
```

---

## 5. Error Handling — Outcomes, Not Exceptions

### 5.1 Return Outcomes, Don't Throw

Actions return `Outcome<T>` — either `ok(value)` or `err("message")`. This makes
error paths explicit and testable.

```typescript
// ❌ Untyped exception — caller has no idea what to catch
throw new Error("No editor available");

// ✅ Typed outcome — caller knows the shape
if (!editor) return err("No editor available");
```

### 5.2 Fail-Early Guards

The first lines of an Action should validate preconditions. Don't nest deep
before discovering the state is invalid.

```typescript
const { controller, services } = bind;
const editor = controller.editor.graph.editor;

if (!editor) return err("No editor available");
if (!metadata) return err("Missing metadata");
// ... proceed with confidence
```

---

## 6. Testing — No Coverage Theater

### 6.1 `mock.method` — Never Direct Overwrites

```typescript
// ❌ Direct overwrite — no automatic restore, leaks between tests
globalThis.fetch = () => Promise.resolve(new Response("{}"));

// ✅ Restorable mock
mock.method(globalThis, "fetch", () => Promise.resolve(new Response("{}")));
// afterEach: mock.restoreAll()
```

### 6.2 `as unknown as AppServices` for Partial Mocks

This is the one place double-casting is encouraged. Partial mocks should only
implement what the test exercises.

```typescript
Asset.bind({
  controller,
  services: { googleDriveBoardServer: { dataPartTransformer: () => mock } }
    as unknown as AppServices,
});
```

### 6.3 Verify Assertions Actually Ran

A test that passes because a guard skipped the logic provides zero coverage. Add
a `console.log` or explicit counter during development to confirm the assertion
block executed.

---

## 7. Naming — Make the Code Read Like Prose

### 7.1 Name Your Bugs

Named bugs are memorable bugs. "The Unseen Cast" is instantly recognizable.
"Fixed event handler typing" is forgettable.

| Bug Name            | What it catches                                           |
| ------------------- | --------------------------------------------------------- |
| The Unseen Cast     | Unsafe `(evt as T).detail` in event handlers              |
| The Silent Stacking | Kahn's algorithm silently drops cyclic nodes              |
| The Sticky Trigger  | Trigger condition returns 0 (falsy), never fires          |
| The Boolean Trigger | Presence-based trigger that doesn't reset after consuming |

### 7.2 Actions Are Verbs, Controllers Are Nouns

```
board.save()          ← Action: what the user does
editor.graph          ← Controller: what the system holds
graphStore.fetch()    ← Service: infrastructure verb
```

---

## 8. Architectural Discipline

### 8.1 No Cross-Action Imports

Actions talk to each other through **Triggers** and **Pending Signals**, never
through direct imports. This prevents circular dependencies and enforces the
"Action independence" invariant.

### 8.2 Destructure `bind` at the Top

```typescript
// ❌ Chained access — hard to trace dependencies
bind.controller.editor.graph.setEditor(e);

// ✅ Destructure first — dependencies are visible
const { controller, services } = bind;
controller.editor.graph.setEditor(e);
```

### 8.3 Shared Utilities Before New Code

Before writing a helper, check `packages/utils` and `src/utils/`. The Déjà Code
system will flag you if you reimplement something that already exists — but
catching it before you write it is better.

---

## 9. Lit Patterns — The Framework-Specific Craft

> **The fundamental contract:** State lives in SCA. Rendering lives in
> components. That's not a suggestion — it's the architectural boundary that
> makes everything else work.
>
> A component **reads** from Controllers (via signals) and **dispatches**
> through Actions. It never _owns_ business state, never _fetches_ data, never
> _decides_ what happens next. Those are Controller, Service, and Action
> concerns respectively. The component's only job is to turn signals into pixels
> and user gestures into action calls.

```
 ┌──────────────────────────────────┐
 │         UI Component             │
 │  reads signals → renders HTML    │
 │  handles events → calls Actions  │
 │  owns ONLY: scroll, focus, anim  │
 └──────────┬───────────────────────┘
            │
 ┌──────────▼───────────────────────┐
 │      SCA (Controllers/Actions)   │
 │  owns ALL business state         │
 │  orchestrates ALL workflows      │
 │  coordinates ALL services        │
 └──────────────────────────────────┘
```

If you find yourself adding a `Map`, a `fetch()`, or an `if/else` business rule
inside a component — stop. That logic has a home, and it's not here.

### 9.1 Templates: `nothing` Over Empty Strings

Lit's `nothing` sentinel removes nodes from the DOM entirely. An empty string
leaves an empty text node — a subtle difference that matters for CSS selectors,
`childNodes.length`, and layout.

```typescript
// ❌ Empty text node lingers in the DOM
render() {
  return html`${this.showIcon ? html`<span>icon</span>` : ""}`;
}

// ✅ Node cleanly removed
import { nothing } from "lit";

render() {
  return html`${this.showIcon ? html`<span>icon</span>` : nothing}`;
}
```

### 9.2 `repeat()` for Keyed Lists, `.map()` for Static

`repeat()` from `lit/directives/repeat.js` keeps DOM identity stable across
re-renders when items shift position. Use it for lists the user can reorder, add
to, or remove from. `.map()` is fine for static read-only lists.

```typescript
// ✅ Keyed — DOM nodes move with their data
import { repeat } from "lit/directives/repeat.js";

${repeat(
  messages,
  (msg) => msg.id,       // stable key
  (msg) => html`<div>${msg.text}</div>`
)}

// ✅ Static — no reordering, .map() is simpler
${items.map(item => html`<span>${item.label}</span>`)}
```

### 9.3 `classMap()` and `styleMap()` Over String Interpolation

String interpolation for classes and styles is fragile and hard to read. Lit
provides directives that handle the bookkeeping.

```typescript
// ❌ Manual string building
class=${`g-icon ${rotate ? "rotate" : ""} ${filled ? "filled" : ""}`}

// ✅ Declarative and clean
import { classMap } from "lit/directives/class-map.js";

class=${classMap({
  "g-icon": true,
  rotate: this.isRotating,
  filled: this.isFilled,
})}
```

### 9.4 Lifecycle Hooks — Know Your Options

| Hook                   | When                                     | Use for                                       |
| ---------------------- | ---------------------------------------- | --------------------------------------------- |
| `connectedCallback`    | Element added to DOM                     | Event listeners, observers, one-time setup    |
| `disconnectedCallback` | Element removed from DOM                 | Cleanup: remove listeners, cancel timers      |
| `willUpdate(changed)`  | Before rendering, after property changes | Deriving state, computing classes, validation |
| `firstUpdated`         | After first render only                  | Measuring DOM, focusing inputs                |
| `updated(changed)`     | After every render                       | Post-render DOM work (scrolling, animations)  |

**Rules of thumb:**

- `willUpdate` > `updated` for derived state — it runs before paint.
- Always pair `connectedCallback` setup with `disconnectedCallback` teardown.
- Never read layout in `willUpdate` (DOM isn't updated yet).

```typescript
connectedCallback() {
  super.connectedCallback();
  this.#resizeObserver = new ResizeObserver(this.#onResize);
  this.#resizeObserver.observe(this);
}

disconnectedCallback() {
  super.disconnectedCallback();
  this.#resizeObserver?.disconnect();
}
```

### 9.5 Custom Events — The `eventInit` + `static eventName` Pattern

Every event class uses a shared `eventInit` object
(`{ bubbles: true, cancelable: true, composed: true }`) and a `static eventName`
for listener registration. This is non-negotiable for Shadow DOM traversal.

```typescript
const eventInit = { bubbles: true, cancelable: true, composed: true };

export class BoardSaveEvent extends Event {
  static eventName = "bbboardsave";

  constructor(public readonly url: string) {
    super(BoardSaveEvent.eventName, { ...eventInit });
  }
}
```

**Why `composed: true`?** Without it, events dispatched inside Shadow DOM stop
at the shadow boundary. Every component in this codebase uses Shadow DOM, so
every event that needs to reach a parent must be composed.

**Why `static eventName`?** It provides a single source of truth for the string.
Listeners use `BoardSaveEvent.eventName` instead of a magic string.

### 9.6 The `StateEvent` Type-Safe Event Bus

For cross-cutting events that flow through the SCA system, use the typed
`StateEvent<T>` class. The discriminated union `StateEventDetailMap` ensures
that every event type has a known payload shape.

```typescript
// Dispatching — the detail type is enforced by the generic
this.dispatchEvent(new StateEvent(new Board.Create({ title: "My Board" })));

// Receiving — evt.detail is fully typed
async (evt?: StateEvent<"board.create">): Promise<void> => {
  const { title } = evt!.detail; // type-safe access
};
```

### 9.7 `@property()` vs `@state()` — Public API vs Internal

`@property()` is the component's public API — attributes that consumers set.
`@state()` (or private fields) is internal rendering state.

```typescript
@customElement("my-widget")
class MyWidget extends LitElement {
  // Public — consumers set this via HTML or JS
  @property({ type: Boolean, reflect: true })
  accessor active = false;

  // Internal — only this component manages it
  @state()
  accessor #menuOpen = false;
}
```

Use `reflect: true` sparingly — only when the attribute needs to be visible in
the DOM for CSS selectors (`:host([active])`) or accessibility.

### 9.8 CSS: `static styles` Is the Only Way

Lit's `static styles` property enables style sharing and adoptedStyleSheets for
performance. Never use inline `<style>` tags in templates.

```typescript
// ❌ Inline styles — re-parsed every render
render() {
  return html`<style>.foo { color: red }</style><div class="foo">...</div>`;
}

// ✅ Static — parsed once, shared across instances
static styles = css`
  :host {
    display: block;
  }

  .foo {
    color: var(--my-color, red);
  }
`;
```

**CSS custom properties** are the theming API. Expose `--bb-*` variables from
`:host` and consume them internally. This is how child components inherit design
tokens without prop-drilling styles.

---

## The Short Version

> **Say what you mean.** Type parameters over casts. Static imports over
> dynamic. Definite assignment over optional chaining. Outcomes over exceptions.
> Thin components over fat ones. Named patterns over anonymous fixes.
>
> If the compiler can check it, let it. If a human can name it, name it. If a
> tool can enforce it, write the rule.
