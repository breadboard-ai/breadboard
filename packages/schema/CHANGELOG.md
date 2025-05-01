# @google-labs/breadboard-schema

## 1.14.0

### Minor Changes

- 228d3c4: Start showing parameters in various UI surfaces.
- 470e548: Start landing connector infrastructure.
- 26fdb89: Add support for tools in connectors.
- 7c6388f: Disable autonaming once user edits title/description.
- 34e24f0: Implement MCP connector.
- da380d1: Teach params about modalities and sample values.
- 7b67a8c: Introduce Edge metadata.
- 27b9c34: Unify the create and app views
- 9f87f37: First complete rev of Connector machinery.
- eef58fa: Add `assets` and `assetEdge` to `InspectableGraph`.

## 1.13.0

### Minor Changes

- b852b6c: Update app view

### Patch Changes

- 4ed89ea: Teach asset organizer et al about YouTube videos
- 44fb75c: Prototype generating preview assets

## 1.12.0

### Minor Changes

- a2e7a36: Add support for {{asset}} and {{in}} params in A2.
- eaef053: Add support for private boards.
- 0b1dc88: Introduce `GraphDescriptor.imports` and start using it in modules.
- b93a70f: Introduce a more flexible way to tag and curate components.
- 9ade1ed: Add asset type to distinguish between different kinds of graph
  assets.

### Patch Changes

- 2144bc3: Teach Edit API about editing assets.
- 782b7e4: Improve the app chat UI
- bdf469e: Make unified server run in dev mode.

## 1.11.0

### Minor Changes

- a8eccc4: Add various improvements to board navigation

### Patch Changes

- 4a898eb: Introduce `GraphStore.graphs()`.
- df9b8b9: Support subgraph visual controls

## 1.10.0

### Minor Changes

- c75e26f: Introduce Imperative Graphs.
- 9d5f11b: Convert existing declarative kits to BGL.

### Patch Changes

- ca466cd: Plumb probe events (node/graph start/end) for runModule.
- 19fc2d0: Teach EditSpec to add & remove modules

## 1.9.0

### Minor Changes

- e014e42: Introduce "component" tag and user custom kits.

### Patch Changes

- 2d5b24e: Add description to module

## 1.8.1

### Patch Changes

- 7921983: Introduce `@breadboard-ai/types` package.

## 1.8.0

### Minor Changes

- 8540b93: Convert Content to Build API and merge Specialist 2 to Specialist.

### Patch Changes

- 8d06f3c: Introduce GraphMetadata.visual.window.

## 1.7.0

### Minor Changes

- c397d53: Add support for multiple graph entry points and start tags.

## 1.6.0

### Minor Changes

- 2312443: Add support for `deprecated` and `experimental` tags on Kits.

## 1.5.1

### Patch Changes

- dd783e0: Add analyzeIsJsonSubSchema function
- 3aba1a4: Improve subschema checking of properties and additionalProperties

## 1.5.0

### Minor Changes

- 7af14cf: Add support for comment nodes
- 511bd9b: Add `tags` to `GraphMetadata`.
- 431fa3d: Add support for website embeds of boards & YouTube videos

### Patch Changes

- 3d7b4a7: Introduce optional `help` metadata for graphs and kits.
- cd73b17: Switch to Nodejs v20.14.0 as the baseline.
- fcef799: Update `help` to have description and URL

## 1.4.1

### Patch Changes

- 416aed2: Introduce `metadata` for `NodeHandler` entries, teaching node types
  in Kits to describe themselves.

## 1.4.0

### Minor Changes

- f005b3b: Introduce `load` API for kits.
- 9b8e732: replace schema with version generated from TS source
- efeb1a3: Add `NodeMetadata.visual` field.

### Patch Changes

- 4a4a1f6: Place unfinished sidecar events at the bottom of the event list.
- eabd97b: Introduce the concept of log levels in Run Inspector API.

## 1.3.0

### Minor Changes

- ee00249: Introduce `NodeMetadata`.
- 5a65297: Add TypeScript types for Breadboard graphs in schema package

## 1.2.0

### Minor Changes

- e7be365: add json export to schema package
- f6a7f43: Add schemas to serialised boards

## 1.1.0

### Minor Changes

- 3972f17: correct schema ID and update plumbing

## 1.0.0

### Major Changes

- 6e8c08d: initial independent version of schema
