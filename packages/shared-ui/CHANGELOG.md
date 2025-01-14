# @breadboard-ai/shared-ui

## 1.22.0

### Minor Changes

- 25dd1c2: Introduce chiclets for board capabilities
- 0afae9c: Improve side nav behaviors
- 8722c8f: Make retrieving type metadata sync.
- 5d91f23: Add basic dark theme support
- de75b63: Improvements to drag and drop
- 96ea699: Introduce snapshot-based update machinery.
- 6ed34ad: Lots of visual updates
- 21b654a: Move SettingsStore into @breadboard-ai/shared-ui package
- c91a1ed: Support `[graphurl]#module:{moduleId}` URL syntax.
- 733bf2a: Revamp selection model
- eb3fc28: Start using `currentPorts` and `update` event in VE.
- cf9d064: Improve graph zoom behaviors
- a8eccc4: Add various improvements to board navigation
- 7ea3b85: Teach Breadboard to recognize and edit BGL exports.

### Patch Changes

- f880be7: Teach Editor about graph hierarchies
- 4c03eaa: Only show configurable items as clickable
- 10a4911: Support drag-move on sub graphs
- c7b778f: Update strings for various components
- 37eb28c: Tidy up labels for boards & board arrays
- a7f278c: Change to using the main app tick for animations
- 6338d6d: Account for moduleId when creating stable URL for Module Preview.
- 1467eb5: Truncate long node titles
- a9d432a: Guard for empty port values in workspace outline preview.
- f47b90e: Teach Workspace Outline about module titles
- c8fbda4: Add tooltips
- db77f23: Various UI changes and improvements
- 1cd4301: Add capabilities view
- 64bbe1b: Drive the usage of `inspect` down to four callsites.
- 78ea16b: Add highlight for board port hovers
- 8edcb12: Prevent accidental wiring of configurable ports outside of "advanced" mode
- 4a898eb: Introduce `GraphStore.graphs()`.
- 087280f: Fix main graph zooming
- 2d03abe: Add side nav
- b198059: Teach runtime and UI to duplicate boards & mods
- ccc1135: Restore back button in Activity
- 7ea05ca: Remove the use of `inspect` inside `packages/breadboard`.
- 8001cd3: Fix some UI colors
- a80d5b9: Teach user input & graph about module titles
- e9a22df: Prevent reference bubbles from stomping one another
- f8e1526: Make subitems a little more subtle
- cae3a3f: A plethora of bug fixes and polish
- ce0f654: Ensure target matrix has positive values
- d72a40b: Improve the workspace outline filter
- 3967bec: Improve reference drag and drop
- 3c19bc6: Fix overlaid module previews
- f9dc26b: Properly track deletions of edges and nodes.
- 3eff6c0: Improve workspace outline styling
- 18f9b8d: Delay initial non-animation render
- df6926d: A cornucopia of fixes and polish
- 35eb4e0: Update Project Listing Language Pack
- 0bc58ac: Wrangle graphs a little better
- 762e662: Teach Component Selector about kit toggling
- 409576b: Bring back side wire computation.
- fe69294: Teach selections about references
- 502d1fe: Only show graph outline when there are multiple graphs
- 1d58ff1: Handle PCM Audio
- b685d49: Remove `InspectableGraph.kits`.
- 02f905f: Further tweaks to new item overlay
- c55afe3: Fix the bug with only board server kits being sent to runBoard.
- ba78d58: Comment out the logic that causes transient outputs to be eaten.
- 9a966b4: Clean graph entities more readily
- f6f9adf: Improve the styling of the new workspace item overlay
- 80de5a3: Support shift+drag to move items between boards
- 45ac69f: Replace hard-coded strings with Language Pack in index
- 057113a: Improve handling of imperative boards
- d32cabe: Only enable dark theme when requested
- 7728225: Bring back the module preview
- 404a08f: Teach Graph Outline various tricks
- 671a25e: Fix embed issues
- 37c3f15: Add control over when to animate
- 4b3ae00: Update logo and inline SVG
- 99e1e48: Switch moduleId on deletion
- d7b3a53: Include edges in bounds calculations
- 0d5ff0f: Improve subgraph quick jump in workspace outline
- e528810: Move board info edit to overflow
- a8ca30b: Add sliding board selector
- 81b2de4: Remove list mode
- df9b8b9: Support subgraph visual controls
- 91e0930: Teach VE and Breadboard to invoke sub-boards properly.
- 5dbdf2f: Small tweaks to hierarchy
- 8ab7211: Update Workspace Outline strings
- 3025283: Teach Workspace Outline about selections
- 1c83e7d: Improve preview values
- 8619ff4: Teach transform matrix to account for comments
- def94be: Calculate dimensions when assigning port in `GraphPortLabel`.
- a4fee76: Make module preview work and teach backspace to behave when editing modules.
- 11e4c86: Fix a bunch of bugs I made last week.
- 93a0a94: Make board server components show in component selector.
- 573f1d5: Flatten paste structure and remove node types
- e145357: Fix a bug with phantom subgraphs.
- 35f2299: Add the ability to edit boards
- 0f3980f: Unstick graph renderer when hierarchy is enabled
- 99532f4: Inform node/edge caches when subgraphs are removed/added
- Updated dependencies [25dd1c2]
- Updated dependencies [45c7e5f]
- Updated dependencies [37e3fbd]
- Updated dependencies [71992c0]
- Updated dependencies [8722c8f]
- Updated dependencies [64bbe1b]
- Updated dependencies [e4631ff]
- Updated dependencies [96ea699]
- Updated dependencies [e22e33b]
- Updated dependencies [4a898eb]
- Updated dependencies [7ea05ca]
- Updated dependencies [cae3a3f]
- Updated dependencies [862c53c]
- Updated dependencies [f9dc26b]
- Updated dependencies [df6926d]
- Updated dependencies [84f6a3a]
- Updated dependencies [f6c31d3]
- Updated dependencies [2a6d643]
- Updated dependencies [183c9eb]
- Updated dependencies [c91a1ed]
- Updated dependencies [b685d49]
- Updated dependencies [a717ddc]
- Updated dependencies [46c9327]
- Updated dependencies [07b5676]
- Updated dependencies [66105f9]
- Updated dependencies [4eb6d6d]
- Updated dependencies [032d962]
- Updated dependencies [78da2ab]
- Updated dependencies [96b0597]
- Updated dependencies [404a08f]
- Updated dependencies [eb3fc28]
- Updated dependencies [df9b8b9]
- Updated dependencies [91e0930]
- Updated dependencies [2130bc6]
- Updated dependencies [d73587b]
- Updated dependencies [b23168c]
- Updated dependencies [e4521d9]
- Updated dependencies [a8eccc4]
- Updated dependencies [11e4c86]
- Updated dependencies [93a0a94]
- Updated dependencies [3ce820e]
- Updated dependencies [c6935b7]
- Updated dependencies [7ea3b85]
- Updated dependencies [99532f4]
  - @google-labs/breadboard@0.31.0
  - @breadboard-ai/data-store@0.3.0
  - @breadboard-ai/jsandbox@0.3.0
  - @breadboard-ai/build@0.11.1
  - @google-labs/breadboard-schema@1.11.0
  - @breadboard-ai/types@0.4.0

## 1.21.0

### Minor Changes

- a13caa0: Swap nav for open dialog
- f472c75: Introduce "Read From Doc" component.
- 4f49129: Migrate command palette to root
- 32b50af: Expose side wires in `InspectableGraph`.
- 1365f9d: Add `#computSideEdges` helper to compute side edges.
- c75e26f: Introduce Imperative Graphs.
- 856e249: Add some infrastructure for types to JSandbox.
- cc19e8c: Teach Visual Editor how to edit modules
- 2c7587a: Rename "Specialist" to "Model".

### Patch Changes

- 9250262: Various fixes in module editing.
- 97b85d4: A few more fixes while working with imperative modules.
- 1f91291: Add support for JS sources
- 8a590bc: More tweaks to module editor
- 5e53755: Start subgraph work
- 3e3fd65: Add a raft of improvements to module management
- 605af98: Start caching describer results.
- 57986da: Always show Example & Playground boards
- 426a2be: Various smaller tweaks to module editor
- 05a3904: Add prettier support to Module Editor
- 62d627f: Feed compiled JS from TS compiler.
- 552be88: Set TypeScript as the default module language
- 0df3c27: More module editor tweaks
- b541052: Raft of fixes for Module Editor
- e3b6040: Teach the command palette about recency
- 0f2a1da: Fix completion navigation
- 6fad5ba: Minor fixes for runJavascript rendering
- 0601a48: Fix compilation
- 0eb903c: Recreate env when module list changes
- 66041a7: Migrate to use `InspectableGraph.edit` for subgraph add/remove/replace.
- 335983b: Teach Module Editor to format on save
- 07c0720: Various improvements to the Module Editor
- e0d59b6: Teach Visual Editor how to change module language
- 032b9f6: Add error menu
- 9e5390d: Introduce Edit Transforms and start using them.
- 0e0bd49: Teach Module Editor about search; tidy overlay
- 4130fed: Add controls for imperative boards
- Updated dependencies [9250262]
- Updated dependencies [e37a9bf]
- Updated dependencies [a13caa0]
- Updated dependencies [1131130]
- Updated dependencies [97b85d4]
- Updated dependencies [ca466cd]
- Updated dependencies [669694a]
- Updated dependencies [18dace0]
- Updated dependencies [605af98]
- Updated dependencies [32b50af]
- Updated dependencies [19fc2d0]
- Updated dependencies [62d627f]
- Updated dependencies [74aa9b7]
- Updated dependencies [8d44489]
- Updated dependencies [ce3a00c]
- Updated dependencies [b541052]
- Updated dependencies [c75e26f]
- Updated dependencies [856e249]
- Updated dependencies [1f1f7bc]
- Updated dependencies [db52fbc]
- Updated dependencies [cc19e8c]
- Updated dependencies [d42ab17]
- Updated dependencies [9d5f11b]
- Updated dependencies [31ddc9a]
- Updated dependencies [66041a7]
- Updated dependencies [a934fe2]
- Updated dependencies [2c7587a]
- Updated dependencies [9e5390d]
- Updated dependencies [1fb9857]
  - @breadboard-ai/jsandbox@0.2.0
  - @google-labs/breadboard@0.30.0
  - @google-labs/breadboard-schema@1.10.0
  - @breadboard-ai/types@0.3.0
  - @breadboard-ai/build@0.11.0
  - @breadboard-ai/data-store@0.2.6

## 1.20.0

### Minor Changes

- 4dc21f4: Implement basic Google Drive Board Server
- 55674b8: Add support for calling Gemini for sideboards.
- 1ce1af8: Introduce new Board Activity
- 83b735f: Introduce "Context To Slides" component.
- 71d42aa: Teach Visual Editor to run step by step.
- 1fc5812: React to component edits correctly.
- e014e42: Introduce "component" tag and user custom kits.
- d7f04f2: Start removal of provider scaffolding
- 8b8a0cf: Switch Board Servers on by default
- ee2844b: Teach Visual Editor about different edge states.
- 15d3b74: Make "Show Run Node" button appear only when it's possible to run a node.
- 3dcbf03: Teach Google Drive Board Server to save board metadata.
- bdf80d8: Teach Google Drive board server to refresh credentials.
- cf74d3d: (Re-)Introduce node runner
- 4c71e39: Introduce (entirely stubbed out) Google Drive board server.
- 29762d6: Implement "Re-run from this node" feature.
- bf69ac9: Teach Specialist to be more robust with routes.

### Patch Changes

- 5812884: Prototype composite boards
- 4fb645c: Show node type descriptions by default
- e8e4232: Set edge values to "consumed" on nodeend.
- ff6e3e0: Fix the problem where outgoing edges aren't cleared on edit.
- 0e84b38: Fix configurator deeplink
- 2526901: Filter out board servers that can't be written into in Save overlay.
- 25905c9: Switch Debug button back to Run
- 814db04: Simplify Board Activity a little
- 5f4d8eb: Improve debug controls
- ed08f2c: Update drag-dock overlay style
- fd3667f: Update board details overlay
- ee0870c: Improve error rendering
- b043b4d: Offer enhancement button
- 1cf2285: Prevent leading numbers at the start of IDs
- 4375cd1: Apply enhancements ephemerally
- 8fdce2b: Add "regenerate value" button
- b4c5848: Fix stale LLM Input data
- 6215ade: Synchronize activity log with visual editor when component is edited.
- 29f7ad4: Various small UI tweaks for GDrive
- 9a0f027: Add run button to node configurator
- 01846fa: Add basic debug controls
- b6eb227: Improve UX of GDrive Board Server
- 7daf4f2: Cancel any pending autosave when a user has interacted
- 1260786: Improve secret rendering in Board Activity
- 7cd9014: Update edge value inspector styles
- 1741928: Small UI tweaks
- f284ca8: Migrate graph node footer back to header
- 850c217: Unbreak serialization.
- 9fc85a6: Narrow schema type automatically
- 0ad35bd: Fix missing icons
- 814e95c: Only show 'regenerate' for non-inputs
- 3b8f814: Fix reset & input defaults
- 530d7d2: Fix Activity Marker line height
- 47606e3: Add support for secondary actions on overflow menus
- 514136d: Fix user choices
- c6f1a69: Fix save behavior
- 9756889: Fix UI render bugs
- ae8bd19: More provider changes
- 2fffc7a: Reinstate export button for Board activity
- 14bd092: Fix LLM Input menu when items is disallowed
- 2510120: Show board selector when needed
- 08b71d6: Place outputs at the bottom of the node
- 6726e5a: Teach user-input about module behavior
- 64e6b88: Allow underscores in edge names
- 03d061c: Dispose of toasts
- cd09c03: Allow compound enhancement & resets
- 950443f: Attempt autofocus when running boards
- 77e1e1d: Fix LLM Inputs
- eb61b4f: Add more icons to components
- Updated dependencies [4dc21f4]
- Updated dependencies [71d42aa]
- Updated dependencies [1fc5812]
- Updated dependencies [63abd70]
- Updated dependencies [e014e42]
- Updated dependencies [6215ade]
- Updated dependencies [661beea]
- Updated dependencies [850c217]
- Updated dependencies [ee2844b]
- Updated dependencies [39d1913]
- Updated dependencies [bdf80d8]
- Updated dependencies [29762d6]
- Updated dependencies [c6f1a69]
- Updated dependencies [5332cbc]
- Updated dependencies [db93a6a]
- Updated dependencies [2d5b24e]
- Updated dependencies [8f079a1]
  - @google-labs/breadboard@0.29.0
  - @google-labs/breadboard-schema@1.9.0
  - @breadboard-ai/types@0.2.0
  - @breadboard-ai/connection-client@0.1.0
  - @breadboard-ai/build@0.10.5
  - @breadboard-ai/data-store@0.2.5

## 1.19.0

### Minor Changes

- 9d31e85: Update edge rendering
- 4630d8c: Teach paste machinery about constant edges.
- 4857c1e: Lots of smaller board server fixes
- 646504f: Display ID of the property in the Schema editor.

### Patch Changes

- b1dfa20: Add back button to board activity overlay
- 358d116: Add initial support for Board Server Kits
- be6656d: Support ID editing in streamlined schema editor
- 250dc44: Move Component Selector to overlay
- 0884913: Various QoL improvements
- e4a9453: Tidy up Board Server Kit
- 3e04cb3: Teach drag-dock-overlay to recall dock position
- a53f7e7: Teach drag-dock-overlay about persistence
- 71bd9a7: Update streamlined schema editor
- 683bab9: Teach component selector to avoid animating when persistent
- 4ec74a0: Teach streamlined schema editor to have stable property ordering
- 2db4eeb: Add location proxy to LLM Input
- 54eb2f3: Improve remote provider load behavior
- 8e793ad: Retain custom view when ID changes
- acf554c: Be stricter with isText checking
- fa87883: Ensure nav copes with Provider -> BSS switch
- ffbcf09: Allow management of Board Servers
- 7adeed8: Move LLMContent to types package.
- b5981d0: Set url for the component board.
- 51c2c39: Fix star port loop
- d447a7f: Visual tweaks for drag-dock & component selector
- 1d6d7a3: Teach board activity to be dockable
- Updated dependencies [5aded4a]
- Updated dependencies [b640cd2]
- Updated dependencies [ffbcf09]
- Updated dependencies [7adeed8]
- Updated dependencies [ca5f932]
- Updated dependencies [b5981d0]
- Updated dependencies [049a83b]
- Updated dependencies [c031dd6]
  - @google-labs/breadboard@0.28.0
  - @breadboard-ai/data-store@0.2.4
  - @breadboard-ai/types@0.1.2
  - @breadboard-ai/build@0.10.4

## 1.18.2

### Patch Changes

- Updated dependencies [d20e867]
  - @breadboard-ai/types@0.1.1
  - @google-labs/breadboard@0.27.3
  - @breadboard-ai/build@0.10.3

## 1.18.1

### Patch Changes

- 6ab0acd: Introduce drag-dock-overlay
- 7921983: Introduce `@breadboard-ai/types` package.
- 6b3ba07: Provide a single empty LLM Content to `bb-llm-input-array` when no default.
- f89b60e: Tweak corner radius
- Updated dependencies [370b7ca]
- Updated dependencies [7921983]
  - @google-labs/breadboard@0.27.2
  - @breadboard-ai/types@0.1.0
  - @google-labs/breadboard-schema@1.8.1
  - @breadboard-ai/build@0.10.2

## 1.18.0

### Minor Changes

- 2781bae: Offer super-nice board server first-run experience.
- 1799348: Introduce Streamlined Schema Editor

### Patch Changes

- 3fcecff: Teach Streamlined Schema Editor to use CodeMirror
- 418c586: Various UI fixes
- 564850b: Fix the death loop with node selector in the new ribbon UI.
- a2503de: Show node description in Activity Log outputs
- 4667d78: Add "delete property" button
- 33f5f83: Update node selector
- b5cada9: Introduce ribbon menu
- Updated dependencies [690ebe6]
- Updated dependencies [5c015f2]
  - @breadboard-ai/build@0.10.1
  - @google-labs/breadboard@0.27.1

## 1.17.0

### Minor Changes

- ab92d99: Plumb edge value data to the GraphRenderer.
- 8f9fddf: Move LightObserver to shared-ui as TopGraphObserver.
- 508c4b3: Plumb through edge highlighting and inner activity.
- 033d656: Teach VE to autosave boards
- f61ccf3: Introduce URL-based component types.
- 12cdec3: Improve tab handling
- 9a9f5c2: Move activity to overlay
- 65c0449: Teach TopGraphObserver about various activity types, especially errors.
- 9c878e2: Start work on a runtime API
- 2f68f71: Move node meta into configurator
- 8540b93: Convert Content to Build API and merge Specialist 2 to Specialist.
- 81eafad: Implement selecting runs and viewing them.
- 4c03455: Introduce Specialist 2 and make Content component support LLM Content.
- d0f99b4: Restyle graph nodes
- 392d7cd: Switch global configurator for per-port
- 3e5f3dc: Add support for "Configured" in property schema editor.
- 77dd2a4: Provide node acitivities out of TopGraphObserver.
- 9fe7d4f: Add multi-tab support
- 8c73da3: Integrate TopGraphObserver into Visual Editor.
- 8572be4: Update UI ready for Runs
- df9b158: Add indicators on edges; use activity log lite
- 93a1d7c: Make "advanced ports" a per-component setting.
- 28e0262: Plumb edge value schema to edge overlay
- a049abf: Move more things into runtime
- ec55e54: Automatically pan/zoom to currently running node
- d7606d3: Implement plumbing for visualizing runs as graphs.
- a6128a3: Switch Visual Editor to use Run API.
- 0088ede: Allow configuring all ports (except start/control) in advanced expansion state.
- d0e894d: Add Edge Value overlay

### Patch Changes

- 7fd41bb: Some minor UI tweaks
- 2726cb8: Add minimize/maximize button to overlays
- fe61245: Fix node dimension calculations
- 3d4ca21: Make port preview more robust
- bc967e3: Re-render and emit input event when adding parts in llm-input.
- e6e165d: Show star values in edge inspector
- 981bd9e: Align IDB with Board Servers in nav
- 5bf9e8d: More tab improvements
- e543b2e: Unbreak the app view and only store top graph edge values.
- 7929eee: Reset debugEvent when changing runs
- fd69479: Recover from bad node types
- b8547b8: Fix pinch zoom in read-only mode
- 1f11bf3: Switch follow to using Local Storage
- 77fab49: Account for output ports in node height calc
- 4e00d85: Update URL whenever a tab closes
- 2ccac87: Fix a bug where BGL wouldn't paste into the editor.
- 8efca60: Unclamp llm-output height
- 2ebed5f: Make some minor tweaks to port labels
- 4f4f3ee: Include all ports in configurator
- b84b71b: Fix bug with port selection
- 9254424: Add setting for autosave
- 3e68ec2: Save pending configuration with board
- 5990fd0: Add message for secrets and API keys
- b6eeb3e: Show Activity Marker on graph nodes
- ee56556: Fix comment deletion behavior
- e63b5dd: Polish Specialist and Content.
- 0b78f92: Recognize that sometimes there are no prior runs when initializing RunDetails.
- cbc418b: Ensure that the final node is included in TGO
- e723c09: Couple of minor tweaks
- edefaf9: Add tooltip support
- 409a07e: Restore comment edit ability
- 502e6d5: Show configured nodes as blue rather green
- c36391c: Various small fixes
- 0ab2355: Account for "error" in TGO state.
- f0ce284: Provide accurate run status information via TopGraphObserver.
- cc72dcc: Set runs to be read-only
- 890b8a2: Fix layout reset bug
- 1ad3001: Show configuration previews underneath ports
- 863c3e8: Remove the spurious null-coalescing operator.
- 77d9497: Restore Activity Log
- 09b1a4e: Generate friendlier ID for Graph-based component types.
- 3abc5f6: Teach node-selector to remember search value.
- cac51cb: Teach runtime about tab types
- 679119f: Remove auto-submit machinery
- 852160e: Allow overlays to move & resize
- 71b8727: Teach the sidebar not to jump in vertical mode.
- 40988de: Teach SecretsHelper about the timing of secrets-related events.
- Updated dependencies [49e2740]
- Updated dependencies [54c8197]
- Updated dependencies [703f17d]
- Updated dependencies [8d06f3c]
- Updated dependencies [6136d87]
- Updated dependencies [cb8c99a]
- Updated dependencies [2f1b85c]
- Updated dependencies [4dadf16]
- Updated dependencies [c145fdd]
- Updated dependencies [226be62]
- Updated dependencies [8f9fddf]
- Updated dependencies [2fa05f0]
- Updated dependencies [f61ccf3]
- Updated dependencies [e61fa66]
- Updated dependencies [f71bcfb]
- Updated dependencies [a104fa7]
- Updated dependencies [8a1b8c4]
- Updated dependencies [3188607]
- Updated dependencies [9797718]
- Updated dependencies [8540b93]
- Updated dependencies [81eafad]
- Updated dependencies [4c03455]
- Updated dependencies [3137076]
- Updated dependencies [157c31e]
- Updated dependencies [4cc71ee]
- Updated dependencies [8330f0c]
- Updated dependencies [a039d2e]
- Updated dependencies [1423647]
- Updated dependencies [9783ba8]
- Updated dependencies [6cdf20c]
- Updated dependencies [f63a497]
- Updated dependencies [aafec7f]
- Updated dependencies [1ad3001]
- Updated dependencies [91fe8bb]
- Updated dependencies [100fc95]
- Updated dependencies [cab83ce]
- Updated dependencies [e19f046]
- Updated dependencies [5834c81]
- Updated dependencies [d7606d3]
- Updated dependencies [0ef793f]
- Updated dependencies [84ca649]
- Updated dependencies [d9fd0ab]
- Updated dependencies [a6128a3]
  - @breadboard-ai/build@0.10.0
  - @google-labs/breadboard@0.27.0
  - @google-labs/breadboard-schema@1.8.0
  - @breadboard-ai/data-store@0.2.3

## 1.16.1

### Patch Changes

- fa8a752: Fix a few nagging bugs in the Component Configuration view.
- 125cf75: Fix bug relating to input events with Google Drive input widgets
- Updated dependencies [bbcdd2d]
- Updated dependencies [9ed58cf]
- Updated dependencies [7f2ef33]
- Updated dependencies [7d46a63]
- Updated dependencies [bac2e35]
- Updated dependencies [ec2fedd]
  - @breadboard-ai/build@0.9.1
  - @google-labs/breadboard@0.26.0
  - @breadboard-ai/data-store@0.2.2

## 1.16.0

### Minor Changes

- cacd8e2: Introduce HTML preview for llm-output.
- 001b250: Add support for unclamped outputs
- de90fb7: Extract UI to packages/shared-ui
- 28895c3: Add support for inline controls

### Patch Changes

- 49b3612: Restore preview functionality
- d799af1: Apply some polish to .app view
- c1e21f7: Move configuration to inline controls
- 9998938: Configure connection server URL via environment variable
- Updated dependencies [cc5f4b6]
- Updated dependencies [49b3612]
- Updated dependencies [e0dccfe]
- Updated dependencies [6404cb3]
- Updated dependencies [9ad0524]
- Updated dependencies [a4301e6]
- Updated dependencies [7fdd660]
- Updated dependencies [a940b87]
- Updated dependencies [b201e07]
- Updated dependencies [15b5659]
- Updated dependencies [374ea85]
- Updated dependencies [0296c89]
- Updated dependencies [a34bb69]
- Updated dependencies [534d67e]
- Updated dependencies [c397d53]
- Updated dependencies [f93ec06]
- Updated dependencies [398bf4f]
- Updated dependencies [7de241c]
- Updated dependencies [a424c92]
- Updated dependencies [c2cd40d]
- Updated dependencies [262cefd]
- Updated dependencies [79d709c]
  - @breadboard-ai/build@0.9.0
  - @google-labs/breadboard@0.25.0
  - @breadboard-ai/data-store@0.2.1
  - @google-labs/breadboard-schema@1.7.0
