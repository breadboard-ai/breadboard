# @breadboard-ai/types

## 0.9.0

### Minor Changes

- f7a7772: Introduce built-in Google Calendar MCP client.
- 342dbb8: Refactor MCP machinery to be tool-centric.
- d0458a0: Teach runtime about stop actions.
- fbeaf8f: Introduce "Run from here" capability.
- cc976c3: Refactor MCP infrastructure to be ready for built-in clients.
- 492e542: Add `info` value to Schema enums and use it to convey quota limits.
- 073a296: Plumb error handling to renderer and console for new runtime.
- 426ffce: Implement MCP support behind flag.
- 42d301f: Implement MCP Allow list.
- 2b801c3: Introduce `/mnt` root directory for mounting custom volumes to File
  System.
- c52549b: Initial support for action buttons in Visual Editor
- db11ca8: Introduce "Generate for each input" capability.
- 01cee42: Add step-by-step running mode in new runtime.
- e94bb52: Properly display status and react to actions.
- a74c8cf: Add support for built-in MCP Servers.
- 071b34d: Introduce "Save as code" capability behind flag.
- 0bc8d11: Teach new runtime to respond to graph topology changes.
- 82ba7de: Add `ALLOW_3P_MODULES` configuration setting (off by default).

### Patch Changes

- f609a62: Allow configuration from environment variables
- 48eb9b0: Introduce `/files` endpoint for storing/caching gallery results.
- 4166203: Remove the `RunStore` bits.
- b305c1b: Track updates via hashing
- 5143dad: Polish wiring states in the new runtime.
- ff1ce19: Show activity for edges and nodes.
- 5ba1719: Enable experimental 2D matrix rendering of graph
- 4d8a6fa: Close MCP clients at the end of each run.
- 1d6cb7b: Track opened versions for shared apps
- c0d18de: Incremental progress toward gallery cache
- 6d9a147: Add support for node-level actions
- f14f927: Remove Flash 2.0 from the model drop-down.
- 5e95de6: Add support for optional auth tokens for MCP servers.
- 32d90b3: Remove RunObsever machinery.

## 0.8.0

### Minor Changes

- f488e2b: Add runtime flags support and the first `usePlanRunner` flag.
- a7c691e: Introduce the concept of "start" nodes and stop running standalone
  nodes.

### Patch Changes

- 22b02b8: Factor runtime bits out of `breadboard` package.
- bb833fa: Update default app theme
- 9923fe0: improve theme gen

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
