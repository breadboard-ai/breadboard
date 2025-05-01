# Changelog

## 0.34.0

### Minor Changes

- 470e548: Start landing connector infrastructure.
- 81d2666: Land early (mostly stubs) listification bits.
- 26fdb89: Add support for tools in connectors.
- 9d75ab2: [a2] Switch tools to use the new backend API.
- e21ee39: Implement autonaming behind flag.
- 66a01e0: Make autoname more polite to user.
- fedacbd: Expose `/env/settings/general` to module file system and use it to
  hide experimental bits.
- 856c387: Introduce "Generate" step.
- e7abb8a: Add support for reactive ports.
- f11621f: Add `asType` flag for describers.
- a63fb1e: Switch Gemini API calls to use OAuth in A2.
- af10dc4: Introduce parameters infrastructure.
- a2d4ee5: Introduce `hint-chat-mode` behavior.
- 9203afc: Only allow invoking modules in A2.
- 7e17fe2: Teach Gemini API to flatten list if it seem them, and add tests.
- 0c6ad80: Plumb Graph metadata as `/env/metadata` and teach "Render Outputs" to
  use it to pick theme colors.
- a53adf0: Add support for system instruction in "Generate Text"
- 34e24f0: Implement MCP connector.
- 99a5d95: Teach fetch to handle streams and files.
- eba969c: Teach parameters to work in subgraphs.
- 8ce093a: Add "Create New Document" to Google Drive file picker and many other
  fixes.
- da380d1: Teach params about modalities and sample values.
- 7b67a8c: Introduce Edge metadata.
- f7bb416: Add support for images when saving to Google Drive.
- 10c7441: Introduce support for rich enum metadata.
- c8876ee: Polish parameters a bit.
- 9f87f37: First complete rev of Connector machinery.
- e58b680: Teach `RemotePartTransformer` to use main graph URL.
- eef58fa: Add `assets` and `assetEdge` to `InspectableGraph`.

### Patch Changes

- 0c0a419: Fix the describer crash.
- 97be783: Add assets to the graph
- 2eee8da: Add support for editing assets in the entity editor
- a564054: Make describer use a faster path for graphs with URLs.
- 0e6f849: Add a bit more robust error handling around capabilities.
- 2074b64: Teach deflate and llm-output to handle text/html mimeType
- da0a7a2: Filter assets that start "@@": these are internal to BGL.
- 410bc4e: Fix the bug where secrets are always asked for.
- ae68b4d: Correctly resolve subgraph URLs.
- b9681e9: Improve text-editor behaviors
- 0d0953e: Temporarily remove auth check from proxy requests.
- ec25bbe: Clear pending result in LocalRunner after resuming
- Updated dependencies [228d3c4]
- Updated dependencies [470e548]
- Updated dependencies [81d2666]
- Updated dependencies [26fdb89]
- Updated dependencies [856c387]
- Updated dependencies [e7abb8a]
- Updated dependencies [f11621f]
- Updated dependencies [a2d4ee5]
- Updated dependencies [8cffe63]
- Updated dependencies [0e6f849]
- Updated dependencies [7c6388f]
- Updated dependencies [a53adf0]
- Updated dependencies [34e24f0]
- Updated dependencies [99a5d95]
- Updated dependencies [da380d1]
- Updated dependencies [7b67a8c]
- Updated dependencies [f7bb416]
- Updated dependencies [10c7441]
- Updated dependencies [27b9c34]
- Updated dependencies [9f87f37]
- Updated dependencies [eef58fa]
  - @google-labs/breadboard-schema@1.14.0
  - @breadboard-ai/types@0.7.0
  - @breadboard-ai/jsandbox@0.6.0

## 0.33.0

### Minor Changes

- f466c2d: Add "custom tool" infrastructure (based on subgraphs)
- 3547630: Implement support for consuming Google Drive documents
- dd6b9c1: Teach board server about Gemini File API.
- b872936: Bug fixes plus teach "Make Image" and "Make Audio" to introduce
  themselves.
- a09a9c3: Introduce "Go over a list" step in A2.
- e8abf9f: Teach breadboard about default configuration.
- 1abb0e3: Allow connecting {{ in }} parms with wires.

### Patch Changes

- 4ed89ea: Teach asset organizer et al about YouTube videos
- 98f6609: Streamline new flow creation
- a638ffa: Additional plumbing to make assets work in all places.
- Updated dependencies [4ed89ea]
- Updated dependencies [b852b6c]
- Updated dependencies [44fb75c]
- Updated dependencies [e018c92]
- Updated dependencies [a09a9c3]
- Updated dependencies [1abb0e3]
  - @google-labs/breadboard-schema@1.13.0
  - @breadboard-ai/types@0.6.0
  - @breadboard-ai/jsandbox@0.5.0

## 0.32.0

### Minor Changes

- 2144bc3: Teach Edit API about editing assets.
- 59d6fe7: Store assets as references to blobs.
- 925e4bf: Introduce "main-port" behavior and start using it.
- c6f9889: Start all new graphs with a really blank template.
- a2e7a36: Add support for {{asset}} and {{in}} params in A2.
- 6b6052c: Support icons in custom component metadata.
- 65f89e0: Introduce Organizer to visual editor.
- 10fee14: Plumb `updating` flag to both `currentPorts` and `currentMetadata`.
- 0b1dc88: Introduce `GraphDescriptor.imports` and start using it in modules.
- 74124b8: Use "generative" icon in A2 components.
- 63a1930: Introduce presentation hints and icon on Schema.
- b93a70f: Introduce a more flexible way to tag and curate components.
- 8e2fc1f: Implement API that allows rendering Fast Access menu (fka "@" menu).

### Patch Changes

- 3af8f62: Introduce ChatController, an abstraction to manage chat state.
- 220f27a: A2-related UI polish
- 0ad7660: Improve home screen again
- 83bdea5: Show outputs in configurator
- e39ea7e: Add "Text" component.
- c9fc7b0: Add "Audio Generator" and {{param}} support to all components.
- 26b1194: Implement Get Weather tool.
- b17362c: Bug fixes in ChatController.
- 881f8ab: Teach replay about subgraphs.
- Updated dependencies [2144bc3]
- Updated dependencies [69d315b]
- Updated dependencies [925e4bf]
- Updated dependencies [a2e7a36]
- Updated dependencies [782b7e4]
- Updated dependencies [eaef053]
- Updated dependencies [0b1dc88]
- Updated dependencies [bdf469e]
- Updated dependencies [9fe7195]
- Updated dependencies [63a1930]
- Updated dependencies [b93a70f]
- Updated dependencies [9ade1ed]
- Updated dependencies [12aea89]
- Updated dependencies [83a5186]
  - @google-labs/breadboard-schema@1.12.0
  - @breadboard-ai/types@0.5.0
  - @breadboard-ai/jsandbox@0.4.0

## 0.31.0

### Minor Changes

- 25dd1c2: Introduce chiclets for board capabilities
- 45c7e5f: Make `MutableGraph` the actual store of nodes, kits, graphs, modules,
  edges.
- 37e3fbd: Connect file system to Visual Editor.
- 8722c8f: Make retrieving type metadata sync.
- 64bbe1b: Drive the usage of `inspect` down to four callsites.
- 96ea699: Introduce snapshot-based update machinery.
- 4a898eb: Introduce `GraphStore.graphs()`.
- 7ea05ca: Remove the use of `inspect` inside `packages/breadboard`.
- 84f6a3a: Start dispatching `update` event on InspectableGraph.
- 2a6d643: Introduce `output` capability.
- c91a1ed: Support `[graphurl]#module:{moduleId}` URL syntax.
- 07b5676: Add support for `@describe` capability.
- 66105f9: Dispatch topology events on edits.
- 96b0597: Introduce `GraphStore`: a top-level holder of all boards.
- eb3fc28: Start using `currentPorts` and `update` event in VE.
- b23168c: Introduce file system infrastructure.
- c6935b7: Make MutableGraph the main backing store for editing and inspection.
- 7ea3b85: Teach Breadboard to recognize and edit BGL exports.

### Patch Changes

- 71992c0: Fix the update-loop-of-death
- e4631ff: Remove old GraphStore bits.
- e22e33b: Make edits after runs not crash
- cae3a3f: A plethora of bug fixes and polish
- 862c53c: Yuletide bug bash.
- f9dc26b: Properly track deletions of edges and nodes.
- df6926d: A cornucopia of fixes and polish
- f6c31d3: Undo the change to use GraphStore for custom graph describers, as it
  breaks Agent Kit.
- 183c9eb: Start moving A2 to multi-export setup.
- b685d49: Remove `InspectableGraph.kits`.
- a717ddc: Fix various bugs with describer capability
- 46c9327: Allow pasting fragment URLs into VE and add a nicer module title when
  running modules.
- 4eb6d6d: Ensure that Graph-based Kits are registered before run starts.
- 032d962: Fix the replay and runModule telemetry bugs.
- 78da2ab: Revert rollup bump 4.25.0 to 4.27.1, because it causes build to be
  super-slow.
- 404a08f: Teach Graph Outline various tricks
- 91e0930: Teach VE and Breadboard to invoke sub-boards properly.
- 2130bc6: Teach FSAPI Board Server to show published boards.
- d73587b: Type declaration tweaks and better error unwrapping.
- e4521d9: Don't delete completed chunk.
- 11e4c86: Fix a bunch of bugs I made last week.
- 93a0a94: Make board server components show in component selector.
- 3ce820e: Clean up and docs.
- 99532f4: Inform node/edge caches when subgraphs are removed/added
- Updated dependencies [37e3fbd]
- Updated dependencies [4a898eb]
- Updated dependencies [7ea05ca]
- Updated dependencies [cae3a3f]
- Updated dependencies [2a6d643]
- Updated dependencies [a717ddc]
- Updated dependencies [07b5676]
- Updated dependencies [032d962]
- Updated dependencies [96b0597]
- Updated dependencies [df9b8b9]
- Updated dependencies [d73587b]
- Updated dependencies [a8eccc4]
  - @breadboard-ai/jsandbox@0.3.0
  - @google-labs/breadboard-schema@1.11.0
  - @breadboard-ai/types@0.4.0

## 0.30.0

### Minor Changes

- a13caa0: Swap nav for open dialog
- ca466cd: Plumb probe events (node/graph start/end) for runModule.
- 18dace0: Allow subgraphs to access modules
- 32b50af: Expose side wires in `InspectableGraph`.
- 8d44489: Implement support for module-based describers
- ce3a00c: Introduce sidewire transforms.
- c75e26f: Introduce Imperative Graphs.
- cc19e8c: Teach Visual Editor how to edit modules
- 9d5f11b: Convert existing declarative kits to BGL.
- 66041a7: Migrate to use `InspectableGraph.edit` for subgraph
  add/remove/replace.
- 2c7587a: Rename "Specialist" to "Model".
- 9e5390d: Introduce Edit Transforms and start using them.
- 1fb9857: Teach RunObserver about resuming runs.

### Patch Changes

- e37a9bf: Add image and formatting support to Context to Slides
- 605af98: Start caching describer results.
- 19fc2d0: Teach EditSpec to add & remove modules
- 62d627f: Feed compiled JS from TS compiler.
- b541052: Raft of fixes for Module Editor
- 31ddc9a: Various polish and fixes.
- a934fe2: Make describer cache async.
- Updated dependencies [9250262]
- Updated dependencies [1131130]
- Updated dependencies [97b85d4]
- Updated dependencies [ca466cd]
- Updated dependencies [669694a]
- Updated dependencies [19fc2d0]
- Updated dependencies [74aa9b7]
- Updated dependencies [c75e26f]
- Updated dependencies [856e249]
- Updated dependencies [1f1f7bc]
- Updated dependencies [db52fbc]
- Updated dependencies [d42ab17]
- Updated dependencies [9d5f11b]
  - @breadboard-ai/jsandbox@0.2.0
  - @google-labs/breadboard-schema@1.10.0
  - @breadboard-ai/types@0.3.0

## 0.29.0

### Minor Changes

- 4dc21f4: Implement basic Google Drive Board Server
- 71d42aa: Teach Visual Editor to run step by step.
- 1fc5812: React to component edits correctly.
- e014e42: Introduce "component" tag and user custom kits.
- ee2844b: Teach Visual Editor about different edge states.
- bdf80d8: Teach Google Drive board server to refresh credentials.
- 29762d6: Implement "Re-run from this node" feature.
- db93a6a: Implement "stopAfter" run argument (but not yet use it).
- 8f079a1: Teach Inspector API about modules

### Patch Changes

- 63abd70: Fix the asBlob crash when replaying runs.
- 6215ade: Synchronize activity log with visual editor when component is edited.
- 850c217: Unbreak serialization.
- 39d1913: Add webpackIgnore to server-only code
- c6f1a69: Fix save behavior
- 5332cbc: Add `module` behavior
- 2d5b24e: Add description to module
- Updated dependencies [e014e42]
- Updated dependencies [661beea]
- Updated dependencies [2d5b24e]
  - @google-labs/breadboard-schema@1.9.0
  - @breadboard-ai/types@0.2.0

## 0.28.0

### Minor Changes

- ca5f932: Introduce board server blobs API endpoint
- 049a83b: Add FileSystemBoardServer

### Patch Changes

- 5aded4a: Change for shape rather than instance when formatting errors.
- b640cd2: Remove spurious "examples" property from blank LLM Content config.
- ffbcf09: Allow management of Board Servers
- 7adeed8: Move LLMContent to types package.
- c031dd6: Do some plumbing work for extensions
- Updated dependencies [7adeed8]
  - @breadboard-ai/types@0.1.2

## 0.27.3

### Patch Changes

- Updated dependencies [d20e867]
  - @breadboard-ai/types@0.1.1

## 0.27.2

### Patch Changes

- 370b7ca: Change option name
- 7921983: Introduce `@breadboard-ai/types` package.
- Updated dependencies [7921983]
  - @breadboard-ai/types@0.1.0
  - @google-labs/breadboard-schema@1.8.1

## 0.27.1

### Patch Changes

- 5c015f2: Add an options object to createLoader. Allows suppressing the default
  loading behavior.

## 0.27.0

### Minor Changes

- cb8c99a: Feed static describer results to dynamic describer.
- 4dadf16: Introduce experimental storeData and retrieveData components in Core
  Kit.
- 8f9fddf: Move LightObserver to shared-ui as TopGraphObserver.
- f61ccf3: Introduce URL-based component types.
- 8540b93: Convert Content to Build API and merge Specialist 2 to Specialist.
- 81eafad: Implement selecting runs and viewing them.
- 4c03455: Introduce Specialist 2 and make Content component support LLM
  Content.
- 157c31e: Implement remote board server
- d7606d3: Implement plumbing for visualizing runs as graphs.
- d9fd0ab: [project-store] -> [idb-board-server]
- a6128a3: Switch Visual Editor to use Run API.

### Patch Changes

- 703f17d: Various fixes to make board server work again.
- 6136d87: Bug fixes for dynamic describers.
- e61fa66: Dispatch "edge" event for all edges.
- a104fa7: Teach InspectableRunObserver.load to add the loaded run to its runs.
- 8a1b8c4: Teach Throttler to not wait on new data if it already has cached
  data.
- 9797718: Auto-migrate IDB `GraphProvider` boards
- 3137076: Include credentials in proxy client fetch.
- 4cc71ee: Allow pasting star edges.
- a039d2e: Do a little tidy up of the UI
- 9783ba8: Fix worker memory leak and throttle describers.
- aafec7f: Correctly account for the default start tags.
- 1ad3001: Show configuration previews underneath ports
- 84ca649: Introduce the "Content" component.
- Updated dependencies [8d06f3c]
- Updated dependencies [8540b93]
  - @google-labs/breadboard-schema@1.8.0

## 0.26.0

### Minor Changes

- 7d46a63: Teach Visual Editor to use board server's node proxy to run boards.

## 0.25.0

### Minor Changes

- e0dccfe: Polish app view.
- 6404cb3: Introduce HarnessRunner API (not yet exposed).
- 9ad0524: Teach Inspector API about start tags.
- a4301e6: Introduce the ability to write custom describers.
- 7fdd660: Add the Run API.
- a34bb69: Introduce RemoteRunner (over HTTPS)
- c397d53: Add support for multiple graph entry points and start tags.
- 7de241c: Remove `BoardRunner`.
- a424c92: Teach remote runner to send fewer bytes over the wire.
- 79d709c: Introduce Edge event to Local and Remote runners.

### Patch Changes

- 49b3612: Restore preview functionality
- b201e07: Implement edge-based UI in board-server (and fix a bunch of bugs
  elsewhere)
- 15b5659: Teach app view to use RemoteRunner.
- 0296c89: Teach LLMContentArray check to ignore $metadata
- 534d67e: Teach Run Store & Data Store about LLM Content Array
- c2cd40d: Add InspectableRunEdgeEvent
- 262cefd: Skip metadata events in DataStore and RunStore
- Updated dependencies [c397d53]
  - @google-labs/breadboard-schema@1.7.0

## 0.24.0

### Minor Changes

- 8c694ed: Support sequences of nested graphs (like what `reduce` does).
- bbf2c30: Plumb interruptible run to board server.
- 14df6a8: Retry with credentials when board fetch fails.
- 2aabb7a: Introduce the concept of `partialOutputs` to `TraversalState`, to
  convey outputs produced while processing bubbled inputs.
- fb72771: Introduce run reanimation and `interruptibleRunGraph`.
- 9b22cab: Make sure that reanimator correctly adjusts invocationId when
  resuming.
- 00cc2c5: Remove `lambda`, introduce standalone `invokeGraph` and `runGraph`
  functions, and other plumbing refactoring.
- c04cff0: Bring back synchronous `TraversalResult.outputs`.
- 3f8cdd1: Introduce run store
- 3a5ced1: Refactor `map` to run serially when `RunStateManager` is present.

### Patch Changes

- 1dc645a: Remove `validator` and `slot` bits from BoardRunner and allow bubbled
  inputs to abort gracefully.
- 62f8d5b: Fix replay of saved runs

## 0.23.0

### Minor Changes

- 1e1be2a: Teach board-server run API endpoint to run simple boards.
- 2b9ef5b: Rewrire Datastore usage
- 2312443: Add support for `deprecated` and `experimental` tags on Kits.
- 6ffa89c: Migrate to new data-store package

### Patch Changes

- 2b094a3: Add google-drive-query behavior
- fa93c3f: Add drop function to datastore
- 215bd15: Add google-drive-file-id
- a0852df: Update titles and help links in Core Kit.
- Updated dependencies [2312443]
  - @google-labs/breadboard-schema@1.6.0

## 0.22.0

### Minor Changes

- ffbf163: canConnect now checks JSON schema compatibility in a much more
  complete way, including understanding of nested types.

### Patch Changes

- a925cf0: Add inPort and outPort functions to InspectableEdge
- 5cf08f1: Add "wires" property to NodeDescriberContext which exposes a
  describe() function for getting the actual schema of a connected port if
  needed.
- 8928fb7: Add section for Visual Editor documentation
- d6706f2: Add analyzeCanConnect method to InspectablePort which is like
  canConnect but with detailed error messages.
- 5447426: Add kind port to InspectablePort to tell you whether it's an input or
  output port
- 7e1f01c: Start rolling up .d.ts type information for the package.
- Updated dependencies [dd783e0]
- Updated dependencies [3aba1a4]
  - @google-labs/breadboard-schema@1.5.1

## 0.21.0

### Minor Changes

- 74ade20: Confine the number of inspectable runs to two.
- 59dd0f5: Add support for "mine" property
- 417323c: Teach Board Server to use Node Proxy Server
- b3aa884: Introduce undo/redo capability in Editor API.
- 7af14cf: Add support for comment nodes
- 778f7aa: Teach Breadboard to load runs with non-text content.
- 808f5e2: Introduce graph edit history API.
- e0fdbc3: Use LLMContent types in blank graphs.
- 14853d5: Add Gemini Nano node.
- 8798514: Combine several Editor API methods to one `edit`.
- eb64b9a: Export enum values
- 91cb723: Teach Editor API to properly roll back multiple graph changes.
- 3e10f0f: Introduce `DataCapability` and add support for multipart form data in
  `fetch`.
- c53ca01: Plumb `DataStore` throuh to `NodeHandlerContext`.
- 9491266: Implement `DataStore` and a simple implementation.
- 2ace620: Teach `InspectableGraph.describe` to correctly propagate
  fixed/flexible bit.
- 37418d9: Introduce the `iframe.html` entry point for running Breadboard in an
  iframe.
- 083f69c: Add validate() method to InspectableEdge
- 5b03d96: Start using multi-edit capability when pasting nodes.
- f0d8d67: Remove the old "star port as ad-hoc port drop zone" machinery.
- 836389d: Implement `InspectableRun.replay` for past runs.
- 225c7cc: Implement simple ACL for board server.

### Patch Changes

- 5a55b7d: Don't prefill inputs from bubbled inputs.
- 3d7b4a7: Introduce optional `help` metadata for graphs and kits.
- fea8967: Add basic "Save As..." support
- 54b03b9: Update nav styling
- 810d7fd: Fix canGoBack check
- 32a48a3: Teach `output` to be non-fixed by default.
- cd73b17: Switch to Nodejs v20.14.0 as the baseline.
- 81d82fe: Don't update events when looking up event data.
- 2a7531b: Actually initialize `InspectablePort.type`.
- 7c1b4cb: Temporarily mark new board server boards as published.
- 702cfe1: Unblock UI on Providers
- bebd96e: Move a bunch of docs over to archive.
- 4c681cb: Switch to use edit operations machinery in Editor API internals.
- fb2e584: Make metadata/configration changes incremental by default.
- fcef799: Update `help` to have description and URL
- Updated dependencies [3d7b4a7]
- Updated dependencies [7af14cf]
- Updated dependencies [511bd9b]
- Updated dependencies [431fa3d]
- Updated dependencies [cd73b17]
- Updated dependencies [fcef799]
  - @google-labs/breadboard-schema@1.5.0

## 0.20.0

### Minor Changes

- 8097177: Allow output ports to be required in their schema without it turning
  output ports red when they are unwired
- cec6d54: Introduce `InspectablePortType`.
- 3397974: Add `InspectableNode.type()` and start using it.

### Patch Changes

- ab9a4ce: Remove `runRemote` method. It is old code that doesn't work and isn't
  used.
- a35406c: Add formatGraphDescriptor function which formats BGL in a
  deterministic way
- 477e6e6: Sort more schema fields for easier comparison across serializers

## 0.19.0

### Minor Changes

- 63eb779: Add support for `interactiveSecrets` option on `RunConfig`.

## 0.18.0

### Minor Changes

- cef20ca: Enable running edgeless graphs
- 54baba8: Implement `AbortSignal` support.
- cdc23bb: Make bubbled input values configurable.
- a1fcaea: Introduce `code` behavior hint.
- c3ed6a7: Introduce `InspectableRun.inputs`.
- 3d48482: Change all multi-modal inputs to be a format of llm-content
- 626139b: Support `icon` metadata on node types and graphs.
- bd44e29: Support audio input
- 43da00a: Introduce the concept of editor modes.
- c3587e1: Introduce `GraphDescriptor.metadata`.

### Patch Changes

- fbf7a83: Apply `format` to array items.
- 49c3aa1: Make `inputs` and `descriptor` optional for ErrorObject.
- 416aed2: Introduce `metadata` for `NodeHandler` entries, teaching node types
  in Kits to describe themselves.
- f2eda0b: Fix lots of bugs around Tool Worker.
- 3f9507d: Better compatibility with @breadboard-ai/build
- Updated dependencies [416aed2]
  - @google-labs/breadboard-schema@1.4.1

## 0.17.0

### Minor Changes

- ae79e4a: Implement `InspectableRun.currentNodeEvent`.
- 72c5c6b: Split run-time and build-time URL resolutions for loading graphs.
- c5ba396: Introduce `InspectableRun.stack` method.
- 51159c4: Introduce `InspectableEdge.type`.
- 6f9ba52: Add support for control edges.

### Patch Changes

- c3cb25f: Make star edge fix up work in reverse, too.
- dd810dd: Introduce `GraphChangeEvent.visualOnly` to indicate that only visual
  metadata was updated.
- 7bafa40: Introduce `graphchangereject` event in Editor API.
- 2932f4b: Remove `schema` from `output` ports.

## 0.16.0

### Minor Changes

- ad9c233: Allow adding edges between `star` and named ports.
- 65d869b: Teach Editor API about versions and change events.
- cf0ee4f: Add `blank` method to Editor API.
- 5382365: Add `InspectableGraph.graphs` API.
- ffd2a6c: Implement subgraph editing in Editor API.

### Patch Changes

- 417cdf5: Switch to use `GraphDescriptors` in subgraph editing.
- 43cbed7: Remove `messages` and `currentNode` from `InspectableRun`.
- ff6433c: Prepare InspectableGraph instances to have a mutable backing store.
- 0e7f106: Add `metadata` to `InspectableNode`.
- 9ea6ba0: A quick-and-dirty fix to the TS type system errors.

## 0.15.0

### Minor Changes

- 938015d: Use `runJavascript` directly in `code` block.

### Patch Changes

- 76da09d: Early support for voting (yes/no) in Human node.

## 0.14.0

### Minor Changes

- e8d0737: Make run serialization more compact.

## 0.13.0

### Minor Changes

- 51a38c0: Teach `InspectableRunNodeEvent` to use `InspectableNode` by default.
- 9326bd7: Introduce ability to save/load runs.

### Patch Changes

- faf1e12: Teach invoke to be more accepting of uncertainty.
- d49b80e: Introduce `InspectableRun.getEventById` method.
- fbad949: Various schema-related bug fixes.

## 0.12.1

### Patch Changes

- 2fda461: Add missing build artifacts

## 0.12.0

### Minor Changes

- 866fc36: Refactor `BoardLoader` to be a `GraphLoader` implementation.
- f005b3b: Introduce `load` API for kits.
- 048e8ec: Introduce `InspectableRunEvent` and API around it.
- 60bd63c: Get the Run Inspector API ready to ship
- 04d5420: Adds describer to GraphToKitAdapter
- 1b48826: Introduce `GraphProvider` and make it pluggable.
- 3e8cfcf: Teach `InspectableRunNodeEvent` about `InspectableNode`.
- 986af39: Update GraphProvider to support additional methods; land
  IDBGraphProvider
- eabd97b: Introduce the concept of log levels in Run Inspector API.
- 2008f69: Teach breadboard to load custom URL types.
- a8fc3f3: Teach `GraphProvider` to watch for file change notifications.
- c208cfc: Introduce `canChangeEdge` and `changEdge` to the Editor API.

### Patch Changes

- 99446b8: Various quality improvements to schemas and Graph Inspector API.
- a8bab08: Add support for inputs (including bubbled) to
  `InspectableRun.events`.
- decfa29: Introduce `DebuggerGraphProvider`.
- dcfdc37: Implement handling subgraphs in Run Inspector API.
- d971aad: Add documentation for Run Inspector API.
- dc35601: Improved run inspector API to mostly work.
- 9cda2ff: Disallow creation of non-star to star edges.
- 764ccda: Use behaviors to identify port editing UI.
- 56b90a4: Improve graph unique id generation and various cleanups.
- e648f64: Start using UUIDs for graphs.
- ad5c1be: Introduce Tool Worker node in Agent Kit.
- 4a4a1f6: Place unfinished sidecar events at the bottom of the event list.
- bac9bb1: Bring loader machinery closer to cacheable load state.
- 3c497b0: Use esbuild.build to compile the boards. This enables importing
  modules.
- c0f785a: Shift more URL-resolution logic into the Loader.
- 32cfbaf: Optimistically create edge instances during cache miss.
- 8dc4e00: Fix a race condition in Worker transport.
- 6438930: Make `InspectableEdge` and `InspectableNode` instances stable.
- dd2cce6: Make graph editor work with stable `InspectableEdge`.
- cac4f4f: Add `InspectableRunEvent.id`.
- b1fc53b: Teach `breadboard debug` to load PaLM Kit dynamically.
- ef05634: Allow node describe() and invoke() to work as long as an object
  provides those properties
- Updated dependencies [f005b3b]
- Updated dependencies [9b8e732]
- Updated dependencies [4a4a1f6]
- Updated dependencies [eabd97b]
- Updated dependencies [efeb1a3]
  - @google-labs/breadboard-schema@1.4.0

## 0.11.2

### Patch Changes

- 07e66bf: Updated README.md

## 0.11.1

### Patch Changes

- 05136f8: Various fixes to the inspector API.
- ef305d1: Enable adding input/output nodes with the Editor API.
- aea9178: Delete affected edges when removing a node in editor API.
- 20a0e5c: Fix self not defined error

## 0.11.0

### Minor Changes

- c19513e: Introduce `InspectableGraph.edges()` and start using it.
- 2237a4c: Added `subgraph` method to `InspectableNode`.
- bd68ebd: Add a simple `describe` method to InspectableGraph.
- ea652f3: Introduce the Editor API.
- 0085ee2: Teach inspector API to correctly describe nodes.
- ee00249: Introduce `NodeMetadata`.
- c13513f: Introduce Inspector API (a little baby one)
- c804ccc: Introduce the `InspectablePort.edges` property.
- 53406ad: Zod Schema is no longer supported. JSON Schema should be used
  instead.
- 4c5b853: Implement output bubbling.
- 3f3f090: Teach `jsonata` and `invoke` nodes to better describe themselves.
- d7a7903: Added support for describing inputs, outputs, and subgraphs in
  Inspector API.
- f6e9b2c: Teach the Breadboard CLI how to use proxies

### Patch Changes

- 9a76a87: Various fixes to Editor API found while playing with the visual
  editor.
- 56954c1: Introduce `InspectableNode.ports`, which enumerates ports of a node.
- 0ef9ec5: Added documentation for Inspector API.
- 56ccae5: Introduce a way to inspect kits.
- 4920d90: Taught `core.invoke` to describe its own subgraphs.
- 10a8129: Add docs for the Agent Kit
- 5a65297: Add dependency on schema package for new graph types location
- 4401a98: Fix various bugs in inspector API.
- Updated dependencies [ee00249]
- Updated dependencies [5a65297]
  - @google-labs/breadboard-schema@1.3.0

## 0.10.1

### Patch Changes

- fb1c768: Introduce Gemini Kit.

## 0.10.0

### Minor Changes

- 9bcd607: Implement `isImage` type annotation.

### Patch Changes

- f6a7f43: Add schemas to serialised boards
- Updated dependencies [e7be365]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard-schema@1.2.0

## 0.9.1

### Patch Changes

- 81e2840: Teach Breadboard about transient bubbled inputs.

## 0.9.0

### Minor Changes

- 8eccdad: [breadboard-cli] Improvements to OpenAPI import to handle parameters
  as dynamic inputs and input config files
- 6e8c08d: remove breadboard json schema

### Patch Changes

- 780909c: Stop displaying subgraphs in Breadboard Debugger.
- bba68fd: Write the introduction in the "Happy Path" doc.
- b557794: The "recipe" function is now called "board". A "recipe" alias is
  still exported to ease migration.
- a9206fc: Firm up the error return type.
- 931a95b: Introduce richer error reporting to the harness.

## 0.8.0

### Minor Changes

- af00e58: Various changes. First release managed by Changesets.

## [0.6.0] - 2023-12-06

- Bug fixes
- New `remote` submodule to enable invoking boards over HTTP and workers
- The new syntax! (WIP)
- The `ui` submodule moved to its own package `breadboard-ui`
- [Bubbling](https://github.com/breadboard-ai/breadboard/issues/166) inputs!

## [0.5.1] - 2023-11-18

- Removed unintended dependency on `jsonschema`.
- Removed circular dependency between `Board` and `BoardRunner`.
- Other bug fixes.

## [0.5.0] - 2023-11-08

- The `/ui` submodule changes:
  - supports multiple simultaneous inputs
  - does not ask for keys more than once per session
  - if you specify `type: "object"` for an input, it will try to parse it as
    JSON data and pass as an object.
  - draw Mermaid diagrams of the boards
  - there's now a link to the running board in the UI.
- The `/worker` submodule changes:
  - bug fixes (will actually queue received messages and not drop them on the
    floor)
- The following nodes moved out into the Core Kit: `passthrough`, `reflect`,
  `slot`, `include`, `import`, and `invoke`.
- The `run` method now takes a `NodeHandlerContext` object as its argument,
  rather than a list of arguments.
- Kits are no longer implicitly imported by Breadboard. Instead, supply loaded
  Kits as part `NodeHandlerContext` to `run`.

## [0.4.1] - 2023-10-20

- Moved the `mermaid` method to `BoardRunner`.
- Updated URL resolution on constructed Kits.
- Tweaked documentation.
- Multiline support and loading from URL in UI elements
- Other fixes.

## [0.4.0] - 2023-10-17

- **M2 Release**
- Added minified build artifacts.
- Three new nodes: `invoke`, `import`, and `lambda` (see
  [documentation](https://github.com/breadboard-ai/breadboard/blob/13601657112736ccccb083ed3e167f7e2ae05928/packages/breadboard/docs/nodes.md))
- Deprecated `include` node (the `invoke` node replaces it)
- Rolled `graph-runner` package in. This package now has zero prod dependencies.
- Added a way for nodes to describe themselves in `NodeHandler`.
- All nodes now describe themselves using the mechanism above.
- Added `SchemaBuilder` for easy building of node descriptions.
- Added `/kits` submodule as a future place for easily creating kits
- Added `GenericKit` abstraction for automatically generating kits from
  handlers.
- Added `/ui` submodule as the future place for simple Web-based UI for
  Breadboard.
- Added `/worker` submodule as the future place way to build Breadboard-based
  Web Workers.
- Added the notion of subgraphs (graphs that are embedded into a larger
  `GraphDescriptor`).
- Edge inputs are now queued (fixes the issue of new outputs overwriting old
  ones)
- Node outputs are now asynchronous
- Lots of fixes and love and care.

## [0.3.1] - 2023-09-15

- Updated milestone shield.

## [0.3.0] - 2023-09-15

- There is no more `seeksInput` property on `RunResult`. Instead, the `type`
  property will tell us why the board paused. Currently, three valid results are
  `input`, `output`, and `beforehandler`. The first two existed before. The
  third one now interrupts before running every node.
- The boards now can store metadata about them. See
  https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/graphs/call-react-with-slot.json
  for an example. Yes, you can put Markdown in description.
- The boards now have URLs associated with them. When a board is loaded from a
  URL, the `url` property will reflect that value. All subsequent URLs are
  resolved relative to the URL of the board.
- If the URL is not supplied, the board is assumed to have a URL of the current
  working directory of whatever loaded the board.
- There's a `ResultRun.isAtExitNode` method that reports true if the currently
  visited node is an exit node for the graph.
- There's a `Board.runRemote` method that allows running a board remotely
  (powered by `packages/breadboard-server`). This functionality is nascent and
  may not work exactly as expected.

## [0.2.0] - 2023-09-02

- New `beforehandler` event
- New `DebugProbe` that is useful for debugging boards
- New `RunResult` class with `load` and `save` methods to support multi-turn and
  continuous runs.

## [0.1.1] - 2023-08-23

- updated the homepage URL (oops).

## [0.1.0] - 2023-08-23

- lots of tutorial updates
- `run` and `runOnce` now have `slot` parameter to pass in slotted graphs
- `BreadboardRunResult` now has a `node` property that contains current node
- integrity validator plumbing
- bug fixes and refactorings

## [0.0.2] - 2023-08-04

- updated compiled Javascript (oops).

## [0.0.1] - 2023-08-04

- started a changelog
- [M0 release](https://github.com/breadboard-ai/breadboard/issues?q=is%3Aissue+milestone%3A%22Breadboard+M0%22+is%3Aclosed)
