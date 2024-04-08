# @google-labs/breadboard-web

## 1.6.0

### Minor Changes

- 324633d: Deprecated localStorage for secrets; uses IDB/Settings Panel instead

### Patch Changes

- 0068682: Replace `LoadArgs` with just `GraphDescriptor`.
- 0e7f106: Add `metadata` to `InspectableNode`.
- Updated dependencies [303e49b]
- Updated dependencies [0068682]
- Updated dependencies [ad9c233]
- Updated dependencies [62c2b41]
- Updated dependencies [65d869b]
- Updated dependencies [417cdf5]
- Updated dependencies [cf0ee4f]
- Updated dependencies [43cbed7]
- Updated dependencies [ff6433c]
- Updated dependencies [5382365]
- Updated dependencies [0e7f106]
- Updated dependencies [9ea6ba0]
- Updated dependencies [ffd2a6c]
- Updated dependencies [9d19852]
- Updated dependencies [324633d]
  - @google-labs/breadboard-ui@0.5.0
  - @google-labs/breadboard@0.16.0
  - @google-labs/core-kit@0.6.0
  - @breadboard-ai/build@0.3.1
  - @google-labs/gemini-kit@0.1.8
  - @google-labs/json-kit@0.1.5
  - @google-labs/node-nursery-web@1.0.8
  - @google-labs/palm-kit@0.0.10
  - @google-labs/pinecone-kit@0.1.8
  - @google-labs/template-kit@0.2.5

## 1.5.1

### Patch Changes

- 76da09d: Early support for voting (yes/no) in Human node.
- Updated dependencies [0a899e1]
- Updated dependencies [76da09d]
- Updated dependencies [8be93c8]
- Updated dependencies [938015d]
- Updated dependencies [182a546]
- Updated dependencies [4de92a3]
  - @google-labs/breadboard-ui@0.4.3
  - @google-labs/agent-kit@0.4.0
  - @google-labs/breadboard@0.15.0
  - @google-labs/core-kit@0.5.3
  - @breadboard-ai/build@0.3.0
  - @google-labs/gemini-kit@0.1.7
  - @google-labs/json-kit@0.1.4
  - @google-labs/node-nursery-web@1.0.7
  - @google-labs/palm-kit@0.0.9
  - @google-labs/pinecone-kit@0.1.7
  - @google-labs/template-kit@0.2.4

## 1.5.0

### Minor Changes

- da2e263: Add support for boards created with new @breadboard-ai/build package

### Patch Changes

- Updated dependencies [7949ec9]
- Updated dependencies [08c5eaa]
- Updated dependencies [949bce7]
- Updated dependencies [e8d0737]
- Updated dependencies [da2e263]
  - @breadboard-ai/build@0.2.0
  - @google-labs/breadboard-ui@0.4.2
  - @google-labs/breadboard@0.14.0
  - @google-labs/core-kit@0.5.2
  - @google-labs/gemini-kit@0.1.6
  - @google-labs/json-kit@0.1.3
  - @google-labs/node-nursery-web@1.0.6
  - @google-labs/palm-kit@0.0.8
  - @google-labs/pinecone-kit@0.1.6
  - @google-labs/template-kit@0.2.3

## 1.4.0

### Minor Changes

- 05e74c9: Add a Settings Panel

### Patch Changes

- 8363d27: Add node location reset button
- 644c1ee: Redirect users when active board is deleted
- 66128fa: Update node proxy server machinery
- 5cd01a2: Put preview in its own overlay
- 60f1754: Inform a user when a board load fails
- Updated dependencies [5f22f15]
- Updated dependencies [dfcd6d8]
- Updated dependencies [05e74c9]
- Updated dependencies [faf1e12]
- Updated dependencies [51a38c0]
- Updated dependencies [e327653]
- Updated dependencies [8363d27]
- Updated dependencies [b8443c0]
- Updated dependencies [646680a]
- Updated dependencies [d49b80e]
- Updated dependencies [dbe2d07]
- Updated dependencies [c364a94]
- Updated dependencies [9326bd7]
- Updated dependencies [d18b070]
- Updated dependencies [60f1754]
- Updated dependencies [fbad949]
- Updated dependencies [04f5663]
- Updated dependencies [8a99a77]
  - @google-labs/breadboard-ui@0.4.0
  - @google-labs/breadboard@0.13.0
  - @google-labs/core-kit@0.5.1
  - @google-labs/gemini-kit@0.1.5
  - @breadboard-ai/build@0.1.2
  - @google-labs/json-kit@0.1.2
  - @google-labs/node-nursery-web@1.0.5
  - @google-labs/palm-kit@0.0.7
  - @google-labs/pinecone-kit@0.1.5
  - @google-labs/template-kit@0.2.2

## 1.3.1

### Patch Changes

- Updated dependencies [6a0bbbf]
  - @breadboard-ai/build@0.1.0

## 1.3.0

### Minor Changes

- c3303a6: Adds --kit to `breadboard debug`
- f005b3b: Introduce `load` API for kits.
- 60bd63c: Get the Run Inspector API ready to ship
- be240b8: Simplifies the UI
- b80a188: Add support for editing board info
- 986af39: Update GraphProvider to support additional methods; land IDBGraphProvider
- 0bdff0b: Adds nesting to the Activity Log
- 88372d9: Adds sidenav and loading from the File System
- a8fc3f3: Teach `GraphProvider` to watch for file change notifications.
- c208cfc: Introduce `canChangeEdge` and `changEdge` to the Editor API.

### Patch Changes

- 99446b8: Various quality improvements to schemas and Graph Inspector API.
- 88b0f3a: add SVG version of logo and use it for favicon
- a9e1849: Minor UI tweaks for iOS
- 699723b: Support file drag and drop
- decfa29: Introduce `DebuggerGraphProvider`.
- 1f01afc: Make logLevel "debug" as default.
- 49c25aa: Add describers for a few nodes.
- 564f60c: Allow saving of non FS files
- 6e631c4: Load agent-kit via manifest dynamically.
- c0d87f4: Slide toasts out of the way when a new one arrives
- 048e8ec: Introduce `InspectableRunEvent` and API around it.
- 6143c58: Switch breadboard-web to not use worker by default.
- 56b90a4: Improve graph unique id generation and various cleanups.
- 9a689c3: Teach `bb-activity-log` to handle image URLs.
- e648f64: Start using UUIDs for graphs.
- dc648b1: Use object identity to trigger graph update.
- 628be93: Consolidate colors
- bac9bb1: Bring loader machinery closer to cacheable load state.
- ff4abd6: Better Ad Writer
- 10f5110: Update look of node selector
- 3d536b6: Emit node location info on first render
- eabd97b: Introduce the concept of log levels in Run Inspector API.
- 14d5220: Start extruding Run Inspector API from existing machinery.
- 6b5e96e: Acknowledge that the user has refreshed the source
- 1bbd16a: Start loading all heavy kits dynamically.
- 8dc4e00: Fix a race condition in Worker transport.
- 5118c60: Use actual `changeEdge` call
- 53df4e9: Add another take on Ad Writer.
- b1fc53b: Teach `breadboard debug` to load PaLM Kit dynamically.
- 9f343a6: Update Ad Writer 2 to generate entire campaigns.
- Updated dependencies [642e18c]
- Updated dependencies [f73c637]
- Updated dependencies [99446b8]
- Updated dependencies [866fc36]
- Updated dependencies [126522e]
- Updated dependencies [a8bab08]
- Updated dependencies [699723b]
- Updated dependencies [decfa29]
- Updated dependencies [f005b3b]
- Updated dependencies [49c25aa]
- Updated dependencies [6e631c4]
- Updated dependencies [c0d87f4]
- Updated dependencies [b4f164d]
- Updated dependencies [dcfdc37]
- Updated dependencies [b3cfa74]
- Updated dependencies [d971aad]
- Updated dependencies [c1ec509]
- Updated dependencies [048e8ec]
- Updated dependencies [dc35601]
- Updated dependencies [f473c6e]
- Updated dependencies [9cda2ff]
- Updated dependencies [94ec717]
- Updated dependencies [49c2410]
- Updated dependencies [60bd63c]
- Updated dependencies [9c2480c]
- Updated dependencies [be240b8]
- Updated dependencies [764ccda]
- Updated dependencies [b80a188]
- Updated dependencies [04d5420]
- Updated dependencies [56b90a4]
- Updated dependencies [1b48826]
- Updated dependencies [9a689c3]
- Updated dependencies [e648f64]
- Updated dependencies [dc648b1]
- Updated dependencies [628be93]
- Updated dependencies [ad5c1be]
- Updated dependencies [4a4a1f6]
- Updated dependencies [bac9bb1]
- Updated dependencies [d440d59]
- Updated dependencies [3e8cfcf]
- Updated dependencies [6adf1f8]
- Updated dependencies [986af39]
- Updated dependencies [10f5110]
- Updated dependencies [3c497b0]
- Updated dependencies [3d536b6]
- Updated dependencies [5bc47be]
- Updated dependencies [eabd97b]
- Updated dependencies [14d5220]
- Updated dependencies [0bdff0b]
- Updated dependencies [2008f69]
- Updated dependencies [a94fe4c]
- Updated dependencies [88372d9]
- Updated dependencies [c0f785a]
- Updated dependencies [8d9bba9]
- Updated dependencies [a8fc3f3]
- Updated dependencies [32cfbaf]
- Updated dependencies [ff4abd6]
- Updated dependencies [329a47e]
- Updated dependencies [8dc4e00]
- Updated dependencies [6438930]
- Updated dependencies [5118c60]
- Updated dependencies [dd2cce6]
- Updated dependencies [cac4f4f]
- Updated dependencies [b1fc53b]
- Updated dependencies [ef05634]
- Updated dependencies [c208cfc]
  - @google-labs/team-kit@0.1.0
  - @google-labs/core-kit@0.5.0
  - @google-labs/breadboard-ui@0.3.0
  - @google-labs/breadboard@0.12.0
  - @google-labs/gemini-kit@0.1.4
  - @google-labs/agent-kit@0.3.0
  - @google-labs/json-kit@0.1.1
  - @google-labs/node-nursery-web@1.0.4
  - @google-labs/pinecone-kit@0.1.4
  - @google-labs/palm-kit@0.0.6
  - @google-labs/template-kit@0.2.1

## 1.2.2

### Patch Changes

- Updated dependencies [07e66bf]
- Updated dependencies [26367fe]
- Updated dependencies [0892658]
  - @google-labs/breadboard@0.11.2
  - @google-labs/core-kit@0.4.0
  - @google-labs/breadboard-ui@0.2.1
  - @google-labs/gemini-kit@0.1.3
  - @google-labs/pinecone-kit@0.1.3

## 1.2.1

### Patch Changes

- 464c10e: Various fixes to UI
- 73455ce: Implement "human" node in Agent Kit
- Updated dependencies [464c10e]
- Updated dependencies [c1b6c94]
- Updated dependencies [3ed66b9]
- Updated dependencies [73455ce]
- Updated dependencies [05136f8]
- Updated dependencies [ef305d1]
- Updated dependencies [aea9178]
- Updated dependencies [eaac69a]
- Updated dependencies [f17784a]
- Updated dependencies [20a0e5c]
  - @google-labs/breadboard-ui@0.2.0
  - @google-labs/core-kit@0.3.1
  - @google-labs/agent-kit@0.2.0
  - @google-labs/breadboard@0.11.1

## 1.2.0

### Minor Changes

- a4146c4: Introduce "Agent Kit" to the Breadboard Kit family.
- e6ed591: Change primary visualizer to editor
- 0c2e494: Add 'Summarizer' board illustrating Agent Kit.
- d378070: Introduce `bb-embed` element for easy Breadboard embedding.
- 0085ee2: Teach inspector API to correctly describe nodes.
- ee00249: Introduce `NodeMetadata`.
- 57e68ba: Adds LiteGraph editor
- 4c5b853: Implement output bubbling.
- 3f3f090: Teach `jsonata` and `invoke` nodes to better describe themselves.

### Patch Changes

- cd4f6e2: Add support for creating, deleting, and moving edges
- a9daeda: Introduce Repeater node in Agent Kit.
- 5221586: Add "Structured Worker" node to Agent Kit.
- 5cf1555: Make Chat Bot 2.0 work.
- 9a76a87: Various fixes to Editor API found while playing with the visual editor.
- b944657: Update existing boards to use Structured Worker.
- f06f400: Introduce Agent Kit.
- 56ccae5: Introduce a way to inspect kits.
- 10a8129: Add docs for the Agent Kit
- a4029de: Implement a Repeater-based summarizer
- c3966d3: Add licensing headers
- Updated dependencies [c19513e]
- Updated dependencies [cd4f6e2]
- Updated dependencies [a9daeda]
- Updated dependencies [a4146c4]
- Updated dependencies [5221586]
- Updated dependencies [2237a4c]
- Updated dependencies [e6ed591]
- Updated dependencies [bd68ebd]
- Updated dependencies [9a76a87]
- Updated dependencies [0c2e494]
- Updated dependencies [ea652f3]
- Updated dependencies [56954c1]
- Updated dependencies [b944657]
- Updated dependencies [c3966d3]
- Updated dependencies [0085ee2]
- Updated dependencies [0ef9ec5]
- Updated dependencies [ee00249]
- Updated dependencies [c13513f]
- Updated dependencies [57e68ba]
- Updated dependencies [f06f400]
- Updated dependencies [56ccae5]
- Updated dependencies [4920d90]
- Updated dependencies [10a8129]
- Updated dependencies [c804ccc]
- Updated dependencies [5a65297]
- Updated dependencies [abe8819]
- Updated dependencies [53406ad]
- Updated dependencies [4c5b853]
- Updated dependencies [e9696df]
- Updated dependencies [3f3f090]
- Updated dependencies [d7a7903]
- Updated dependencies [4401a98]
- Updated dependencies [b3ae9c7]
- Updated dependencies [f6e9b2c]
  - @google-labs/breadboard-ui@0.1.0
  - @google-labs/breadboard@0.11.0
  - @google-labs/agent-kit@0.1.0
  - @google-labs/core-kit@0.3.0
  - @google-labs/json-kit@0.1.0
  - @google-labs/template-kit@0.2.0
  - @google-labs/node-nursery-web@1.0.3
  - @google-labs/gemini-kit@0.1.2
  - @google-labs/palm-kit@0.0.5
  - @google-labs/pinecone-kit@0.1.2

## 1.1.1

### Patch Changes

- 7dbc32e: Bump version of gemini-kit geps.

## 1.1.0

### Minor Changes

- 5c3076a: Add `Webcam` board to demo gemini.vision node.
- fb1c768: Introduce Gemini Kit.

### Patch Changes

- Updated dependencies [3e56a4f]
- Updated dependencies [fb1c768]
  - @google-labs/template-kit@0.1.4
  - @google-labs/gemini-kit@0.1.0
  - @google-labs/core-kit@0.2.2
  - @google-labs/breadboard@0.10.1

## 1.0.4

### Patch Changes

- 1b3f266: Display structured errors in preview/debug views.
- Updated dependencies [1b3f266]
- Updated dependencies [9bcd607]
- Updated dependencies [5b1913f]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard-ui@0.0.6
  - @google-labs/breadboard@0.10.0
  - @google-labs/pinecone-kit@0.1.1
  - @google-labs/core-kit@0.2.1
  - @google-labs/json-kit@0.0.5
  - @google-labs/node-nursery-web@1.0.2
  - @google-labs/palm-kit@0.0.4
  - @google-labs/template-kit@0.1.3

## 1.0.3

### Patch Changes

- bbbd9f4: Fixes Continue button in debugger and preview
- Updated dependencies [bbbd9f4]
  - @google-labs/breadboard-ui@0.0.5

## 1.0.2

### Patch Changes

- 81e2840: Add "Agent Loop" board
- Updated dependencies [2f524ef]
- Updated dependencies [81e2840]
  - @google-labs/pinecone-kit@0.1.0
  - @google-labs/breadboard@0.9.1

## 1.0.1

### Patch Changes

- Updated dependencies [deb0d19]
  - @google-labs/node-nursery-web@1.0.0

## 1.0.0

### Major Changes

- 6222fb3: Initial publish of breadboard-web

### Minor Changes

- c89b67a: Introduce the Agent Chain board.

### Patch Changes

- 67073c8: Fix a bug of handling empty context in `gemini-generator`.
- 3ab5892: Prepare a blank template with new syntax and debugger.
- 780909c: Stop displaying subgraphs in Breadboard Debugger.
- 58b623b: Introduce `ask-user` board and adapt `agent` board to be useful with it.
- c71339f: Stop generating mermaid files automatically.
- 605cff3: Improve resilience of boards (error-handling, safer paths)
- 3356d08: Add favicon
- Updated dependencies [8eccdad]
- Updated dependencies [6e8c08d]
- Updated dependencies [eeb55f0]
- Updated dependencies [780909c]
- Updated dependencies [bba68fd]
- Updated dependencies [c08bd6b]
- Updated dependencies [c89b67a]
- Updated dependencies [cce897a]
- Updated dependencies [b557794]
- Updated dependencies [a9206fc]
- Updated dependencies [149222f]
- Updated dependencies [931a95b]
  - @google-labs/breadboard@0.9.0
  - @google-labs/breadboard-ui@0.0.4
  - @google-labs/core-kit@0.2.0
  - @google-labs/json-kit@0.0.4
  - @google-labs/node-nursery-web@0.0.3
  - @google-labs/palm-kit@0.0.3
  - @google-labs/pinecone-kit@0.0.3
  - @google-labs/template-kit@0.1.2

## 0.0.2

### Patch Changes

- Updated dependencies [af00e58]
  - @google-labs/breadboard@0.8.0
  - @google-labs/breadboard-ui@0.0.3
  - @google-labs/core-kit@0.1.3
  - @google-labs/json-kit@0.0.3
  - @google-labs/node-nursery-web@0.0.2
  - @google-labs/palm-kit@0.0.2
  - @google-labs/pinecone-kit@0.0.2
  - @google-labs/template-kit@0.1.1
