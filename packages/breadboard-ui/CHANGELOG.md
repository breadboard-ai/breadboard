# Changelog

## 0.8.0

### Minor Changes

- 29d3712: Teach editor to disambiguate added wires for collapsed nodes
- 23b8acb: Teach UI to handle arrays of LLM Content
- 04e892e: Update UI colors
- 4eeacbe: Bump Pixi.js to v8
- 69b6e44: Tidy event names
- b2a968b: Update expanded node behavior in graph editor
- 42495d8: Teach UI Controller about stopping runs
- 94caed3: Teach editor about ad-hoc edges

### Patch Changes

- 1db4a8f: Teach Graph Node & Node Info how to handle configuration & edges
- e00f855: Use port title instead of name for Graph Nodes
- edec774: Fix pasting in LLM Content (text)
- fe4c564: Teach settings about node type descriptions
- 8eaedaf: Teach Node Selector to show node descriptions
- 4203076: Update boards to make better use of `llm-content`.
- c3d386a: Teach Schema Editor about LLM Content defaults
- 9212366: Various UI Tweaks
- f4ed7ba: Fix the issue wit activity log not always showing outputs.
- e337629: Add part controls to LLM Content Input
- c91fb1e: Tidy events a little bit
- f0cb9e3: Hide ID in Schema Editor
- 150f3bd: Wire last run values into llm-content
- ffbea5d: Render LLM Content in Activity Log
- 339543d: Minor tweak to node header ports
- a4d9d23: Refactor sidebar ahead of schema editor changes
- 3397974: Add `InspectableNode.type()` and start using it.
- b6ade85: Teach graph to use icons
- fe2066b: Teach LLM Content to handle plain text a bit better
- 6c659f2: Teach input to accept meta + Enter for LLM Content
- 3e58d25: Focus search when node selector opens
- 2197ed6: Emit updates for node and board info
- d10f568: Various bug fixes to help looper and specialist work better.
- 1f4e3b4: Fix the bug with LLM Content changes not sticking.
- cbd6053: Hide wired ports from node info
- c27aa9b: Add plain text support to Activity Log
- 093e769: Teach Activity Log to honor markdown in LLM Content
- afffaaf: Update schema styles
- a945fba: Teach editor to disambiguate edges
- Updated dependencies [8097177]
- Updated dependencies [cec6d54]
- Updated dependencies [3397974]
- Updated dependencies [ab9a4ce]
- Updated dependencies [a35406c]
- Updated dependencies [477e6e6]
  - @google-labs/breadboard@0.20.0

## 0.7.1

### Patch Changes

- Updated dependencies [63eb779]
  - @google-labs/breadboard@0.19.0

## 0.7.0

### Minor Changes

- cdc23bb: Make bubbled input values configurable.
- e736f37: Remove deprecated input-multipart
- 3d48482: Change all multi-modal inputs to be a format of llm-content
- 24230c1: Introduce LLM Content Editor
- bd44e29: Support audio input
- 43da00a: Introduce the concept of editor modes.
- 12b825f: Implement streamlined properties panel
- ff4bfe9: Remember format changes for string types.

### Patch Changes

- dbd9267: Teach graph how to expand and collapse nodes
- 39016d9: Teach node selector about node shortcuts
- 706c6a8: Treat schema.examples as an array, rather than single value.
- e7faf4b: Teach Splitter how to auto-expand & collapse
- 54baba8: Implement `AbortSignal` support.
- c1652c2: Support arrays of LLM Content in Activity Log
- 416aed2: Introduce `metadata` for `NodeHandler` entries, teaching node types in Kits to describe themselves.
- 81a43c4: Fix graph node padding
- cc47fe7: Add additional types to LLM Content Input
- f2eda0b: Fix lots of bugs around Tool Worker.
- 5d601fb: Add setting for show/hide of "advanced ports"
- 6a2af3e: Hide Embedded Board Selector When Empty
- ad5f570: Teach Editor to have basic overflow menu
- 31200be: Recognize that Error object may not exist.
- Updated dependencies [cef20ca]
- Updated dependencies [fbf7a83]
- Updated dependencies [54baba8]
- Updated dependencies [49c3aa1]
- Updated dependencies [cdc23bb]
- Updated dependencies [416aed2]
- Updated dependencies [a1fcaea]
- Updated dependencies [c3ed6a7]
- Updated dependencies [3d48482]
- Updated dependencies [f2eda0b]
- Updated dependencies [626139b]
- Updated dependencies [bd44e29]
- Updated dependencies [43da00a]
- Updated dependencies [c3587e1]
- Updated dependencies [3f9507d]
  - @google-labs/breadboard@0.18.0

## 0.6.0

### Minor Changes

- 3a31595: Add support for metadata editing
- 634712b: Teach Visual Editor about embedded boards
- 5a7bc86: Teach Node Info to use Board Selector
- 68c2ac4: Consolidate UI components somewhat

### Patch Changes

- 72b3319: Fix issue with string values in array-editor
- 41afcac: Centralize graph position on renderer resize
- f6f5202: Educate Array Editor about boards
- 152f17d: Teach GraphEdge about InspectableEdgeType
- 276152e: Add "quick jump" for embedded subgraphs
- a5543eb: Add tab support for code editor
- 1b6fb74: Pass the entire SettingsStore to the bb-ui-controller.
- d439ae5: Inform Array Editor about numbers
- 6498389: Educate sub board selector how to change sub board info
- 229ad22: Add support for constant wires
- 231dd0e: Adjust threshold for curves on edges
- 12c1a72: Teach node info about code
- Updated dependencies [c3cb25f]
- Updated dependencies [ae79e4a]
- Updated dependencies [72c5c6b]
- Updated dependencies [dd810dd]
- Updated dependencies [c5ba396]
- Updated dependencies [7bafa40]
- Updated dependencies [2932f4b]
- Updated dependencies [51159c4]
- Updated dependencies [6f9ba52]
  - @google-labs/breadboard@0.17.0

## 0.5.0

### Minor Changes

- 324633d: Deprecated localStorage for secrets; uses IDB/Settings Panel instead

### Patch Changes

- 303e49b: Add support for markdown rendering
- 0068682: Replace `LoadArgs` with just `GraphDescriptor`.
- 62c2b41: Add support for Image inputs & set format correctly
- Updated dependencies [ad9c233]
- Updated dependencies [65d869b]
- Updated dependencies [417cdf5]
- Updated dependencies [cf0ee4f]
- Updated dependencies [43cbed7]
- Updated dependencies [ff6433c]
- Updated dependencies [5382365]
- Updated dependencies [0e7f106]
- Updated dependencies [9ea6ba0]
- Updated dependencies [ffd2a6c]
  - @google-labs/breadboard@0.16.0

## 0.4.3

### Patch Changes

- 0a899e1: Make sure to add `type=object` to JSON Schema if it contains properties.
- Updated dependencies [76da09d]
- Updated dependencies [938015d]
  - @google-labs/breadboard@0.15.0

## 0.4.2

### Patch Changes

- 08c5eaa: Make Markdown text selectable.
- Updated dependencies [e8d0737]
  - @google-labs/breadboard@0.14.0

## 0.4.1

### Patch Changes

- 2318521: Allow empty strings to unset objects

## 0.4.0

### Minor Changes

- 05e74c9: Add a Settings Panel
- c364a94: Add Markdown support for outputs
- 9326bd7: Introduce ability to save/load runs.

### Patch Changes

- 5f22f15: Improved node placement in graph
- dfcd6d8: Fixes missing Activity Log event info
- e327653: Allow unsetting of arrays
- 8363d27: Add node location reset button
- b8443c0: Various node info improvements
- d49b80e: Introduce `InspectableRun.getEventById` method.
- dbe2d07: Teach Node Info about arrays
- d18b070: Fix minor bugs
- 60f1754: Inform a user when a board load fails
- fbad949: Various schema-related bug fixes.
- 04f5663: Remove loadInfo from Activity Log
- 8a99a77: Teach Node Editor about enumerations
- Updated dependencies [faf1e12]
- Updated dependencies [51a38c0]
- Updated dependencies [d49b80e]
- Updated dependencies [9326bd7]
- Updated dependencies [fbad949]
  - @google-labs/breadboard@0.13.0

## 0.3.0

### Minor Changes

- 60bd63c: Get the Run Inspector API ready to ship
- be240b8: Simplifies the UI
- b80a188: Add support for editing board info
- d440d59: Download logs from Activity Logs
- 3e8cfcf: Teach `InspectableRunNodeEvent` about `InspectableNode`.
- 986af39: Update GraphProvider to support additional methods; land IDBGraphProvider
- 0bdff0b: Adds nesting to the Activity Log
- 88372d9: Adds sidenav and loading from the File System

### Patch Changes

- 99446b8: Various quality improvements to schemas and Graph Inspector API.
- a8bab08: Add support for inputs (including bubbled) to `InspectableRun.events`.
- 699723b: Support file drag and drop
- decfa29: Introduce `DebuggerGraphProvider`.
- c0d87f4: Slide toasts out of the way when a new one arrives
- b4f164d: Fix "context appears after moving node" bug.
- dcfdc37: Implement handling subgraphs in Run Inspector API.
- b3cfa74: begin to expose UI component configurability for use externally #965
- d971aad: Add documentation for Run Inspector API.
- c1ec509: Remove some unused elements
- 048e8ec: Introduce `InspectableRunEvent` and API around it.
- dc35601: Improved run inspector API to mostly work.
- f473c6e: Add message for empty activity log
- 94ec717: Move inputs into side panel
- 49c2410: Double click to add a node to the editor
- 9c2480c: Pick a random ID for new nodes
- 56b90a4: Improve graph unique id generation and various cleanups.
- 9a689c3: Teach `bb-activity-log` to handle image URLs.
- e648f64: Start using UUIDs for graphs.
- dc648b1: Use object identity to trigger graph update.
- 628be93: Consolidate colors
- bac9bb1: Bring loader machinery closer to cacheable load state.
- 6adf1f8: Teach node info how to use GraphProviders
- 10f5110: Update look of node selector
- 3d536b6: Emit node location info on first render
- eabd97b: Introduce the concept of log levels in Run Inspector API.
- 14d5220: Start extruding Run Inspector API from existing machinery.
- a94fe4c: Refactor node connection code
- 329a47e: Add keyboard dismiss behaviour for overlays
- 5118c60: Use actual `changeEdge` call
- dd2cce6: Make graph editor work with stable `InspectableEdge`.
- Updated dependencies [99446b8]
- Updated dependencies [866fc36]
- Updated dependencies [a8bab08]
- Updated dependencies [decfa29]
- Updated dependencies [f005b3b]
- Updated dependencies [dcfdc37]
- Updated dependencies [d971aad]
- Updated dependencies [048e8ec]
- Updated dependencies [dc35601]
- Updated dependencies [9cda2ff]
- Updated dependencies [60bd63c]
- Updated dependencies [764ccda]
- Updated dependencies [04d5420]
- Updated dependencies [56b90a4]
- Updated dependencies [1b48826]
- Updated dependencies [e648f64]
- Updated dependencies [ad5c1be]
- Updated dependencies [4a4a1f6]
- Updated dependencies [bac9bb1]
- Updated dependencies [3e8cfcf]
- Updated dependencies [986af39]
- Updated dependencies [3c497b0]
- Updated dependencies [eabd97b]
- Updated dependencies [2008f69]
- Updated dependencies [c0f785a]
- Updated dependencies [a8fc3f3]
- Updated dependencies [32cfbaf]
- Updated dependencies [8dc4e00]
- Updated dependencies [6438930]
- Updated dependencies [dd2cce6]
- Updated dependencies [cac4f4f]
- Updated dependencies [b1fc53b]
- Updated dependencies [ef05634]
- Updated dependencies [c208cfc]
  - @google-labs/breadboard@0.12.0

## 0.2.1

### Patch Changes

- 0892658: Ensure graph re-renders as expected
- Updated dependencies [07e66bf]
  - @google-labs/breadboard@0.11.2

## 0.2.0

### Minor Changes

- eaac69a: Editor is now the main visualizer; various other fixes

### Patch Changes

- 464c10e: Various fixes to UI
- c1b6c94: Ensure the graph is changed when values differ
- f17784a: Support a more flexible drag approach for panels; update location
- Updated dependencies [05136f8]
- Updated dependencies [ef305d1]
- Updated dependencies [aea9178]
- Updated dependencies [20a0e5c]
  - @google-labs/breadboard@0.11.1

## 0.1.0

### Minor Changes

- c19513e: Introduce `InspectableGraph.edges()` and start using it.
- e6ed591: Change primary visualizer to editor
- 0085ee2: Teach inspector API to correctly describe nodes.
- ee00249: Introduce `NodeMetadata`.
- 57e68ba: Adds LiteGraph editor
- abe8819: Make node highlighting reliable.
- 3f3f090: Teach `jsonata` and `invoke` nodes to better describe themselves.

### Patch Changes

- cd4f6e2: Add support for creating, deleting, and moving edges
- 9a76a87: Various fixes to Editor API found while playing with the visual editor.
- 56954c1: Introduce `InspectableNode.ports`, which enumerates ports of a node.
- 0ef9ec5: Added documentation for Inspector API.
- 56ccae5: Introduce a way to inspect kits.
- 4920d90: Taught `core.invoke` to describe its own subgraphs.
- 4401a98: Fix various bugs in inspector API.
- b3ae9c7: Refactor code to separate files; make minor visual tweaks
- Updated dependencies [c19513e]
- Updated dependencies [2237a4c]
- Updated dependencies [bd68ebd]
- Updated dependencies [9a76a87]
- Updated dependencies [ea652f3]
- Updated dependencies [56954c1]
- Updated dependencies [0085ee2]
- Updated dependencies [0ef9ec5]
- Updated dependencies [ee00249]
- Updated dependencies [c13513f]
- Updated dependencies [56ccae5]
- Updated dependencies [4920d90]
- Updated dependencies [10a8129]
- Updated dependencies [c804ccc]
- Updated dependencies [5a65297]
- Updated dependencies [53406ad]
- Updated dependencies [4c5b853]
- Updated dependencies [3f3f090]
- Updated dependencies [d7a7903]
- Updated dependencies [4401a98]
- Updated dependencies [f6e9b2c]
  - @google-labs/breadboard@0.11.0

## 0.0.6

### Patch Changes

- 1b3f266: Display structured errors in preview/debug views.
- 5b1913f: Account for scroll position in drawable code
- Updated dependencies [9bcd607]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard@0.10.0

## 0.0.5

### Patch Changes

- bbbd9f4: Fixes Continue button in debugger and preview

## 0.0.4

### Patch Changes

- eeb55f0: Make "Continue" work for multi-turn (dirty hack)
- c08bd6b: Fixed hanging inputs
- cce897a: Adds output support for errors
- 149222f: Show continue button in input header
- 931a95b: Introduce richer error reporting to the harness.
- Updated dependencies [8eccdad]
- Updated dependencies [6e8c08d]
- Updated dependencies [780909c]
- Updated dependencies [bba68fd]
- Updated dependencies [b557794]
- Updated dependencies [a9206fc]
- Updated dependencies [931a95b]
  - @google-labs/breadboard@0.9.0

## 0.0.3

### Patch Changes

- Updated dependencies [af00e58]
  - @google-labs/breadboard@0.8.0

## [0.0.2] - 2023-12-06

- bump dependencies.

## [0.0.1] - 2023-12-01

- Started a changelog
- Initial release
