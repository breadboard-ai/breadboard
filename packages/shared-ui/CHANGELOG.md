# @breadboard-ai/shared-ui

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
