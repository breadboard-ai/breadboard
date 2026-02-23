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
│   ~~MutableGraphImpl (inspector layer, non-reactive)~~           │
│   ~~├─ .graph     → GraphDescriptor (duplicated)~~               │
│   ~~(deleted — GraphController now IS the MutableGraph)~~         │
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
| `packages/visual-editor/src/engine/inspector/graph/mutable-graph.ts`                        | ~~Deleted~~ — was `MutableGraphImpl`, now `GraphController`       |
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

### Phase 2: Migrate away from inspector classes

Replace `editor.inspect()` call sites with direct `GraphController` access, then
delete the inspector layer wholesale.

> **Strategy**: Migrate outside-in. `GraphQueries` is internal plumbing consumed
> only by `Graph` and `Node` — it gets swept away automatically once nothing
> calls `editor.inspect()`.

**Stage 1 — Simple cache hits** (done)

- [x] Remove `MutableGraphImpl` class, dead `dryRun` code, relocate factory to
      test helpers
- [x] Replace 5 `editor.inspect().nodeById()` calls inside `GraphController`
      with `this.nodes.get()` / `this.graph`

**Stage 2 — Enrich `GraphController` API**

- [x] Add `inspect(graphId)` method backed by `new Graph(graphId, this)` —
      `GraphController` IS a `MutableGraph`, so `Graph`/`Node` work
      out-of-the-box
- [x] Write tests for `inspect()` (main graph, sub-graphs, node methods) and
      `getFilteredComponents`
- 2 internal calls (`getRoutes`, `#updateComponents`) still use
  `_editor.inspect()` because they run during `setEditor()` before
  `initialize()` populates caches. These will be migrated when
  `setEditor + initialize` lifecycle is unified.

**Stage 3 — Migrate consumers + delete**

All consumers call `editor.inspect(graphId)` → `InspectableGraph`. With
`graphController.inspect(graphId)` available, these can switch to
`controller.editor.graph.inspect(graphId)` instead.

- [x] Migrate `node-actions.ts` (8 calls: `autoname`, `onNodeChange`,
      `onMoveSelection`, `onDelete`, `onSelectAll`, `onCopy`, `onCut`,
      `onPaste`/`onDuplicate`)
- [x] Migrate `graph-actions.ts` (1 call: `replaceWithTheme`)
- [x] Migrate `graph-editing-chat.ts` (1 call)
- [x] Migrate `graph-utils.ts` (7 functions accept `InspectableGraph` — these
      accept `graphController.inspect()` output unchanged since it returns the
      same `InspectableGraph` type; no changes needed)
- [x] Migrate 2 remaining internal `_editor.inspect()` calls in
      `GraphController` (`getRoutes`, `#updateComponents`) — uses
      `this.inspect("")` directly; `_editor.inspect()` fallback removed
- [x] Verify build + tests pass

**Stage 4 — Relocate utility functions out of inspector layer**

Move standalone utility functions so the inspector directory becomes
self-contained (only `Graph`, `Node`, `DescribeResultCache` remain, consumed
solely by `GraphController.inspect()`).

- [x] Move `routesFromConfiguration()` + `toolsFromConfiguration()` from
      `graph-queries.ts` → `utils/control.ts`
- [x] Move `fixUpStarEdge()` + `unfixUpStarEdge()` + `fixupConstantEdge()` from
      `edge.ts` → `engine/editor/operations/edge-utils.ts` [NEW]
- [x] Move `GraphDescriptorHandle` from `inspector/graph/` →
      `engine/editor/graph-descriptor-handle.ts` [MOVED, original deleted]
- [x] Verify inspector files are now internal-only: `graph-queries.ts` and
      `edge.ts` still provide `Edge`/`GraphQueries` classes used by
      `graph.ts`/`node.ts`; they will be deleted with the inspector layer
- [x] Verify build + tests pass

### Phase 3: Signal-Backed Describe + Event Elimination

Make `GraphController` fully reactive by absorbing describe refresh and
eliminating the event bridge. `EditableGraph` stays as a mutation/validation API
— the focus is on shifting the underlying model.

> **Key insight**: `DescribeResultCache` was the last piece not owned by
> `GraphController`. With it absorbed, `GraphController` has full control over
> all derived state (nodes, graphs, tools, components, describe). The next step
> is eliminating the event bridge so `EditableGraph` calls `GraphController`
> directly.

**Stage 1 — Absorb `DescribeResultCache` into `GraphController`** ✅

- [x] Define `NodeDescriber` function type (SCA Service→Controller boundary)
- [x] Create signal-backed `NodeDescribeEntry` class (replaces cache entries)
- [x] Replace `MutableGraph.describe` field with `describeNode()` method
- [x] Remove `InspectableDescriberResultCache` types from `@breadboard-ai/types`
- [x] `GraphController` owns `#describeEntries` map, `describeNode()`,
      `#refreshDescribers()`, and accepts `NodeDescriber` in `initialize()`
- [x] Build `NodeDescriber` closure in `initialize-editor.ts` from
      `getHandler` + `sandbox` (avoids circular deps)
- [x] Update `Node` class to use `describeNode()` instead of `describe.get()`
- [x] Delete `describe-cache.ts`
- [x] Verify build + tests pass

**Stage 2 — Eliminate event bridge**

Have `EditableGraph` call `GraphController` methods directly instead of firing
`graphchange`/`graphchangereject` events. `GraphController.setEditor()` stops
adding event listeners.

- [ ] Add direct notification methods on `GraphController`
- [ ] Wire `EditableGraph` to call them instead of dispatching events
- [ ] Remove event listener setup in `setEditor()`
- [ ] Remove `ChangeEvent` / `ChangeRejectEvent` classes
- [ ] Verify build + tests pass

**Stage 3 — Migrate remaining `editor?.inspect()` UI calls**

~5 UI components still call `editor?.inspect("")` (via `EditableGraph`) instead
of `graphController.inspect()`.

- [ ] Migrate `entity-editor.ts`, `renderer.ts`, `canvas-controller.ts`
- [ ] Verify build + tests pass

**Stage 4 — (Optional) Flatten `EditableGraph` into Actions**

With events gone, `EditableGraph` is just validation + history. Flattening it
into SCA Actions becomes trivial and optional.

- [ ] Move edit history into `HistoryController`
- [ ] Convert `EditOperation`s into SCA Actions
- [ ] Remove `EditableGraph` class
- [ ] Update/deprecate `EditableGraph` type in `@breadboard-ai/types`
