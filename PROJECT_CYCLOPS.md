# Project: Inspector → Controller Absorption

> Reimagining the inspector graph layer (`MutableGraphImpl`, `Graph`, `Node`,
> `Edge`, `GraphQueries`, `DescribeResultCache`) as SCA controllers under
> `GraphController`.

## Architecture

### Current (two parallel systems)

```
┌─────────────────────────────────────────────────────────────────┐
│  SCA Layer                                                       │
│                                                                  │
│   GraphController (@field-backed reactive state)                 │
│   ├─ _graph: GraphDescriptor                                     │
│   ├─ version / topologyVersion                                   │
│   ├─ _myTools, _agentModeTools, _components                     │
│   └─ implements MutableGraphStore { set/get }                    │
│              │                                                    │
│              │ stores                                             │
│              ▼                                                    │
│   MutableGraphImpl (inspector layer, non-reactive)               │
│   ├─ .graph     → GraphDescriptor (duplicated)                   │
│   ├─ .graphs    → Graph (InspectableGraph per sub-graph)         │
│   ├─ .nodes     → Node (InspectableNode per node)                │
│   └─ .describe  → DescribeResultCache (signal-backed)            │
│              │                                                    │
│              │ used by                                            │
│              ▼                                                    │
│   EditableGraph (mutation API, edit operations, history)          │
│   ├─ .edit([specs]) → applies operations via context.mutable     │
│   ├─ .inspect(id)   → reads mutable.graphs.get()                 │
│   └─ fires graphchange/graphchangereject events                  │
└──────────────────────────────────────────────────────────────────┘
```

### Target (single reactive layer)

```
┌─────────────────────────────────────────────────────────────────┐
│  SCA Layer                                                       │
│                                                                  │
│   GraphController (implements MutableGraph directly)             │
│   ├─ @field graph: GraphDescriptor                               │
│   ├─ @field version / topologyVersion                            │
│   ├─ NodeController[]                                            │
│   │   ├─ @field describeResult (replaces DescribeResultCache)    │
│   │   ├─ ports (derived)                                         │
│   │   └─ incoming/outgoing edges (derived)                       │
│   ├─ EdgeController[]                                            │
│   ├─ SubgraphController[]                                        │
│   └─ AssetController[]                                           │
│              │                                                    │
│              │ satisfies MutableGraph contract                    │
│              ▼                                                    │
│   EditableGraph (unchanged initially, then → Actions)            │
│   ├─ takes GraphController as its MutableGraph                   │
│   └─ eventually inlined into SCA Actions                         │
└──────────────────────────────────────────────────────────────────┘
```

## Key Files

| File                                                                                        | Role                                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/visual-editor/src/engine/inspector/graph/mutable-graph.ts`                        | Current `MutableGraphImpl` — to be absorbed                       |
| `packages/visual-editor/src/engine/inspector/graph/graph.ts`                                | `InspectableGraph` per sub-graph — to become `SubgraphController` |
| `packages/visual-editor/src/engine/inspector/graph/node.ts`                                 | `InspectableNode` — to become `NodeController`                    |
| `packages/visual-editor/src/engine/inspector/graph/edge.ts`                                 | `InspectableEdge` — to become `EdgeController`                    |
| `packages/visual-editor/src/engine/inspector/graph/graph-queries.ts`                        | Stateless queries — to fold into controllers                      |
| `packages/visual-editor/src/engine/inspector/graph/describe-cache.ts`                       | Signal-backed cache — to become `@field` on `NodeController`      |
| `packages/visual-editor/src/engine/editor/graph.ts`                                         | `EditableGraph` — consumer of `MutableGraph`                      |
| `packages/visual-editor/src/sca/controller/subcontrollers/editor/graph/graph-controller.ts` | Target: absorbs all of the above                                  |
| `packages/visual-editor/src/sca/actions/board/helpers/initialize-editor.ts`                 | Creates `MutableGraphImpl` — will pass `GraphController` instead  |

## `MutableGraph` Interface Surface

The `MutableGraph` type contract that `EditableGraph` depends on:

```typescript
type MutableGraph = {
  graph: GraphDescriptor;
  readonly id: MainGraphIdentifier;
  readonly deps: GraphStoreArgs;
  readonly graphs: InspectableGraphCache; // .get(), .graphs()
  readonly nodes: InspectableNodeCache; // .get(), .nodes(), .byType()
  readonly describe: InspectableDescriberResultCache;
  readonly store: MutableGraphStore;
  update(graph, visualOnly, affectedNodes): void;
  rebuild(graph): void;
};
```

Only 2 of 18 edit operations touch `context.mutable` directly:

- `replace-graph.ts` → `rebuild()`
- `move-to-graph.ts` → `graphs.get()`

No consumers of `InspectableGraph`/`InspectableNode`/`InspectableEdge` exist
outside `visual-editor`.

## Phases

### Phase 1: `GraphController` implements `MutableGraph` ✅

Make `GraphController` satisfy the `MutableGraph` type contract directly, then
swap out the `MutableGraphImpl` instantiation in `initialize-editor.ts`.

- [x] Add `MutableGraph` fields to `GraphController` (`id`, `deps`, `graphs`,
      `nodes`, `describe`)
- [x] Implement `update()` and `rebuild()` on `GraphController`, delegating to
      existing `DescribeResultCache`, `Graph`, `Node` classes initially
- [x] Update `initialize-editor.ts` to pass `graphController` as the
      `MutableGraph` instead of creating `MutableGraphImpl`
- [x] Update `EditableGraph` constructor to receive `GraphController`
- [x] Verify build passes
- [x] Verify all tests pass

### Phase 2: Absorb `GraphQueries` + `Node` + `Edge`

Move query helpers and inspector classes into the controller layer.

- [x] Remove `MutableGraphImpl` class
  - Replaced with `createMutableGraph()` factory (test-only, in
    `tests/helpers/_mutable-graph.ts`)
  - Removed dead `dryRun` parameter from `EditableGraph.edit()`, editor
    implementation, and `editInternal` action
  - Deleted `src/engine/inspector/graph/mutable-graph.ts` — no production code
    references it
- [ ] Fold `GraphQueries` static methods into `GraphController`
- [ ] Create `NodeController` sub-controller with `@field describeResult`
- [ ] Create describe action + trigger (`Node.describe` action, fired on config
      change)
- [ ] Replace `Node` class consumers with `NodeController`
- [ ] Replace `Edge` class consumers with `EdgeController` (or inline)
- [ ] Migrate `editor.inspect(graphId).nodeById(id)` call sites to
      `graphController.nodeById(id, graphId)`
- [ ] Remove `Graph`, `Node`, `Edge`, `GraphQueries`, `DescribeResultCache`
      classes
- [ ] Verify build passes
- [ ] Verify all tests pass
- [ ] Write tests for `NodeController` describe reactivity

### Phase 3: Flatten `EditableGraph` → Actions

Move edit operations into SCA Actions, retire `EditableGraph`.

- [ ] Move edit history into `HistoryController`
- [ ] Convert each `EditOperation` into an SCA Action (add-node, remove-node,
      add-edge, remove-edge, change-configuration, etc.)
- [ ] Remove `graphchange`/`graphchangereject` event pattern (replaced by direct
      signal mutations)
- [ ] Remove `EditableGraph` class and `engine/editor/` directory
- [ ] Update `EditableGraph` type in `@breadboard-ai/types` or deprecate
- [ ] Verify build passes
- [ ] Verify all tests pass
- [ ] Write tests for edit actions
