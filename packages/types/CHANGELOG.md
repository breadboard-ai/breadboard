# @breadboard-ai/types

## 0.7.0

### Minor Changes

- 228d3c4: Start showing parameters in various UI surfaces.
- 470e548: Start landing connector infrastructure.
- 81d2666: Land early (mostly stubs) listification bits.
- 26fdb89: Add support for tools in connectors.
- 8cffe63: More progress on listification.
- 7c6388f: Disable autonaming once user edits title/description.
- 34e24f0: Implement MCP connector.
- da380d1: Teach params about modalities and sample values.
- 7b67a8c: Introduce Edge metadata.
- 27b9c34: Unify the create and app views
- 9f87f37: First complete rev of Connector machinery.
- eef58fa: Add `assets` and `assetEdge` to `InspectableGraph`.

## 0.6.0

### Minor Changes

- b852b6c: Update app view
- a09a9c3: Introduce "Go over a list" step in A2.

### Patch Changes

- 4ed89ea: Teach asset organizer et al about YouTube videos
- 44fb75c: Prototype generating preview assets

## 0.5.0

### Minor Changes

- a2e7a36: Add support for {{asset}} and {{in}} params in A2.
- eaef053: Add support for private boards.
- 0b1dc88: Introduce `GraphDescriptor.imports` and start using it in modules.
- b93a70f: Introduce a more flexible way to tag and curate components.
- 9ade1ed: Add asset type to distinguish between different kinds of graph
  assets.
- 12aea89: CAtch up to the latest Gemini LLMContent types.

### Patch Changes

- 2144bc3: Teach Edit API about editing assets.
- 782b7e4: Improve the app chat UI
- 83a5186: Fix a typo.

## 0.4.0

### Minor Changes

- a8eccc4: Add various improvements to board navigation

### Patch Changes

- 4a898eb: Introduce `GraphStore.graphs()`.
- 7ea05ca: Remove the use of `inspect` inside `packages/breadboard`.
- 96b0597: Introduce `GraphStore`: a top-level holder of all boards.
- df9b8b9: Support subgraph visual controls

## 0.3.0

### Minor Changes

- c75e26f: Introduce Imperative Graphs.
- 9d5f11b: Convert existing declarative kits to BGL.

### Patch Changes

- ca466cd: Plumb probe events (node/graph start/end) for runModule.
- 19fc2d0: Teach EditSpec to add & remove modules

## 0.2.0

### Minor Changes

- e014e42: Introduce "component" tag and user custom kits.
- 661beea: Introduce `module` property

### Patch Changes

- 2d5b24e: Add description to module

## 0.1.2

### Patch Changes

- 7adeed8: Move LLMContent to types package.

## 0.1.1

### Patch Changes

- d20e867: Delete packageConfig from package.json

## 0.1.0

### Minor Changes

- 7921983: Introduce `@breadboard-ai/types` package.
