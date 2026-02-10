# A2UI: Architecture and Design Guide

Last Updated: 2026-02-10

A2UI (**Application-to-UI**) is a **server-driven UI rendering system**. A server describes a UI as a stream of messages — component trees and data model updates — and A2UI materializes those descriptions into a live, interactive web interface. The client never decides _what_ to show; it only decides _how_ to show it.

---

## 1. Core Concepts

### 1.1 The Mental Model

Think of A2UI as a **declarative rendering pipeline**:

```
Server Messages → ModelProcessor → Surfaces → Lit Components → DOM
```

1. The **server** sends `ServerToClientMessage` objects describing components and
   data.
2. The **ModelProcessor** consolidates those messages into `Surface` objects —
   each surface is a self-contained UI with its own component tree and data
   model.
3. **Lit web components** render the component tree into the DOM.
4. **User actions** (button clicks, form input) flow back up as
   `ClientToServerMessage` objects.

### 1.2 Versioning

A2UI is versioned under `0.8/`. All imports go through the barrel:

```ts
import { v0_8 } from "../../a2ui/index.js";
// Access: v0_8.UI, v0_8.Types, v0_8.Data, v0_8.Events, etc.
```

This allows future breaking changes to coexist with older versions during
migration.

---

## 2. The Data Layer

### 2.1 ModelProcessor

`A2UIModelProcessor` is the heart of A2UI's data processing. It maintains a
`Map<SurfaceID, Surface>` and processes four message types:

| Message              | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `beginRendering`     | Creates a new surface with a root component ID       |
| `surfaceUpdate`      | Adds/updates component instances on a surface        |
| `dataModelUpdate`    | Updates the data model (key-value store) for binding  |
| `deleteSurface`      | Removes a surface                                    |

After processing, each `Surface` contains:

- `rootComponentId` — the entry point of the component tree
- `componentTree` — a fully resolved `AnyComponentNode` tree (recursive)
- `dataModel` — a `DataMap` for data binding lookups
- `components` — the raw `ComponentInstance` map
- `styles` — surface-level style overrides (e.g. `primaryColor`, `font`,
  `logoUrl`)

#### Key Design Decision: Constructor-Injected Collections

The `ModelProcessor` accepts constructor options for `Map`, `Array`, `Set`, and
`Object` constructors. This is how **signal reactivity** is achieved without the
processor knowing anything about signals:

```ts
// Non-reactive (tests, server-side):
new A2UIModelProcessor(); // uses plain Map, Array, Set, Object

// Reactive (UI):
new A2UIModelProcessor({
  mapCtor: SignalMap,
  arrayCtor: SignalArray,
  setCtor: SignalSet,
  objCtor: SignalObject,
});
```

When the signal variants are injected, every mutation to the data model or
component tree automatically triggers reactive updates in any `SignalWatcher`
component that reads them. This is the **core reactivity mechanism** of A2UI.

### 2.2 Data Binding and Path Resolution

Components reference data via **paths** — slash-separated strings that address
locations in the data model (e.g. `/user/name`).

- **Absolute paths** (starting with `/`) are resolved from the data model root.
- **Relative paths** are resolved against the component's `dataContextPath`.
- The special path `.` refers to the component's own data context.

Primitive values use a union type to express the binding:

```ts
interface StringValue {
  path?: string;         // data binding reference
  literalString?: string; // hardcoded value
  literal?: string;       // shorthand alias
}
```

The `extractStringValue()` and `extractNumberValue()` utilities in
`ui/utils/utils.ts` resolve these to concrete values at render time.

### 2.3 Guards

`data/guards.ts` provides type guard functions for every resolved component type
(`isResolvedText`, `isResolvedImage`, etc.). The `ModelProcessor` uses these
during tree resolution to determine which component type a raw
`ComponentInstance` represents.

---

## 3. The Component System

### 3.1 Type Hierarchy

```
AnyComponentNode (discriminated union)
├── TextNode          { type: "Text",     properties: ResolvedText }
├── ImageNode         { type: "Image",    properties: ResolvedImage }
├── VideoNode         { type: "Video",    properties: ResolvedVideo }
├── AudioPlayerNode   { type: "AudioPlayer", ... }
├── IconNode          { type: "Icon",     ... }
├── DividerNode       { type: "Divider",  ... }
├── RowNode           { type: "Row",      properties: { children: AnyComponentNode[] } }
├── ColumnNode        { type: "Column",   properties: { children: AnyComponentNode[] } }
├── ListNode          { type: "List",     properties: { children: AnyComponentNode[] } }
├── CardNode          { type: "Card",     properties: { child, children } }
├── ButtonNode        { type: "Button",   properties: { child, action, primary? } }
├── TabsNode          { type: "Tabs",     properties: { tabItems: [...] } }
├── ModalNode         { type: "Modal",    properties: { entryPointChild, contentChild } }
├── CheckboxNode      { type: "CheckBox", ... }
├── TextFieldNode     { type: "TextField", ... }
├── DateTimeInputNode { type: "DateTimeInput", ... }
├── MultipleChoiceNode{ type: "MultipleChoice", ... }
├── SliderNode        { type: "Slider",   ... }
└── CustomNode        { type: string,     properties: CustomNodeProperties }
```

Each node has a `BaseComponentNode` with `id`, `weight?`, `dataContextPath?`,
and `slotName?`.

### 3.2 The Root Class

**`Root`** (`ui/root.ts`) is the base class for all A2UI components. It extends
`SignalWatcher(LitElement)` and provides:

| Property               | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `surfaceId`            | Which surface this component belongs to              |
| `component`            | The `AnyComponentNode` backing this element           |
| `childComponents`      | The node's children (set by parent's render switch)   |
| `processor`            | Reference to the `ModelProcessor` for data lookups    |
| `dataContextPath`      | The data binding context for path resolution          |
| `enableCustomElements` | Whether to render `CustomNode` types                  |
| `isMedia`              | Whether this component represents media content       |
| `weight`               | Flex weight (sets `--weight` CSS custom property)     |
| `theme`                | Consumed via `@lit/context` from the theme provider   |

#### Key Design Decision: Light DOM Rendering

> [!IMPORTANT]
> A2UI renders children into the **light DOM**, not the shadow DOM.

This is the most unusual and important architectural decision in A2UI. When a
component receives `childComponents`, Root's `willUpdate` sets up a **reactive
effect** that renders the child template into the element's own light DOM:

```ts
this.#lightDomEffectDisposer = reactive(() => {
  const allChildren = this.childComponents ?? null;
  const lightDomTemplate = this.renderComponentTree(allChildren);
  render(lightDomTemplate, this, { host: this });
});
```

**Why light DOM?** The primary motivation is **DOM interrogability**. With light
DOM rendering, any component can traverse its children directly via standard DOM
APIs (`this.children`, `querySelector`, etc.) without having to spelunk through
shadow roots. This makes content detection straightforward — for example,
Button's `detectMedia()` simply walks `el.children` recursively to find media
elements at any depth. If children were rendered into shadow DOM, this kind of
cross-component introspection would require complex shadow root traversal.

A secondary benefit is that CSS custom properties defined in a parent's shadow
DOM cascade naturally through light DOM children. This is how a Button's shadow
styles (e.g. `--a2ui-text-padding: 16px`) reach its child Text component.

**How it works:**
1. Parent component's shadow DOM contains a `<slot>`.
2. `willUpdate` imperatively renders children into the light DOM (the element
   itself).
3. Children are slotted into the shadow DOM's `<slot>`, appearing visually
   inside the parent while remaining structurally accessible in the light DOM
   tree.
4. The `reactive()` wrapper creates a signal effect — when any signal read
   during rendering changes (e.g. a `SignalMap` entry), the effect re-runs.

#### The `renderComponentTree` Switch

Root contains a ~370-line `switch` statement that maps each `AnyComponentNode`
type to its corresponding Lit template. This is the single place where the
component type → HTML element mapping lives.

For **built-in types** (`Text`, `Image`, `Button`, etc.), the switch uses
declarative Lit templates:

```ts
case "Image": {
  const node = component as NodeOfType<"Image">;
  return html`<a2ui-image
    .url=${node.properties.url ?? null}
    .isMedia=${true}
  ></a2ui-image>`;
}
```

For **custom types** (the `default:` case), it imperatively creates elements via
`customElements.get(component.type)` and sets properties programmatically.

### 3.3 Component Patterns

All A2UI components follow a consistent pattern:

1. **Extend `Root`** - inherits the full property set and light DOM rendering.
2. **Define own `@property()` fields** - for component-specific data.
3. **Define `static styles`** - with CSS custom properties for theming.
4. **Implement `render()`** - the shadow DOM template (typically a `<section>`
   or semantic element wrapping a `<slot>`).

```ts
@customElement("a2ui-column")
export class Column extends Root {
  @property({ reflect: true })
  accessor alignment: "start" | "center" | "end" | "stretch" = "stretch";

  static styles = [css`
    :host { display: flex; flex: var(--weight); }
    section {
      display: flex;
      flex-direction: column;
      gap: var(--a2ui-column-gap, var(--a2ui-spacing-4));
    }
  `];

  render() {
    return html`<section><slot></slot></section>`;
  }
}
```

**Layout components** (Column, Row, List) receive `childComponents` from the
parent and re-render them into their own light DOM via the inherited Root
mechanism, then project them via `<slot>`.

**Leaf components** (Text, Image, Video, Icon) resolve their data bindings in
`render()` and produce final DOM.

---

## 4. The Theming System

### 4.1 Two-Layer Architecture

A2UI theming operates at two levels:

**Layer 1: Semantic Tokens** — global CSS custom properties set on the theme
host element. These cascade through the entire component tree:

```ts
const tokens: ThemeTokens = {
  "--a2ui-font-family": '"Helvetica Neue", sans-serif',
  "--a2ui-color-surface": "var(--light-dark-p-100)",
  "--a2ui-border-radius": "8px",
  "--a2ui-transition-speed": "0.2s",
  "--a2ui-button-radius": "var(--a2ui-border-radius-lg)",
  // ...
};
```

**Layer 2: Per-Component Overrides** — component-scoped CSS custom properties
applied via `@lit/context`:

```ts
overrides: {
  Button: {
    "--a2ui-button-bg": "var(--a2ui-color-primary)",
    "--a2ui-button-color": "var(--a2ui-color-on-primary)",
  },
  Card: {
    "--a2ui-card-bg": "var(--a2ui-color-surface)",
  },
}
```

### 4.2 CSS Custom Property Convention

Components reference tokens with **two-level fallbacks**:

```css
background: var(--a2ui-button-bg, var(--light-dark-n-100));
/*           ^^^^^^^^^^^^^^^^      ^^^^^^^^^^^^^^^^^^^^^
             theme/override        bare component default */
```

- The first `var()` reads the theme token/override.
- The inner fallback is the component's own default (used if no theme is
  applied).

### 4.3 Color Palettes

Colors use six tonal palettes with 18 shades each:

| Prefix | Palette          | Example key   |
| ------ | ---------------- | ------------- |
| `n`    | Neutral          | `--light-dark-n-95`  |
| `nv`   | Neutral Variant  | `--light-dark-nv-30` |
| `p`    | Primary          | `--light-dark-p-20`  |
| `s`    | Secondary        | `--light-dark-s-70`  |
| `t`    | Tertiary         | `--light-dark-t-50`  |
| `e`    | Error            | `--light-dark-e-40`  |

The `--light-dark-*` prefix is generated by `createThemeStyles()` and works with
CSS `light-dark()` for automatic dark mode support.

### 4.4 Component-Specific Token Patterns

Components that need configurable sub-properties expose their own scoped tokens.
The **Button** is the most elaborate example:

| Token                        | Controls                         | Default       |
| ---------------------------- | -------------------------------- | ------------- |
| `--a2ui-button-bg`           | Background color                 | `--light-dark-n-100` |
| `--a2ui-button-color`        | Text color                       | `light-dark(p-20, n-100)` |
| `--a2ui-button-radius`       | Border radius (theme token)      | `20px`        |
| `--a2ui-button-border`       | Default border (via `::after`)   | `none`        |
| `--a2ui-button-hover-border` | Hover border (via `::after`)     | `none`        |
| `--a2ui-button-hover-bg`     | Hover background                 | varies        |
| `--a2ui-button-text-padding` | Text child padding               | `--a2ui-spacing-4` |
| `--a2ui-button-image-padding`| Image child padding              | `0`           |

> [!TIP]
> The Button's border uses a `::after` pseudo-element overlay rather than a
> native `border` to avoid layout shifts when the border width changes on hover
> (e.g. 1px → 2px). The `pointer-events: none` on `::after` ensures clicks pass
> through.

---

## 5. The Event System

### 5.1 User Actions

When a user interacts with a component (e.g. clicks a Button), the component
dispatches a composed `StateEvent` that bubbles up through the DOM:

```ts
const evt = new StateEvent<"a2ui.action">({
  eventType: "a2ui.action",
  action: this.action,       // The Action definition from the component
  dataContextPath: this.dataContextPath,
  sourceComponentId: this.id,
  sourceComponent: this.component,
});
this.dispatchEvent(evt);
```

The event system is intentionally minimal — there is exactly one event type
(`a2ui.action`), keeping the client-server contract simple. The `Action` object
contains the action name and an optional context map with data bindings that get
resolved before sending.

### 5.2 Client-to-Server Messages

The consuming application listens for `StateEvent` and translates it into a
`ClientToServerMessage`:

```ts
interface ClientToServerMessage {
  userAction?: UserAction;
  clientUiCapabilities?: ClientCapabilities;
  error?: ClientError;
}
```

---

## 6. Custom Elements (Extensibility)

A2UI supports application-specific components via the **custom element
extension point**. When `enableCustomElements` is `true`, any `AnyComponentNode`
with a type not matching a built-in falls through to the `default:` case in
`renderComponentTree`.

### 6.1 Creating a Custom Element

Custom elements extend `Root` and register with a tag name matching the server's
component type:

```ts
@customElement("a2ui-custom-video")
export class A2UICustomVideo extends Root {
  @property()
  accessor fileUri: StringValue | null = null;

  override accessor isMedia = true; // Declare as media content

  render() {
    const url = extractStringValue(this.fileUri, this.component, this.processor, this.surfaceId);
    return html`<video src=${url} controls></video>`;
  }
}
```

**Key conventions:**
- Extend `Root` to inherit the full property set and light DOM rendering.
- Use `extractStringValue()` / `extractNumberValue()` for data binding
  resolution.
- Set `isMedia = true` if the element renders media content (this enables parent
  components like Button to detect media children).
- The `renderComponentTree` default case copies all `component.properties` onto
  the element instance, so any server-defined properties are automatically
  available.

### 6.2 The `isMedia` Property and Content Detection

The `isMedia` property on `Root` allows custom elements to declare themselves as
media content. This is used by the **Button** component to detect whether it
contains media children (directly or nested) and apply different styling.

Button uses a **`MutationObserver`** with `subtree: true` to watch for DOM
changes in its light DOM. When children are added, it recursively walks the DOM
tree checking `el.isMedia` on each `Root` instance:

```ts
function detectMedia(el: Element): boolean {
  if (el instanceof Root && el.isMedia) return true;
  for (const child of el.children) {
    if (detectMedia(child)) return true;
  }
  return false;
}
```

This solves a **timing issue**: because children render into the light DOM
asynchronously via reactive effects, a lifecycle-based approach (`updated()`)
would miss nested children that haven't rendered yet. The `MutationObserver`
fires reactively as the DOM is populated at any depth.

---

## 7. The Surface Component

`Surface` is the top-level rendering entry point. It receives a `SurfaceState`
and:

1. Optionally renders a logo from `surface.styles.logoUrl`.
2. Generates inline styles from `surface.styles` (e.g. `primaryColor` →
   `--p-*` palette, `font` → `--font-family`).
3. Renders an `<a2ui-root>` with the component tree.

```ts
html`<a2ui-root
  .surfaceId=${this.surfaceId}
  .processor=${this.processor}
  .childComponents=${this.surface.componentTree}
  .enableCustomElements=${this.enableCustomElements}
></a2ui-root>`;
```

---

## 8. Architectural Invariants

### 8.1 Reactivity Flows Downward

The signal-backed `ModelProcessor` is the single source of truth. Components
read from it (creating signal subscriptions) and display the results. User
interactions flow back to the server via events, and the server sends updated
messages, completing the loop.

Components **never mutate** the component tree directly. They may call
`processor.setData()` for form-like components (Checkbox, TextField, Slider),
but this writes back into the data model — not the component tree.

### 8.2 CSS Custom Properties Cascade Through Light DOM

This is the fundamental reason for the light DOM rendering strategy. It enables:
- Parent components (Button) to override child styling (Text padding, Image
  radius).
- Theme tokens to cascade without explicit prop drilling.
- Spacing tokens (e.g. `--a2ui-column-gap`) to be overridden by context.

### 8.3 Every Component Gets the Full Root Property Set

Even leaf components receive `processor`, `surfaceId`, `dataContextPath`, etc.
— even if they don't use them. This keeps the rendering switch uniform and
allows any component to resolve data bindings at any point in the tree.

---

## 9. Known Inconsistencies and Improvement Opportunities

### 9.1 Text Resolves Data inline; Other Components Use Utils

`Text` resolves its `StringValue` directly in `#renderText()` with inline logic,
while `Image` also resolves inline. Meanwhile, the custom element example uses
`extractStringValue()` from `ui/utils/utils.ts`. The recommendation is to
consolidate data binding resolution through the utility functions for
consistency.

### 9.2 `.model` vs `.processor` on Text

In `renderComponentTree`, the `Text` case passes both `.model=${this.processor}`
and `.processor=${this.processor}`. The `.model` property is not declared on
`Text` or `Root` — this appears to be dead code and should be removed.

### 9.3 Inconsistent `dataContextPath` Defaults

Some components in the render switch default `dataContextPath` to `""`:

```ts
.dataContextPath=${node.dataContextPath ?? ""}
```

Others pass it through without a default:

```ts
.dataContextPath=${node.dataContextPath}
```

This could cause subtle issues if a component expects a string but receives
`undefined`. A consistent default policy would improve reliability.

### 9.4 The Image `section` Has `object-fit: cover`

In `image.ts`, the `<section>` element has `object-fit: cover`, which has no
effect on a `<section>` (it only applies to replaced elements like `<img>` and
`<video>`). The `object-fit` should be on the `img` rule instead.

### 9.5 Two `UserAction` Types

There are two `UserAction` interfaces — one in `types/types.ts` and one in
`types/client-event.ts`. They have slightly different shapes (the types.ts
version has `actionName` while client-event.ts has `name`; client-event.ts has
`surfaceId` while types.ts does not). This duplication could cause confusion.

---

## 10. File Map

```
a2ui/
├── index.ts                    # Top-level barrel: exports v0_8
└── 0.8/
    ├── index.ts                # Version barrel: Data, Events, Types, UI, Schemas
    ├── data/
    │   ├── model-processor.ts  # Core: message processing, tree resolution, data model
    │   ├── signal-model-processor.ts  # Factory: injects SignalMap/Array/Set/Object
    │   └── guards.ts           # Type guards for resolved component types
    ├── events/
    │   ├── base.ts             # BaseEventDetail<EventType> interface
    │   ├── a2ui.ts             # A2UIAction event detail
    │   └── events.ts           # StateEvent class, global event map registration
    ├── schemas/
    │   └── server_to_client_with_standard_catalog.json  # JSON Schema
    ├── styles/
    │   ├── index.ts            # Barrel
    │   ├── tokens.ts           # TOKENS const, ThemeTokens type, applyTokens()
    │   └── utils.ts            # createThemeStyles(), toProp() for color palettes
    ├── types/
    │   ├── primitives.ts       # StringValue, NumberValue, BooleanValue
    │   ├── components.ts       # Raw component interfaces (Text, Image, Action, etc.)
    │   ├── types.ts            # Resolved types, AnyComponentNode union, Surface, Theme
    │   ├── colors.ts           # ColorPalettes, PaletteKeyVals, shades
    │   └── client-event.ts     # ClientToServerMessage, ClientCapabilities
    └── ui/
        ├── ui.ts               # UI barrel, tag name map, instanceOf() factory
        ├── root.ts             # Base class: light DOM rendering, reactive effect
        ├── surface.ts          # Top-level: Surface → Root + styles + logo
        ├── text.ts             # Text with markdown rendering
        ├── image.ts            # Image with URL resolution
        ├── video.ts            # Video player
        ├── audio.ts            # Audio player
        ├── icon.ts             # Material icon
        ├── button.ts           # Button with action dispatch, media detection
        ├── card.ts             # Card container
        ├── column.ts           # Vertical flex layout
        ├── row.ts              # Horizontal flex layout
        ├── list.ts             # List layout
        ├── tabs.ts             # Tabbed view
        ├── modal.ts            # Modal dialog with entry point
        ├── checkbox.ts         # Checkbox input
        ├── text-field.ts       # Text input
        ├── datetime-input.ts   # Date/time picker
        ├── multiple-choice.ts  # Multiple choice selector
        ├── slider.ts           # Range slider
        ├── divider.ts          # Visual separator
        ├── context/
        │   └── theme.ts        # Lit context for Theme
        ├── directives/
        │   ├── directives.ts   # Barrel
        │   ├── markdown.ts     # Markdown rendering directive
        │   └── sanitizer.ts    # HTML sanitization
        └── utils/
            └── utils.ts        # extractStringValue(), extractNumberValue()
```
