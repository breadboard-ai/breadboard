# Actions Layer

> **Cross-cutting business logic** — Functions that orchestrate Services and Controllers.

Actions are the "verbs" of the application. They coordinate multi-step workflows that touch multiple services and controllers.

---

## The Golden Rule

> **Action = Services + Controllers**

- If logic only touches **one Controller**: make it a Controller method
- If logic coordinates **Services AND Controllers**: make it an Action
- If logic only uses **Services**: consider if it belongs in the Service itself

This prevents "action bloat" and keeps state transformation close to the state.

---

## How Actions Work

### The Binder Pattern

Actions use a **dependency injection pattern** via `makeAction()`. Dependencies (controller, services) are injected at bootstrap, then accessed via Proxy:

```typescript
// In graph-actions.ts
import { makeAction } from "../binder.js";

export const bind = makeAction();

export async function addNode(node: NodeDescriptor, graphId: string) {
  const { controller, services } = bind;  // Accessed via Proxy

  // Use services for infrastructure
  const store = services.graphStore;

  // Mutate controller state
  await controller.editor.graph.editor?.edit([
    { type: "addnode", graphId, node }
  ], `Add step: ${node.id}`);
}
```

### Registration at Bootstrap

Actions are bound during SCA initialization in `sca.ts`:

```typescript
const actions = Actions.actions(controller, services);
// Now actions.graph.addNode() is callable
```

---

## Semantic Named Actions

**Prefer descriptive action names** over generic `edit()` calls:

```typescript
// ✅ Good: Semantic name reveals intent
await sca.actions.graph.addNode(node, graphId);
await sca.actions.graph.changeEdge("add", edge);
await sca.actions.graph.moveSelectionPositions(updates);

// ❌ Avoid: Generic edit hides intent
await sca.actions.graph.edit([{ type: "addnode", ... }], "Add");
```

**Benefits:**
- **Clarity**: Action names reflect user intent
- **Business Logic**: Coordinate metadata, validation, grid snapping in one place
- **Testability**: Specific actions are easier to unit test

---

## Available Actions

### Graph Actions (`sca.actions.graph`)

| Action | Purpose |
|--------|---------|
| `addNode(node, graphId)` | Add a node to the graph |
| `changeEdge(type, from, to?)` | Add, remove, or move an edge |
| `changeNodeConfiguration(...)` | Update node config, trigger autonaming |
| `moveSelectionPositions(updates)` | Move nodes/assets, handles metadata merge |
| `changeAssetEdge(type, edge)` | Add or remove asset edge |
| `updateBoardTitleAndDescription(...)` | Update graph metadata |
| `undo()` / `redo()` | Edit history navigation |
| `replace(graph, creator)` | Replace entire graph |

### Board Actions (`sca.actions.board`)

| Action | Purpose |
|--------|---------|
| `load(url, options?)` | Load a board from URL (resolves, validates, sets up graph) |
| `close()` | Close current board and return to home state |
| `save(messages?)` | Save current board to board server |
| `saveAs(graph, messages)` | Save current graph as a new board |
| `deleteBoard(url, messages)` | Delete a board from the board server |

---

## Creating a New Action

### 1. Add to the appropriate domain file

```typescript
// In actions/graph/graph-actions.ts

export async function myNewAction(param: string) {
  const { controller, services } = bind;

  // Validate
  if (!controller.editor.graph.editor) {
    throw new Error("No active graph");
  }

  // Coordinate services
  const result = await services.someService.doWork(param);

  // Mutate state
  controller.editor.graph.someSignal = result;

  // Notify user
  controller.global.toasts.toast("Done!");
}
```

### 2. Export from the actions module

The action is automatically available via `sca.actions.graph.myNewAction()`.

---

## Action vs Trigger: When to Use Each

| Use Case | Pattern |
|----------|---------|
| User-initiated workflow (button click) | **Action** |
| Response to state change (reactive) | **Trigger** |
| Async lifecycle notifications (Saving... → Saved!) | **Action** (direct snackbar calls) |
| Background detection (new version available) | **Trigger** (reactive to source version signal) |

---

## Directory Structure

```
actions/
├── actions.ts          # AppActions interface & factory
├── binder.ts           # makeAction() dependency injection
├── board/
│   └── board-actions.ts    # Board lifecycle actions
└── graph/
    └── graph-actions.ts    # Graph mutation actions
```

---

## Error Handling

Actions should throw meaningful errors that can be caught by the caller:

```typescript
export async function editGraph(spec: EditSpec[], label: string) {
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
```

Callers can then handle errors appropriately:

```typescript
try {
  await sca.actions.graph.addNode(node, graphId);
  sca.controller.global.toasts.toast("Node added!");
} catch (err) {
  sca.controller.global.snackbars.snackbar({
    type: "ERROR",
    message: err.message,
  });
}
```
