# @google-labs/breadboard-web

## 1.28.0

### Minor Changes

- 470e548: Start landing connector infrastructure.
- 65b33ff: Remove spurious "Run Stopped" on finished run.
- e21ee39: Implement autonaming behind flag.
- 66a01e0: Make autoname more polite to user.
- fedacbd: Expose `/env/settings/general` to module file system and use it to
  hide experimental bits.
- dab4f44: Add "Remix" button to the main editor.
- 0ff2c4f: Add app view to unified server
- bc6a69c: Remove legacy renderer
- fd23454: Introduce embedded board server and use it for A2 server.
- 9203afc: Only allow invoking modules in A2.
- 7e0b806: Introduce DOM Renderer
- 7c6388f: Disable autonaming once user edits title/description.
- 0c6ad80: Plumb Graph metadata as `/env/metadata` and teach "Render Outputs" to
  use it to pick theme colors.
- b62fb04: Introduce `SideBoardRuntime.runTask`.
- 3128d36: Rename "Render Outputs" to "Display" and update icons.
- 34e24f0: Implement MCP connector.
- e307f33: Clean up sideboards and switch Autoname to use embedded A2.
- 06aafd9: Switch theme creator sideboard to use embedded A2.
- 0c9b3a0: Remove example boards and playground boards from visual editor.
- 8ce093a: Add "Create New Document" to Google Drive file picker and many other
  fixes.
- 4a53e80: Move SideboardRuntime into its own class.
- 49ff87e: Introduce `ClipboardReader`.
- 27b9c34: Unify the create and app views
- d4d4976: Enable subgraph autonaming by default.
- 9f87f37: First complete rev of Connector machinery.
- 7f5e68e: Stop loading legacy kits in unified server.
- 5aeb84c: Teach BoardServerAwareDataStore to choose the main graph URL to find
  the right board server.

### Patch Changes

- b20067e: Fix fonts so they are consistent
- 580b154: Simplify main overflow menu
- 49ac76c: Teach "Ask User" to be at-wireable.
- b8e5d8e: Teach Fast Access, Text Editor and Graph about params
- cedeb8a: Allow running of imperative graph
- 298aaaa: Update step management UI
- 97be783: Add assets to the graph
- 4659244: Switch out icons
- 5e05aff: Update app view to use newer theme info
- 42f34b8: Align A2 configurations
- 43c8675: Start work on asset menu in shelf
- 50a22e9: Promote Focus Editor to main
- 76f924c: Remove save-as behavior
- ac0f7b5: Teach Asset Organizer about unused params
- 6437ff9: Teach app view about various input modalities
- ad1209a: Teach DOM Renderer about moving nodes
- b0f917a: Teach asset organizer to add/edit parameter metadata #4814
- 41e5ca2: Introduce an editor side panel
- a7b3314: Improve theme updating
- 3d5eeb7: Allow users to update the title and description of apps using the
  app-preview
- 798bd91: Teach DOM Renderer about edge attachment moving
- 22c1f73: Add basic UI support for `hint-controller`
- 45c75ce: Remove the "Unable to connect to board server" error for newcomers.
- b28c108: Remove edit pencil
- e78dc5e: Convert arrows to beziers
- 49328ed: Ask vite to ignore `.wireit` and other unimportant dirs.
- 2be935a: Fix paste behaviors
- 736c829: Show custom steps in selector
- 04afc35: Teach Visual Editor about grouping and ungrouping
- 17bc777: Teach DOM Renderer about drag and drop
- 0e201da: Teach DOM Renderer about node statuses
- af190a1: Improve transform order when assets etc are removed
- a04deb3: Add asset edge management
- eb745e0: Fix case where stale port data is shown
- 15a3f22: Various UI fixes
- 5e98a8a: Add extended settings searchParam check
- fde6578: Teach board server machinery that BOARD_SERVICE might be optional.
- 223c73e: Teach sideboard runner about proxies
- a141bd4: Properly localize titles for untitled boards.
- 15b96a9: Bring back renaming & exporting of graph items
- 5b234da: Remove deprecated elements
- e9f7282: Teach listing about thumbnails
- 336b628: Teach App View about GDrive
- 9155162: Teach app view about thoughts
- 333a4db: Add node-with-edge transform
- 5357e88: Improve edge management
- ee084e8: A bunch of fixs to bring app view back up again.
- 4ceaf9e: Teach DOM Renderer about creating edges
- Updated dependencies [27ae371]
- Updated dependencies [228d3c4]
- Updated dependencies [470e548]
- Updated dependencies [ab8b1db]
- Updated dependencies [8eba7c4]
- Updated dependencies [6596b6d]
- Updated dependencies [81d2666]
- Updated dependencies [99555ff]
- Updated dependencies [ac39a64]
- Updated dependencies [00d99f4]
- Updated dependencies [4371756]
- Updated dependencies [60d0f38]
- Updated dependencies [600abe3]
- Updated dependencies [c61a5d3]
- Updated dependencies [3823d5e]
- Updated dependencies [ae798d3]
- Updated dependencies [30578bc]
- Updated dependencies [3de4459]
- Updated dependencies [26fdb89]
- Updated dependencies [995b231]
- Updated dependencies [a18d4d0]
- Updated dependencies [8537c16]
- Updated dependencies [013d624]
- Updated dependencies [b20067e]
- Updated dependencies [e76a576]
- Updated dependencies [580b154]
- Updated dependencies [eada90d]
- Updated dependencies [394daae]
- Updated dependencies [53f53b0]
- Updated dependencies [ca6b1af]
- Updated dependencies [668f490]
- Updated dependencies [9d75ab2]
- Updated dependencies [2b5e8da]
- Updated dependencies [7bbc529]
- Updated dependencies [01eb8d8]
- Updated dependencies [49ac76c]
- Updated dependencies [c788caa]
- Updated dependencies [b8e5d8e]
- Updated dependencies [e21ee39]
- Updated dependencies [66a01e0]
- Updated dependencies [8abad23]
- Updated dependencies [0810b47]
- Updated dependencies [b393b0d]
- Updated dependencies [fedacbd]
- Updated dependencies [856c387]
- Updated dependencies [4fb9548]
- Updated dependencies [0c0a419]
- Updated dependencies [79ed176]
- Updated dependencies [2484861]
- Updated dependencies [cbd054b]
- Updated dependencies [e7abb8a]
- Updated dependencies [f11621f]
- Updated dependencies [c758054]
- Updated dependencies [0606a47]
- Updated dependencies [1429a75]
- Updated dependencies [03d6689]
- Updated dependencies [0487137]
- Updated dependencies [a63fb1e]
- Updated dependencies [96709bd]
- Updated dependencies [af10dc4]
- Updated dependencies [cedeb8a]
- Updated dependencies [a2d4ee5]
- Updated dependencies [298aaaa]
- Updated dependencies [01d42eb]
- Updated dependencies [dab4f44]
- Updated dependencies [5842ecf]
- Updated dependencies [398ac99]
- Updated dependencies [97be783]
- Updated dependencies [53d6241]
- Updated dependencies [4659244]
- Updated dependencies [9a078bd]
- Updated dependencies [fa670bc]
- Updated dependencies [fae6d68]
- Updated dependencies [3dab17c]
- Updated dependencies [8cffe63]
- Updated dependencies [0ff2c4f]
- Updated dependencies [a84201a]
- Updated dependencies [9ba5774]
- Updated dependencies [bc6a69c]
- Updated dependencies [5e05aff]
- Updated dependencies [8dfa0f3]
- Updated dependencies [42f34b8]
- Updated dependencies [411fb40]
- Updated dependencies [43c8675]
- Updated dependencies [63ab291]
- Updated dependencies [9f82224]
- Updated dependencies [11a6c4a]
- Updated dependencies [5c6a3bc]
- Updated dependencies [eaae0ca]
- Updated dependencies [2eee8da]
- Updated dependencies [e1a1696]
- Updated dependencies [50a22e9]
- Updated dependencies [8008d80]
- Updated dependencies [c575292]
- Updated dependencies [0bde091]
- Updated dependencies [f337039]
- Updated dependencies [f3f1060]
- Updated dependencies [90beb79]
- Updated dependencies [a564054]
- Updated dependencies [e24c47d]
- Updated dependencies [f75eb53]
- Updated dependencies [46c749d]
- Updated dependencies [fd23454]
- Updated dependencies [c0d7bcc]
- Updated dependencies [bd3a6dc]
- Updated dependencies [72f6f4b]
- Updated dependencies [6855223]
- Updated dependencies [913bc45]
- Updated dependencies [2ce0c63]
- Updated dependencies [ac0f7b5]
- Updated dependencies [9203afc]
- Updated dependencies [6437ff9]
- Updated dependencies [7e17fe2]
- Updated dependencies [ad1209a]
- Updated dependencies [9bab4f4]
- Updated dependencies [7e0b806]
- Updated dependencies [0e6f849]
- Updated dependencies [d9e6563]
- Updated dependencies [b0f917a]
- Updated dependencies [dce4fe8]
- Updated dependencies [6ad43c4]
- Updated dependencies [41e5ca2]
- Updated dependencies [7c6388f]
- Updated dependencies [6333fa2]
- Updated dependencies [d30e1a9]
- Updated dependencies [2074b64]
- Updated dependencies [c4d29c0]
- Updated dependencies [4e4efc6]
- Updated dependencies [cc3bab5]
- Updated dependencies [12cec82]
- Updated dependencies [500efd2]
- Updated dependencies [f64a87f]
- Updated dependencies [3d5eeb7]
- Updated dependencies [2c27b5f]
- Updated dependencies [edbc353]
- Updated dependencies [4f0b23e]
- Updated dependencies [ed4cf99]
- Updated dependencies [2e70d94]
- Updated dependencies [798bd91]
- Updated dependencies [22c1f73]
- Updated dependencies [55b02bf]
- Updated dependencies [2d5b5fe]
- Updated dependencies [a8fafd0]
- Updated dependencies [f958cc2]
- Updated dependencies [0c6ad80]
- Updated dependencies [e78dc5e]
- Updated dependencies [b62fb04]
- Updated dependencies [08972a2]
- Updated dependencies [ebdc849]
- Updated dependencies [3128d36]
- Updated dependencies [2be935a]
- Updated dependencies [b39bc95]
- Updated dependencies [a53adf0]
- Updated dependencies [736c829]
- Updated dependencies [0b48053]
- Updated dependencies [da0a7a2]
- Updated dependencies [669b6f6]
- Updated dependencies [410bc4e]
- Updated dependencies [17210fc]
- Updated dependencies [04afc35]
- Updated dependencies [17bc777]
- Updated dependencies [0b83587]
- Updated dependencies [6a328df]
- Updated dependencies [bea10c4]
- Updated dependencies [763063b]
- Updated dependencies [230101e]
- Updated dependencies [2164f57]
- Updated dependencies [0e201da]
- Updated dependencies [7b5f10f]
- Updated dependencies [34e24f0]
- Updated dependencies [597e613]
- Updated dependencies [ae68b4d]
- Updated dependencies [99a5d95]
- Updated dependencies [e307f33]
- Updated dependencies [06aafd9]
- Updated dependencies [0c9b3a0]
- Updated dependencies [eba969c]
- Updated dependencies [af190a1]
- Updated dependencies [a04deb3]
- Updated dependencies [eb745e0]
- Updated dependencies [b9681e9]
- Updated dependencies [0996277]
- Updated dependencies [8ce093a]
- Updated dependencies [7eae5b1]
- Updated dependencies [72539b6]
- Updated dependencies [ff4864a]
- Updated dependencies [ffa44d2]
- Updated dependencies [15a3f22]
- Updated dependencies [e0aefd1]
- Updated dependencies [8f83f7a]
- Updated dependencies [5e98a8a]
- Updated dependencies [053ccbd]
- Updated dependencies [7734a89]
- Updated dependencies [da380d1]
- Updated dependencies [223c73e]
- Updated dependencies [e82924e]
- Updated dependencies [7b67a8c]
- Updated dependencies [78c5333]
- Updated dependencies [f7bb416]
- Updated dependencies [fea9351]
- Updated dependencies [15b96a9]
- Updated dependencies [5b234da]
- Updated dependencies [a11b943]
- Updated dependencies [e9f7282]
- Updated dependencies [0c95613]
- Updated dependencies [336b628]
- Updated dependencies [9155162]
- Updated dependencies [b3ab629]
- Updated dependencies [49ff87e]
- Updated dependencies [0d0953e]
- Updated dependencies [333a4db]
- Updated dependencies [b641a6f]
- Updated dependencies [ff59f4e]
- Updated dependencies [e5a7b77]
- Updated dependencies [1122a5a]
- Updated dependencies [10c7441]
- Updated dependencies [bcfc401]
- Updated dependencies [c9fb81f]
- Updated dependencies [a6a0533]
- Updated dependencies [ec25bbe]
- Updated dependencies [99dd67b]
- Updated dependencies [c8876ee]
- Updated dependencies [27b9c34]
- Updated dependencies [b88eba4]
- Updated dependencies [d4d4976]
- Updated dependencies [9f87f37]
- Updated dependencies [5357e88]
- Updated dependencies [86e23ef]
- Updated dependencies [e58b680]
- Updated dependencies [90191c3]
- Updated dependencies [8feb690]
- Updated dependencies [eef58fa]
- Updated dependencies [6c846f0]
- Updated dependencies [ee084e8]
- Updated dependencies [5aeb84c]
- Updated dependencies [78f2b59]
- Updated dependencies [6dcb6ed]
- Updated dependencies [c92c9c1]
- Updated dependencies [0167b2a]
- Updated dependencies [e8d271e]
- Updated dependencies [51ad7fd]
- Updated dependencies [4ffd3a1]
- Updated dependencies [1838960]
- Updated dependencies [cb01e87]
- Updated dependencies [06f21e1]
- Updated dependencies [f78a1ae]
- Updated dependencies [62d04cd]
- Updated dependencies [4ceaf9e]
- Updated dependencies [dc544cc]
- Updated dependencies [f11621f]
  - @breadboard-ai/shared-ui@1.25.0
  - @breadboard-ai/manifest@0.10.0
  - @breadboard-ai/types@0.7.0
  - @breadboard-ai/a2@0.4.0
  - @google-labs/breadboard@0.34.0
  - @google-labs/core-kit@0.19.0
  - @breadboard-ai/jsandbox@0.6.0
  - @breadboard-ai/bbrt@0.3.0
  - @google-labs/agent-kit@0.18.0
  - @breadboard-ai/google-drive-kit@0.6.0
  - @breadboard-ai/board-server-management@1.21.0
  - @breadboard-ai/build@0.12.2
  - @breadboard-ai/data-store@0.3.3
  - @breadboard-ai/board-server-utils@0.1.10
  - @google-labs/gemini-kit@0.11.3
  - @breadboard-ai/idb-board-server@1.19.4
  - @google-labs/json-kit@0.3.17
  - @google-labs/template-kit@0.3.19
  - @breadboard-ai/python-wasm@0.1.15

## 1.27.0

### Minor Changes

- b852b6c: Update app view
- 0728238: Mark "@" references as invalid when a connecting edge is removed.
- dd6b9c1: Teach board server about Gemini File API.
- 4d86a09: Teach GOAL about multiple tools, structured response, and sequential
  strategy.
- e8abf9f: Teach breadboard about default configuration.

### Patch Changes

- 0693856: Prototype viewing files
- 4ed89ea: Teach asset organizer et al about YouTube videos
- 98f6609: Streamline new flow creation
- 4869ce6: Teach LLM Output about PDFs
- 6a48bb9: Improvements to focus editor
- 1de370a: Enable asset renaming
- 500d312: Restore app version to bottom of home page
- 4fada5e: Update build info
- 44fb75c: Prototype generating preview assets
- e6745a7: Prototype "focus editor"
- ab026cc: Teach GraphNode to render chiclets
- Updated dependencies [0693856]
- Updated dependencies [f466c2d]
- Updated dependencies [24050c5]
- Updated dependencies [90cf916]
- Updated dependencies [9520306]
- Updated dependencies [f01e80f]
- Updated dependencies [698ee78]
- Updated dependencies [4ed89ea]
- Updated dependencies [c97b5a2]
- Updated dependencies [b852b6c]
- Updated dependencies [db2e586]
- Updated dependencies [0728238]
- Updated dependencies [2b98499]
- Updated dependencies [51801a6]
- Updated dependencies [7c30e7d]
- Updated dependencies [bf71366]
- Updated dependencies [d74bf35]
- Updated dependencies [98f6609]
- Updated dependencies [3547630]
- Updated dependencies [4869ce6]
- Updated dependencies [2d27918]
- Updated dependencies [211f62b]
- Updated dependencies [19c9a72]
- Updated dependencies [43d1f2b]
- Updated dependencies [6a48bb9]
- Updated dependencies [1de370a]
- Updated dependencies [dd6b9c1]
- Updated dependencies [500d312]
- Updated dependencies [44fb75c]
- Updated dependencies [038cfc3]
- Updated dependencies [b872936]
- Updated dependencies [9625ca9]
- Updated dependencies [e6745a7]
- Updated dependencies [e018c92]
- Updated dependencies [e16bdc1]
- Updated dependencies [3d600e8]
- Updated dependencies [7a65e63]
- Updated dependencies [3ec8d52]
- Updated dependencies [6ec879e]
- Updated dependencies [fc1e080]
- Updated dependencies [6aaa09b]
- Updated dependencies [a09a9c3]
- Updated dependencies [b7724a0]
- Updated dependencies [e8abf9f]
- Updated dependencies [838ebed]
- Updated dependencies [0ded306]
- Updated dependencies [7f01ea7]
- Updated dependencies [a638ffa]
- Updated dependencies [ab026cc]
- Updated dependencies [e2978ce]
- Updated dependencies [1abb0e3]
  - @breadboard-ai/shared-ui@1.24.0
  - @breadboard-ai/bbrt@0.2.1
  - @google-labs/breadboard@0.33.0
  - @breadboard-ai/manifest@0.9.0
  - @breadboard-ai/types@0.6.0
  - @breadboard-ai/jsandbox@0.5.0
  - @google-labs/agent-kit@0.17.0
  - @breadboard-ai/board-server-management@1.20.1
  - @breadboard-ai/board-server-utils@0.1.9
  - @breadboard-ai/build@0.12.1
  - @google-labs/core-kit@0.18.1
  - @breadboard-ai/data-store@0.3.2
  - @breadboard-ai/example-boards@0.4.1
  - @google-labs/gemini-kit@0.11.2
  - @breadboard-ai/idb-board-server@1.19.3
  - @google-labs/json-kit@0.3.16
  - @google-labs/template-kit@0.3.18
  - @breadboard-ai/google-drive-kit@0.5.1
  - @breadboard-ai/python-wasm@0.1.14

## 1.26.0

### Minor Changes

- 6c223a9: Create an easy way for Visual Editor to handle sign in.
- db124b2: Switch Visual Editor and Unified Server to use statically-linked
  kits.
- 59d6fe7: Store assets as references to blobs.
- 925e4bf: Introduce "main-port" behavior and start using it.
- e178790: Implement sign out.
- 9ffe9ee: Make autowire work with "Make Text" and "Make I mage"
- c6f9889: Start all new graphs with a really blank template.
- a2e7a36: Add support for {{asset}} and {{in}} params in A2.
- 65f89e0: Introduce Organizer to visual editor.
- 491b152: Make connections server and npm run dev work properly.
- eaef053: Add support for private boards.
- a44e8bc: Don't show board server selector by default.
- 75a2030: Remove unused components
- 74124b8: Use "generative" icon in A2 components.
- 63a1930: Introduce presentation hints and icon on Schema.
- dd0015e: Teach Visual Editor about the full power of the "@" symbol.
- 40a8568: Introduce sign in plumbing to Visuale Editor runtime.
- 2429df0: Teach board server to use access tokens.
- 8e2fc1f: Implement API that allows rendering Fast Access menu (fka "@" menu).

### Patch Changes

- b3a39ad: Implement and refine "Ask User" component.
- 70a0896: Change the default view
- efd3a58: Add icon for summarize
- 91b0af7: Create Asset Viewer
- 3af8f62: Introduce ChatController, an abstraction to manage chat state.
- c737f6b: Convert to use standard ES decorators.
- 220f27a: A2-related UI polish
- 9dffc14: Update start view
- 43f5402: Displays "Add item" when there are no components
- f11be69: Add inline values, tidy graph rendering
- 67561d6: Introduce basic Fast Access support
- 99e2899: Teach GraphNodes to retain their output heights
- 724069f: One more round of polish for A2.
- 389c631: Trim the UI a little
- a2b9fca: Add ability to organize assets
- 95a8265: Add presentation hints for outputs
- 263bc1c: Add presentation hint to port render
- 782b7e4: Improve the app chat UI
- a128d88: Add placeholder controls for app preview
- 0b07d7d: Update asset organizer styles
- 7edd2fc: Update home page
- 750499a: Stub out A2 tools
- 0ad7660: Improve home screen again
- 948b50c: Introduce Combine Outputs component.
- 0cfe873: Teach graph node to show a message when details are missing
- 9843e23: Switch activity for console
- 83bdea5: Show outputs in configurator
- bdf469e: Make unified server run in dev mode.
- 44d6e2e: Polish "Combine Outputs".
- c7c9a9c: Reload on sign-in
- a8cca57: Enable text pasting in text-editor
- c5adbdf: Tidy the app preview a little
- 5e1e24c: Colorize nodes
- 664db61: Various small UI fixes
- f6223cd: Reduce config code duplication between various servers
- be771bf: Prototype "Make Code"
- 4a7ab2b: Improve audio handling
- 79ba6e1: Move most board constructing code to runtime.
- 7895c03: Add chat to popout
- 235f33d: Theme Audio Handler based on `role`
- b4b09a2: Make visual editor receive keyboard shortcuts again.
- c434112: Add a lightweight preview for boards
- 30b8f91: Add "Quick Add" to graph renderer
- fc2dda1: Update test project pane
- 3d6e573: Improve sign-in flow
- 3460bf4: Update some icons
- Updated dependencies [6c223a9]
- Updated dependencies [a1109c1]
- Updated dependencies [56b58cf]
- Updated dependencies [b3a39ad]
- Updated dependencies [976928d]
- Updated dependencies [9bb5021]
- Updated dependencies [efd3a58]
- Updated dependencies [2144bc3]
- Updated dependencies [91b0af7]
- Updated dependencies [db124b2]
- Updated dependencies [3af8f62]
- Updated dependencies [c737f6b]
- Updated dependencies [032cf64]
- Updated dependencies [62af787]
- Updated dependencies [b8f540d]
- Updated dependencies [69d315b]
- Updated dependencies [59d6fe7]
- Updated dependencies [77c6a67]
- Updated dependencies [9937f23]
- Updated dependencies [925e4bf]
- Updated dependencies [e178790]
- Updated dependencies [220f27a]
- Updated dependencies [9ffe9ee]
- Updated dependencies [9dffc14]
- Updated dependencies [43f5402]
- Updated dependencies [f11be69]
- Updated dependencies [228eafd]
- Updated dependencies [dbb0eeb]
- Updated dependencies [67561d6]
- Updated dependencies [4fc44ab]
- Updated dependencies [f1f9d2f]
- Updated dependencies [99e2899]
- Updated dependencies [724069f]
- Updated dependencies [389c631]
- Updated dependencies [c6f9889]
- Updated dependencies [6a66a0e]
- Updated dependencies [a2b9fca]
- Updated dependencies [a2e7a36]
- Updated dependencies [06bf630]
- Updated dependencies [95a8265]
- Updated dependencies [263bc1c]
- Updated dependencies [782b7e4]
- Updated dependencies [a128d88]
- Updated dependencies [0b07d7d]
- Updated dependencies [7edd2fc]
- Updated dependencies [6b6052c]
- Updated dependencies [65f89e0]
- Updated dependencies [750499a]
- Updated dependencies [a10abfd]
- Updated dependencies [0ad7660]
- Updated dependencies [9ba6ea3]
- Updated dependencies [10fee14]
- Updated dependencies [73007eb]
- Updated dependencies [0cfe873]
- Updated dependencies [d1790e9]
- Updated dependencies [9843e23]
- Updated dependencies [eaef053]
- Updated dependencies [0b1dc88]
- Updated dependencies [83bdea5]
- Updated dependencies [a44e8bc]
- Updated dependencies [2e76cc4]
- Updated dependencies [e39ea7e]
- Updated dependencies [81de97c]
- Updated dependencies [570a652]
- Updated dependencies [75a2030]
- Updated dependencies [1fd4aaa]
- Updated dependencies [580ec08]
- Updated dependencies [a8cca57]
- Updated dependencies [c5adbdf]
- Updated dependencies [c9fc7b0]
- Updated dependencies [5e1e24c]
- Updated dependencies [0ece0b1]
- Updated dependencies [74124b8]
- Updated dependencies [4904e2a]
- Updated dependencies [664db61]
- Updated dependencies [69f3646]
- Updated dependencies [9fe7195]
- Updated dependencies [69d315b]
- Updated dependencies [0ac4ee9]
- Updated dependencies [be771bf]
- Updated dependencies [63a1930]
- Updated dependencies [4a7ab2b]
- Updated dependencies [13dfac3]
- Updated dependencies [7895c03]
- Updated dependencies [b93a70f]
- Updated dependencies [26b1194]
- Updated dependencies [3806187]
- Updated dependencies [c6fbe92]
- Updated dependencies [b17362c]
- Updated dependencies [9ade1ed]
- Updated dependencies [f2d0061]
- Updated dependencies [235f33d]
- Updated dependencies [aec9a8f]
- Updated dependencies [12aea89]
- Updated dependencies [7c64db3]
- Updated dependencies [c434112]
- Updated dependencies [fc11aeb]
- Updated dependencies [e81078e]
- Updated dependencies [30b8f91]
- Updated dependencies [fc2dda1]
- Updated dependencies [881f8ab]
- Updated dependencies [627a1fc]
- Updated dependencies [83a5186]
- Updated dependencies [dd0015e]
- Updated dependencies [b7b39a4]
- Updated dependencies [39ad0f0]
- Updated dependencies [3d6e573]
- Updated dependencies [3460bf4]
- Updated dependencies [2962093]
- Updated dependencies [40a8568]
- Updated dependencies [2429df0]
- Updated dependencies [8e2fc1f]
  - @breadboard-ai/shared-ui@1.23.0
  - @breadboard-ai/bbrt@0.2.0
  - @google-labs/breadboard@0.32.0
  - @breadboard-ai/manifest@0.8.0
  - @breadboard-ai/types@0.5.0
  - @breadboard-ai/example-boards@0.4.0
  - @breadboard-ai/jsandbox@0.4.0
  - @google-labs/agent-kit@0.16.0
  - @breadboard-ai/idb-board-server@1.19.2
  - @breadboard-ai/google-drive-kit@0.5.0
  - @google-labs/core-kit@0.18.0
  - @breadboard-ai/build@0.12.0
  - @breadboard-ai/board-server-management@1.20.0
  - @breadboard-ai/board-server-utils@0.1.8
  - @breadboard-ai/data-store@0.3.1
  - @google-labs/gemini-kit@0.11.1
  - @google-labs/json-kit@0.3.15
  - @google-labs/template-kit@0.3.17
  - @breadboard-ai/python-wasm@0.1.13

## 1.25.0

### Minor Changes

- 25dd1c2: Introduce chiclets for board capabilities
- 45c7e5f: Make `MutableGraph` the actual store of nodes, kits, graphs, modules,
  edges.
- 37e3fbd: Connect file system to Visual Editor.
- 0afae9c: Improve side nav behaviors
- 8722c8f: Make retrieving type metadata sync.
- 5d91f23: Add basic dark theme support
- de75b63: Improvements to drag and drop
- e7d4316: Add "Prompt" to Model (aka "Task" in Specialist)
- 6ed34ad: Lots of visual updates
- 21b654a: Move SettingsStore into @breadboard-ai/shared-ui package
- 66105f9: Dispatch topology events on edits.
- 733bf2a: Revamp selection model
- 96b0597: Introduce `GraphStore`: a top-level holder of all boards.
- eb3fc28: Start using `currentPorts` and `update` event in VE.
- cf9d064: Improve graph zoom behaviors
- a8eccc4: Add various improvements to board navigation
- 7ea3b85: Teach Breadboard to recognize and edit BGL exports.

### Patch Changes

- f880be7: Teach Editor about graph hierarchies
- 71992c0: Fix the update-loop-of-death
- 1467eb5: Truncate long node titles
- 707a440: Teach visual editor to create runtime-resolvable references.
- db77f23: Various UI changes and improvements
- 1cd4301: Add capabilities view
- 64bbe1b: Drive the usage of `inspect` down to four callsites.
- 4a898eb: Introduce `GraphStore.graphs()`.
- 2d03abe: Add side nav
- b198059: Teach runtime and UI to duplicate boards & mods
- 7ea05ca: Remove the use of `inspect` inside `packages/breadboard`.
- 8001cd3: Fix some UI colors
- cae3a3f: A plethora of bug fixes and polish
- abf3ab7: Remove Task override in Model describer.
- 3967bec: Improve reference drag and drop
- 3c19bc6: Fix overlaid module previews
- f9dc26b: Properly track deletions of edges and nodes.
- df6926d: A cornucopia of fixes and polish
- fdc9731: Fix single ref removal bug
- 0bc58ac: Wrangle graphs a little better
- 762e662: Teach Component Selector about kit toggling
- 409576b: Bring back side wire computation.
- fe69294: Teach selections about references
- c55afe3: Fix the bug with only board server kits being sent to runBoard.
- 9a966b4: Clean graph entities more readily
- f6f9adf: Improve the styling of the new workspace item overlay
- fa7e8f2: Fix tab rendering
- 46c9327: Allow pasting fragment URLs into VE and add a nicer module title when
  running modules.
- 07b5676: Add support for `@describe` capability.
- 80de5a3: Support shift+drag to move items between boards
- 6b957aa: Ensure comments are retained
- 45ac69f: Replace hard-coded strings with Language Pack in index
- d32cabe: Only enable dark theme when requested
- 404a08f: Teach Graph Outline various tricks
- 37c3f15: Add control over when to animate
- 4b3ae00: Update logo and inline SVG
- 3915ad0: Update the list of available Gemini models.
- 99e1e48: Switch moduleId on deletion
- e528810: Move board info edit to overflow
- a8ca30b: Add sliding board selector
- 81b2de4: Remove list mode
- df9b8b9: Support subgraph visual controls
- 2130bc6: Teach FSAPI Board Server to show published boards.
- 3025283: Teach Workspace Outline about selections
- 1c83e7d: Improve preview values
- e4521d9: Don't delete completed chunk.
- a4fee76: Make module preview work and teach backspace to behave when editing
  modules.
- 3536a91: Add `gemini-2.0-flash-thinking-exp` to the list of available models
- 93a0a94: Make board server components show in component selector.
- 573f1d5: Flatten paste structure and remove node types
- 35f2299: Add the ability to edit boards
- 99532f4: Inform node/edge caches when subgraphs are removed/added
- Updated dependencies [25dd1c2]
- Updated dependencies [45c7e5f]
- Updated dependencies [f880be7]
- Updated dependencies [37e3fbd]
- Updated dependencies [4c03eaa]
- Updated dependencies [10a4911]
- Updated dependencies [c7b778f]
- Updated dependencies [71992c0]
- Updated dependencies [37eb28c]
- Updated dependencies [a7f278c]
- Updated dependencies [6338d6d]
- Updated dependencies [1467eb5]
- Updated dependencies [0afae9c]
- Updated dependencies [a9d432a]
- Updated dependencies [f47b90e]
- Updated dependencies [c8fbda4]
- Updated dependencies [db77f23]
- Updated dependencies [7b16abc]
- Updated dependencies [8722c8f]
- Updated dependencies [1cd4301]
- Updated dependencies [5d91f23]
- Updated dependencies [64bbe1b]
- Updated dependencies [de75b63]
- Updated dependencies [e4631ff]
- Updated dependencies [78ea16b]
- Updated dependencies [8edcb12]
- Updated dependencies [96ea699]
- Updated dependencies [e22e33b]
- Updated dependencies [4a898eb]
- Updated dependencies [087280f]
- Updated dependencies [2d03abe]
- Updated dependencies [b198059]
- Updated dependencies [ccc1135]
- Updated dependencies [7ea05ca]
- Updated dependencies [f9d5378]
- Updated dependencies [8001cd3]
- Updated dependencies [a80d5b9]
- Updated dependencies [e9a22df]
- Updated dependencies [f8e1526]
- Updated dependencies [cae3a3f]
- Updated dependencies [e7d4316]
- Updated dependencies [ce0f654]
- Updated dependencies [862c53c]
- Updated dependencies [d72a40b]
- Updated dependencies [abf3ab7]
- Updated dependencies [3967bec]
- Updated dependencies [3c19bc6]
- Updated dependencies [f9dc26b]
- Updated dependencies [3eff6c0]
- Updated dependencies [18f9b8d]
- Updated dependencies [df6926d]
- Updated dependencies [84f6a3a]
- Updated dependencies [35eb4e0]
- Updated dependencies [6ed34ad]
- Updated dependencies [f6c31d3]
- Updated dependencies [2a6d643]
- Updated dependencies [183c9eb]
- Updated dependencies [0bc58ac]
- Updated dependencies [21b654a]
- Updated dependencies [762e662]
- Updated dependencies [409576b]
- Updated dependencies [b1f11fa]
- Updated dependencies [fe69294]
- Updated dependencies [502d1fe]
- Updated dependencies [1d58ff1]
- Updated dependencies [c91a1ed]
- Updated dependencies [b685d49]
- Updated dependencies [a717ddc]
- Updated dependencies [02f905f]
- Updated dependencies [c55afe3]
- Updated dependencies [ba78d58]
- Updated dependencies [9a966b4]
- Updated dependencies [58166f8]
- Updated dependencies [f6f9adf]
- Updated dependencies [46c9327]
- Updated dependencies [07b5676]
- Updated dependencies [80de5a3]
- Updated dependencies [45ac69f]
- Updated dependencies [057113a]
- Updated dependencies [66105f9]
- Updated dependencies [4eb6d6d]
- Updated dependencies [032d962]
- Updated dependencies [d32cabe]
- Updated dependencies [7728225]
- Updated dependencies [78da2ab]
- Updated dependencies [733bf2a]
- Updated dependencies [96b0597]
- Updated dependencies [404a08f]
- Updated dependencies [671a25e]
- Updated dependencies [37c3f15]
- Updated dependencies [4b3ae00]
- Updated dependencies [eb3fc28]
- Updated dependencies [3915ad0]
- Updated dependencies [99e1e48]
- Updated dependencies [d7b3a53]
- Updated dependencies [5269190]
- Updated dependencies [0d5ff0f]
- Updated dependencies [e528810]
- Updated dependencies [a8ca30b]
- Updated dependencies [81b2de4]
- Updated dependencies [df9b8b9]
- Updated dependencies [91e0930]
- Updated dependencies [5dbdf2f]
- Updated dependencies [2130bc6]
- Updated dependencies [d73587b]
- Updated dependencies [8ab7211]
- Updated dependencies [cf9d064]
- Updated dependencies [3025283]
- Updated dependencies [1c83e7d]
- Updated dependencies [b23168c]
- Updated dependencies [8619ff4]
- Updated dependencies [def94be]
- Updated dependencies [e4521d9]
- Updated dependencies [a4fee76]
- Updated dependencies [3536a91]
- Updated dependencies [2df9044]
- Updated dependencies [a8eccc4]
- Updated dependencies [11e4c86]
- Updated dependencies [93a0a94]
- Updated dependencies [573f1d5]
- Updated dependencies [e145357]
- Updated dependencies [3ce820e]
- Updated dependencies [35f2299]
- Updated dependencies [c6935b7]
- Updated dependencies [7ea3b85]
- Updated dependencies [0f3980f]
- Updated dependencies [99532f4]
  - @google-labs/breadboard@0.31.0
  - @breadboard-ai/shared-ui@1.22.0
  - @breadboard-ai/data-store@0.3.0
  - @breadboard-ai/jsandbox@0.3.0
  - @breadboard-ai/bbrt@0.1.0
  - @google-labs/gemini-kit@0.11.0
  - @breadboard-ai/build@0.11.1
  - @breadboard-ai/manifest@0.7.0
  - @breadboard-ai/types@0.4.0
  - @google-labs/agent-kit@0.15.0
  - @breadboard-ai/idb-board-server@1.19.1
  - @google-labs/core-kit@0.17.1
  - @breadboard-ai/board-server-management@1.19.2
  - @breadboard-ai/google-drive-kit@0.4.1
  - @breadboard-ai/board-server-utils@0.1.7
  - @breadboard-ai/example-boards@0.3.8
  - @google-labs/json-kit@0.3.14
  - @google-labs/node-nursery-web@1.4.1
  - @google-labs/palm-kit@0.1.8
  - @google-labs/template-kit@0.3.16
  - @breadboard-ai/python-wasm@0.1.12

## 1.23.0

### Minor Changes

- a13caa0: Swap nav for open dialog
- 18dace0: Allow subgraphs to access modules
- f472c75: Introduce "Read From Doc" component.
- 4f49129: Migrate command palette to root
- 32b50af: Expose side wires in `InspectableGraph`.
- 8d44489: Implement support for module-based describers
- c75e26f: Introduce Imperative Graphs.
- cc19e8c: Teach Visual Editor how to edit modules
- 9d5f11b: Convert existing declarative kits to BGL.
- 2c7587a: Rename "Specialist" to "Model".

### Patch Changes

- 9250262: Various fixes in module editing.
- e37a9bf: Add image and formatting support to Context to Slides
- 1131130: Scope capabilities to one invocation.
- 97b85d4: A few more fixes while working with imperative modules.
- ca466cd: Plumb probe events (node/graph start/end) for runModule.
- 1fb9857: Add support for entity escaping.
- 5e53755: Start subgraph work
- 3e3fd65: Add a raft of improvements to module management
- 605af98: Start caching describer results.
- 426a2be: Various smaller tweaks to module editor
- 289a26f: Handle weird inputs more gracefully.
- 05a3904: Add prettier support to Module Editor
- 552be88: Set TypeScript as the default module language
- 0df3c27: More module editor tweaks
- b541052: Raft of fixes for Module Editor
- 23714f2: Escape single quotes in Google Drive API query.
- d39d473: Add "Append to Doc" component to Google Drive Kit.
- 6fe2ea2: Fix up schema in "Read From Doc".
- db52fbc: Pass module spec at invoke/describe time.
- d42ab17: Teach Board Server about sandboxed runModule.
- 66041a7: Migrate to use `InspectableGraph.edit` for subgraph
  add/remove/replace.
- a934fe2: Make describer cache async.
- 259ef66: Set module source based on default type
- 07c0720: Various improvements to the Module Editor
- e0d59b6: Teach Visual Editor how to change module language
- 1f1f7bc: Add formatting support for "Append to Doc"
- 9e5390d: Introduce Edit Transforms and start using them.
- 0e0bd49: Teach Module Editor about search; tidy overlay
- 392b111: Ignore blank tools in Model (Specialist).
- Updated dependencies [9250262]
- Updated dependencies [e37a9bf]
- Updated dependencies [a13caa0]
- Updated dependencies [1131130]
- Updated dependencies [97b85d4]
- Updated dependencies [1f91291]
- Updated dependencies [ca466cd]
- Updated dependencies [669694a]
- Updated dependencies [8a590bc]
- Updated dependencies [1fb9857]
- Updated dependencies [5e53755]
- Updated dependencies [18dace0]
- Updated dependencies [3e3fd65]
- Updated dependencies [f472c75]
- Updated dependencies [605af98]
- Updated dependencies [4f49129]
- Updated dependencies [32b50af]
- Updated dependencies [57986da]
- Updated dependencies [426a2be]
- Updated dependencies [289a26f]
- Updated dependencies [1365f9d]
- Updated dependencies [19fc2d0]
- Updated dependencies [05a3904]
- Updated dependencies [62d627f]
- Updated dependencies [552be88]
- Updated dependencies [74aa9b7]
- Updated dependencies [8d44489]
- Updated dependencies [ce3a00c]
- Updated dependencies [0df3c27]
- Updated dependencies [b541052]
- Updated dependencies [e3b6040]
- Updated dependencies [c75e26f]
- Updated dependencies [0f2a1da]
- Updated dependencies [856e249]
- Updated dependencies [6fad5ba]
- Updated dependencies [23714f2]
- Updated dependencies [d39d473]
- Updated dependencies [1f1f7bc]
- Updated dependencies [6fe2ea2]
- Updated dependencies [db52fbc]
- Updated dependencies [cc19e8c]
- Updated dependencies [d42ab17]
- Updated dependencies [0601a48]
- Updated dependencies [9d5f11b]
- Updated dependencies [31ddc9a]
- Updated dependencies [0eb903c]
- Updated dependencies [66041a7]
- Updated dependencies [a934fe2]
- Updated dependencies [335983b]
- Updated dependencies [07c0720]
- Updated dependencies [e0d59b6]
- Updated dependencies [032b9f6]
- Updated dependencies [1f1f7bc]
- Updated dependencies [2c7587a]
- Updated dependencies [9e5390d]
- Updated dependencies [0e0bd49]
- Updated dependencies [392b111]
- Updated dependencies [4130fed]
- Updated dependencies [1fb9857]
  - @breadboard-ai/shared-ui@1.21.0
  - @breadboard-ai/jsandbox@0.2.0
  - @breadboard-ai/google-drive-kit@0.4.0
  - @google-labs/breadboard@0.30.0
  - @breadboard-ai/idb-board-server@1.19.0
  - @google-labs/core-kit@0.17.0
  - @breadboard-ai/manifest@0.6.0
  - @breadboard-ai/types@0.3.0
  - @google-labs/node-nursery-web@1.4.0
  - @breadboard-ai/build@0.11.0
  - @google-labs/agent-kit@0.14.0
  - @google-labs/gemini-kit@0.10.0
  - @breadboard-ai/board-server-management@1.19.1
  - @breadboard-ai/example-boards@0.3.7
  - @breadboard-ai/board-server-utils@0.1.6
  - @breadboard-ai/data-store@0.2.6
  - @google-labs/json-kit@0.3.13
  - @google-labs/palm-kit@0.1.7
  - @google-labs/template-kit@0.3.15
  - @breadboard-ai/python-wasm@0.1.11

## 1.22.0

### Minor Changes

- 4dc21f4: Implement basic Google Drive Board Server
- 55674b8: Add support for calling Gemini for sideboards.
- 1ce1af8: Introduce new Board Activity
- 83b735f: Introduce "Context To Slides" component.
- 71d42aa: Teach Visual Editor to run step by step.
- 1fc5812: React to component edits correctly.
- e014e42: Introduce "component" tag and user custom kits.
- 49c7cb7: Add support for peer imports and custom describers (latter not yet
  plumbed through)
- d7f04f2: Start removal of provider scaffolding
- 8b8a0cf: Switch Board Servers on by default
- 7c99283: Move Google Drive Board Server from behind the flag.
- ee2844b: Teach Visual Editor about different edge states.
- 2e7d66f: Add `secrets` to capabilities.
- 9bd4439: Implement a JS sandbox and start using it in runModule.
- df7ad14: Implement support for custom describers in runModule.
- 3dcbf03: Teach Google Drive Board Server to save board metadata.
- bdf80d8: Teach Google Drive board server to refresh credentials.
- cf74d3d: (Re-)Introduce node runner
- 4c71e39: Introduce (entirely stubbed out) Google Drive board server.
- 8cbc686: Surface the actual error from Gemini.
- 29762d6: Implement "Re-run from this node" feature.
- 526f310: Teach JSandbox to handle errors and load "breadboard:capabilities"
  import
- a133437: Implement "Role" configuration port for Content component.
- 38defd8: Make `jsandbox` a real package.
- bf69ac9: Teach Specialist to be more robust with routes.
- db93a6a: Implement "stopAfter" run argument (but not yet use it).
- e1b8e9b: Implement basic "Enhance" plumbing.
- 37dd928: Add support for `invoke` capability.
- 8f079a1: Teach Inspector API about modules

### Patch Changes

- 4fb645c: Show node type descriptions by default
- b0fae7a: Fix infinite loop bug
- 9d5d6d9: Fixes to jsandbox run
- 5dc3453: Remove run node setting
- 0e84b38: Fix configurator deeplink
- 25905c9: Switch Debug button back to Run
- ed08f2c: Update drag-dock overlay style
- fd3667f: Update board details overlay
- ee0870c: Improve error rendering
- b043b4d: Offer enhancement button
- 4375cd1: Apply enhancements ephemerally
- 8fdce2b: Add "regenerate value" button
- 6215ade: Synchronize activity log with visual editor when component is edited.
- 29f7ad4: Various small UI tweaks for GDrive
- 9a0f027: Add run button to node configurator
- 01846fa: Add basic debug controls
- b6eb227: Improve UX of GDrive Board Server
- 7daf4f2: Cancel any pending autosave when a user has interacted
- 7cd9014: Update edge value inspector styles
- f284ca8: Migrate graph node footer back to header
- 814e95c: Only show 'regenerate' for non-inputs
- c6f1a69: Fix save behavior
- ae8bd19: More provider changes
- 2fffc7a: Reinstate export button for Board activity
- 2a91b27: Remove old Providers
- 03d061c: Dispose of toasts
- cd09c03: Allow compound enhancement & resets
- 77e1e1d: Fix LLM Inputs
- eb61b4f: Add more icons to components
- Updated dependencies [5812884]
- Updated dependencies [4fb645c]
- Updated dependencies [9d5d6d9]
- Updated dependencies [4dc21f4]
- Updated dependencies [e8e4232]
- Updated dependencies [55674b8]
- Updated dependencies [1ce1af8]
- Updated dependencies [a00058b]
- Updated dependencies [ff6e3e0]
- Updated dependencies [559ed8e]
- Updated dependencies [0e84b38]
- Updated dependencies [83b735f]
- Updated dependencies [2526901]
- Updated dependencies [71d42aa]
- Updated dependencies [25905c9]
- Updated dependencies [814db04]
- Updated dependencies [5f4d8eb]
- Updated dependencies [ed08f2c]
- Updated dependencies [1fc5812]
- Updated dependencies [fd3667f]
- Updated dependencies [4e7c3fe]
- Updated dependencies [ee0870c]
- Updated dependencies [93f7874]
- Updated dependencies [b043b4d]
- Updated dependencies [63abd70]
- Updated dependencies [1cf2285]
- Updated dependencies [4375cd1]
- Updated dependencies [afd0d4d]
- Updated dependencies [e014e42]
- Updated dependencies [49c7cb7]
- Updated dependencies [8fdce2b]
- Updated dependencies [b4c5848]
- Updated dependencies [6215ade]
- Updated dependencies [29f7ad4]
- Updated dependencies [9a0f027]
- Updated dependencies [01846fa]
- Updated dependencies [d7f04f2]
- Updated dependencies [b6eb227]
- Updated dependencies [7daf4f2]
- Updated dependencies [8b8a0cf]
- Updated dependencies [1260786]
- Updated dependencies [7cd9014]
- Updated dependencies [661beea]
- Updated dependencies [1741928]
- Updated dependencies [f284ca8]
- Updated dependencies [850c217]
- Updated dependencies [ee2844b]
- Updated dependencies [2e7d66f]
- Updated dependencies [9fc85a6]
- Updated dependencies [9bd4439]
- Updated dependencies [df7ad14]
- Updated dependencies [35954e0]
- Updated dependencies [15d3b74]
- Updated dependencies [0ad35bd]
- Updated dependencies [39d1913]
- Updated dependencies [3dcbf03]
- Updated dependencies [bdf80d8]
- Updated dependencies [cf74d3d]
- Updated dependencies [4c71e39]
- Updated dependencies [814e95c]
- Updated dependencies [8cbc686]
- Updated dependencies [3b8f814]
- Updated dependencies [530d7d2]
- Updated dependencies [29762d6]
- Updated dependencies [526f310]
- Updated dependencies [25b3853]
- Updated dependencies [47606e3]
- Updated dependencies [514136d]
- Updated dependencies [c6f1a69]
- Updated dependencies [a133437]
- Updated dependencies [9756889]
- Updated dependencies [ae8bd19]
- Updated dependencies [387447c]
- Updated dependencies [2fffc7a]
- Updated dependencies [14bd092]
- Updated dependencies [5332cbc]
- Updated dependencies [552d44b]
- Updated dependencies [2a91b27]
- Updated dependencies [38defd8]
- Updated dependencies [2510120]
- Updated dependencies [08b71d6]
- Updated dependencies [6726e5a]
- Updated dependencies [64e6b88]
- Updated dependencies [bf69ac9]
- Updated dependencies [db93a6a]
- Updated dependencies [ef99f4e]
- Updated dependencies [03d061c]
- Updated dependencies [cd09c03]
- Updated dependencies [950443f]
- Updated dependencies [2d5b24e]
- Updated dependencies [77e1e1d]
- Updated dependencies [37dd928]
- Updated dependencies [eb61b4f]
- Updated dependencies [8f079a1]
  - @breadboard-ai/shared-ui@1.20.0
  - @google-labs/core-kit@0.16.0
  - @breadboard-ai/board-server-management@1.19.0
  - @breadboard-ai/google-drive-kit@0.3.0
  - @google-labs/breadboard@0.29.0
  - @google-labs/agent-kit@0.13.0
  - @breadboard-ai/jsandbox@0.1.0
  - @breadboard-ai/manifest@0.5.0
  - @breadboard-ai/types@0.2.0
  - @breadboard-ai/example-boards@0.3.6
  - @google-labs/gemini-kit@0.9.0
  - @google-labs/node-nursery-web@1.3.4
  - @breadboard-ai/board-server-utils@0.1.5
  - @breadboard-ai/build@0.10.5
  - @breadboard-ai/data-store@0.2.5
  - @breadboard-ai/idb-board-server@1.18.1
  - @google-labs/json-kit@0.3.12
  - @google-labs/palm-kit@0.1.6
  - @google-labs/template-kit@0.3.14
  - @breadboard-ai/python-wasm@0.1.10

## 1.21.0

### Minor Changes

- 9d31e85: Update edge rendering
- 4857c1e: Lots of smaller board server fixes
- 049a83b: Add FileSystemBoardServer

### Patch Changes

- 358d116: Add initial support for Board Server Kits
- 0884913: Various QoL improvements
- 84b824e: Merge contiguous user turns in Gemini text.
- 8b14d0e: Add Examples Board Server
- a53f7e7: Teach drag-dock-overlay about persistence
- 3033a0d: Track the active tab
- 54eb2f3: Improve remote provider load behavior
- ffbcf09: Allow management of Board Servers
- b5981d0: Set url for the component board.
- c031dd6: Do some plumbing work for extensions
- 1d6d7a3: Teach board activity to be dockable
- Updated dependencies [b1dfa20]
- Updated dependencies [9d31e85]
- Updated dependencies [358d116]
- Updated dependencies [be6656d]
- Updated dependencies [5aded4a]
- Updated dependencies [250dc44]
- Updated dependencies [4630d8c]
- Updated dependencies [0884913]
- Updated dependencies [84b824e]
- Updated dependencies [4857c1e]
- Updated dependencies [e4a9453]
- Updated dependencies [dd24baa]
- Updated dependencies [8b14d0e]
- Updated dependencies [3e04cb3]
- Updated dependencies [a53f7e7]
- Updated dependencies [71bd9a7]
- Updated dependencies [683bab9]
- Updated dependencies [4ec74a0]
- Updated dependencies [b640cd2]
- Updated dependencies [2db4eeb]
- Updated dependencies [54eb2f3]
- Updated dependencies [8e793ad]
- Updated dependencies [acf554c]
- Updated dependencies [fa87883]
- Updated dependencies [ffbcf09]
- Updated dependencies [7adeed8]
- Updated dependencies [ca5f932]
- Updated dependencies [b5981d0]
- Updated dependencies [51c2c39]
- Updated dependencies [413992d]
- Updated dependencies [d447a7f]
- Updated dependencies [049a83b]
- Updated dependencies [c031dd6]
- Updated dependencies [646504f]
- Updated dependencies [1d6d7a3]
  - @breadboard-ai/shared-ui@1.19.0
  - @breadboard-ai/idb-board-server@1.18.0
  - @google-labs/breadboard@0.28.0
  - @google-labs/gemini-kit@0.8.3
  - @breadboard-ai/board-server-management@1.18.0
  - @breadboard-ai/example-boards@0.3.5
  - @breadboard-ai/data-store@0.2.4
  - @breadboard-ai/types@0.1.2
  - @breadboard-ai/build@0.10.4
  - @google-labs/core-kit@0.15.3
  - @google-labs/agent-kit@0.12.4
  - @breadboard-ai/board-server-utils@0.1.4
  - @google-labs/json-kit@0.3.11
  - @breadboard-ai/manifest@0.4.6
  - @google-labs/node-nursery-web@1.3.3
  - @google-labs/palm-kit@0.1.5
  - @google-labs/template-kit@0.3.13
  - @breadboard-ai/google-drive-kit@0.2.7
  - @breadboard-ai/python-wasm@0.1.9

## 1.20.2

### Patch Changes

- Updated dependencies [d20e867]
  - @breadboard-ai/types@0.1.1
  - @google-labs/breadboard@0.27.3
  - @breadboard-ai/build@0.10.3
  - @breadboard-ai/shared-ui@1.18.2
  - @google-labs/agent-kit@0.12.3
  - @breadboard-ai/board-server-management@1.17.2
  - @breadboard-ai/board-server-utils@0.1.3
  - @google-labs/core-kit@0.15.2
  - @breadboard-ai/example-boards@0.3.4
  - @google-labs/gemini-kit@0.8.2
  - @breadboard-ai/google-drive-kit@0.2.6
  - @breadboard-ai/idb-board-server@1.17.2
  - @google-labs/json-kit@0.3.10
  - @breadboard-ai/python-wasm@0.1.8
  - @google-labs/template-kit@0.3.12

## 1.20.1

### Patch Changes

- 6ab0acd: Introduce drag-dock-overlay
- cae7e34: Strip function calls when response mime type is set to
  `application/json`.
- 7921983: Introduce `@breadboard-ai/types` package.
- Updated dependencies [6ab0acd]
- Updated dependencies [370b7ca]
- Updated dependencies [cae7e34]
- Updated dependencies [7921983]
- Updated dependencies [6b3ba07]
- Updated dependencies [f89b60e]
  - @breadboard-ai/shared-ui@1.18.1
  - @google-labs/breadboard@0.27.2
  - @google-labs/gemini-kit@0.8.1
  - @breadboard-ai/types@0.1.0
  - @breadboard-ai/manifest@0.4.5
  - @breadboard-ai/build@0.10.2
  - @breadboard-ai/example-boards@0.3.3
  - @google-labs/agent-kit@0.12.2
  - @breadboard-ai/board-server-management@1.17.1
  - @breadboard-ai/board-server-utils@0.1.2
  - @google-labs/core-kit@0.15.1
  - @breadboard-ai/google-drive-kit@0.2.5
  - @breadboard-ai/idb-board-server@1.17.1
  - @google-labs/json-kit@0.3.9
  - @breadboard-ai/python-wasm@0.1.7
  - @google-labs/template-kit@0.3.11

## 1.20.0

### Minor Changes

- 2781bae: Offer super-nice board server first-run experience.
- 1799348: Introduce Streamlined Schema Editor

### Patch Changes

- 4667d78: Add "delete property" button
- 33f5f83: Update node selector
- 1e7fafd: Various bug fixes
- b5cada9: Introduce ribbon menu
- Updated dependencies [3fcecff]
- Updated dependencies [418c586]
- Updated dependencies [564850b]
- Updated dependencies [a2503de]
- Updated dependencies [2781bae]
- Updated dependencies [690ebe6]
- Updated dependencies [1799348]
- Updated dependencies [5c015f2]
- Updated dependencies [4667d78]
- Updated dependencies [33f5f83]
- Updated dependencies [1e7fafd]
- Updated dependencies [b5cada9]
- Updated dependencies [e3a469e]
  - @breadboard-ai/shared-ui@1.18.0
  - @breadboard-ai/build@0.10.1
  - @google-labs/breadboard@0.27.1
  - @google-labs/agent-kit@0.12.1

## 1.19.0

### Minor Changes

- ab92d99: Plumb edge value data to the GraphRenderer.
- 508c4b3: Plumb through edge highlighting and inner activity.
- 033d656: Teach VE to autosave boards
- 12cdec3: Improve tab handling
- 9a9f5c2: Move activity to overlay
- 65c0449: Teach TopGraphObserver about various activity types, especially
  errors.
- 9c878e2: Start work on a runtime API
- 2f68f71: Move node meta into configurator
- 8540b93: Convert Content to Build API and merge Specialist 2 to Specialist.
- 81eafad: Implement selecting runs and viewing them.
- 4c03455: Introduce Specialist 2 and make Content component support LLM
  Content.
- d0f99b4: Restyle graph nodes
- 392d7cd: Switch global configurator for per-port
- 9fe7d4f: Add multi-tab support
- 8c73da3: Integrate TopGraphObserver into Visual Editor.
- 8572be4: Update UI ready for Runs
- df9b158: Add indicators on edges; use activity log lite
- 955ace6: Introduce Project Store behind a flag
- a049abf: Move more things into runtime
- ec55e54: Automatically pan/zoom to currently running node
- d7606d3: Implement plumbing for visualizing runs as graphs.
- d9fd0ab: [project-store] -> [idb-board-server]
- a6128a3: Switch Visual Editor to use Run API.
- 0088ede: Allow configuring all ports (except start/control) in advanced
  expansion state.
- 60349b8: Add board server management and remote board server packages
- 94759f7: Teach Specialist about routing.
- d0e894d: Add Edge Value overlay

### Patch Changes

- 703f17d: Various fixes to make board server work again.
- 4e620ed: Remove the extra requestUpdate that triggered the loop of doom.
- bc967e3: Re-render and emit input event when adding parts in llm-input.
- a74db56: Teach editor about tab URLs
- 981bd9e: Align IDB with Board Servers in nav
- 5bf9e8d: More tab improvements
- fd69479: Recover from bad node types
- 24dd1d1: Various fixes around the new runtime.
- f10e709: Update build deps.
- 1f11bf3: Switch follow to using Local Storage
- 4e00d85: Update URL whenever a tab closes
- 9797718: Auto-migrate IDB `GraphProvider` boards
- 4f4f3ee: Include all ports in configurator
- d22e974: Catch up all the BGL files after changes in Build API.
- 9254424: Add setting for autosave
- 3e68ec2: Save pending configuration with board
- 08d24da: Improve canSave check
- 5990fd0: Add message for secrets and API keys
- a039d2e: Do a little tidy up of the UI
- b6eeb3e: Show Activity Marker on graph nodes
- e63b5dd: Polish Specialist and Content.
- d99292e: Restore board URL copy
- e723c09: Couple of minor tweaks
- 9783ba8: Fix worker memory leak and throttle describers.
- edefaf9: Add tooltip support
- eb83b66: Fix load run behavior
- 7fdf9c2: Add "gemini-1.5-pro-exp-0827" to the choices in Gemini-calling
  components.
- cc72dcc: Set runs to be read-only
- 320c4c0: Rename some runtime types & events
- 1ad3001: Show configuration previews underneath ports
- 7c2bf58: Update example graph layouts
- 100fc95: Various fixes and polish.
- 08ae0f6: Create and use hashes for descriptor-based tabs
- 1956396: Autosave board when top-level info changes
- 77d9497: Restore Activity Log
- 356897c: Teach Visual debugger to spelunk deeper than 2 levels.
- cac51cb: Teach runtime about tab types
- 84ca649: Introduce the "Content" component.
- e026112: Remind Specialist that it doesn't accept dynamic wires.
- 40988de: Teach SecretsHelper about the timing of secrets-related events.
- Updated dependencies [49e2740]
- Updated dependencies [ab92d99]
- Updated dependencies [323216f]
- Updated dependencies [7fd41bb]
- Updated dependencies [2726cb8]
- Updated dependencies [fe61245]
- Updated dependencies [54c8197]
- Updated dependencies [f94f498]
- Updated dependencies [703f17d]
- Updated dependencies [3d4ca21]
- Updated dependencies [bc967e3]
- Updated dependencies [e6e165d]
- Updated dependencies [6136d87]
- Updated dependencies [0273985]
- Updated dependencies [f5d3111]
- Updated dependencies [cb8c99a]
- Updated dependencies [2f1b85c]
- Updated dependencies [4dadf16]
- Updated dependencies [c145fdd]
- Updated dependencies [981bd9e]
- Updated dependencies [226be62]
- Updated dependencies [5bf9e8d]
- Updated dependencies [e543b2e]
- Updated dependencies [8f9fddf]
- Updated dependencies [7929eee]
- Updated dependencies [2fa05f0]
- Updated dependencies [4e0a4f6]
- Updated dependencies [fd69479]
- Updated dependencies [508c4b3]
- Updated dependencies [033d656]
- Updated dependencies [f61ccf3]
- Updated dependencies [e61fa66]
- Updated dependencies [f71bcfb]
- Updated dependencies [a104fa7]
- Updated dependencies [12cdec3]
- Updated dependencies [b8547b8]
- Updated dependencies [9a9f5c2]
- Updated dependencies [65c0449]
- Updated dependencies [f0b5ccc]
- Updated dependencies [8a1b8c4]
- Updated dependencies [3188607]
- Updated dependencies [1f11bf3]
- Updated dependencies [77fab49]
- Updated dependencies [4e00d85]
- Updated dependencies [58d2e8c]
- Updated dependencies [2ccac87]
- Updated dependencies [9797718]
- Updated dependencies [8efca60]
- Updated dependencies [679719b]
- Updated dependencies [2ebed5f]
- Updated dependencies [4f4f3ee]
- Updated dependencies [88298d5]
- Updated dependencies [9c878e2]
- Updated dependencies [2f68f71]
- Updated dependencies [b673bfa]
- Updated dependencies [b84b71b]
- Updated dependencies [8540b93]
- Updated dependencies [9254424]
- Updated dependencies [81eafad]
- Updated dependencies [4c03455]
- Updated dependencies [3e68ec2]
- Updated dependencies [3137076]
- Updated dependencies [157c31e]
- Updated dependencies [feeed7a]
- Updated dependencies [4cc71ee]
- Updated dependencies [8330f0c]
- Updated dependencies [5990fd0]
- Updated dependencies [d0f99b4]
- Updated dependencies [9b62fc2]
- Updated dependencies [a039d2e]
- Updated dependencies [b6eeb3e]
- Updated dependencies [ee56556]
- Updated dependencies [e63b5dd]
- Updated dependencies [0b78f92]
- Updated dependencies [1423647]
- Updated dependencies [cbc418b]
- Updated dependencies [392d7cd]
- Updated dependencies [74d50d4]
- Updated dependencies [e723c09]
- Updated dependencies [9783ba8]
- Updated dependencies [edefaf9]
- Updated dependencies [3e5f3dc]
- Updated dependencies [77dd2a4]
- Updated dependencies [9fe7d4f]
- Updated dependencies [409a07e]
- Updated dependencies [8c73da3]
- Updated dependencies [8572be4]
- Updated dependencies [df9b158]
- Updated dependencies [502e6d5]
- Updated dependencies [c36391c]
- Updated dependencies [6cdf20c]
- Updated dependencies [f63a497]
- Updated dependencies [9ce8ad3]
- Updated dependencies [7fdf9c2]
- Updated dependencies [aafec7f]
- Updated dependencies [0ab2355]
- Updated dependencies [f0ce284]
- Updated dependencies [cc72dcc]
- Updated dependencies [890b8a2]
- Updated dependencies [1ad3001]
- Updated dependencies [93a1d7c]
- Updated dependencies [91fe8bb]
- Updated dependencies [e38bf19]
- Updated dependencies [100fc95]
- Updated dependencies [4423c35]
- Updated dependencies [cab83ce]
- Updated dependencies [e19f046]
- Updated dependencies [78d6394]
- Updated dependencies [28e0262]
- Updated dependencies [863c3e8]
- Updated dependencies [a049abf]
- Updated dependencies [ec55e54]
- Updated dependencies [5834c81]
- Updated dependencies [d7606d3]
- Updated dependencies [77d9497]
- Updated dependencies [09b1a4e]
- Updated dependencies [3abc5f6]
- Updated dependencies [cac51cb]
- Updated dependencies [0ef793f]
- Updated dependencies [84ca649]
- Updated dependencies [679119f]
- Updated dependencies [d9fd0ab]
- Updated dependencies [a6128a3]
- Updated dependencies [9c04caa]
- Updated dependencies [852160e]
- Updated dependencies [e026112]
- Updated dependencies [0088ede]
- Updated dependencies [71b8727]
- Updated dependencies [60349b8]
- Updated dependencies [94759f7]
- Updated dependencies [281ab28]
- Updated dependencies [e74ee2f]
- Updated dependencies [40988de]
- Updated dependencies [d0e894d]
- Updated dependencies [5fc6e8b]
  - @breadboard-ai/build@0.10.0
  - @breadboard-ai/shared-ui@1.17.0
  - @google-labs/gemini-kit@0.8.0
  - @breadboard-ai/google-drive-kit@0.2.4
  - @breadboard-ai/python-wasm@0.1.6
  - @google-labs/core-kit@0.15.0
  - @google-labs/json-kit@0.3.8
  - @google-labs/agent-kit@0.12.0
  - @google-labs/breadboard@0.27.0
  - @breadboard-ai/idb-board-server@1.17.0
  - @breadboard-ai/board-server-management@1.17.0
  - @breadboard-ai/board-server-utils@0.1.1
  - @breadboard-ai/example-boards@0.3.2
  - @google-labs/template-kit@0.3.10
  - @google-labs/node-nursery-web@1.3.2
  - @breadboard-ai/data-store@0.2.3
  - @breadboard-ai/manifest@0.4.4
  - @google-labs/palm-kit@0.1.4

## 1.18.0

### Minor Changes

- 7d46a63: Teach Visual Editor to use board server's node proxy to run boards.

### Patch Changes

- 3b9229d: Teach Specialist to correctly label the tools array as config.
- fa8a752: Fix a few nagging bugs in the Component Configuration view.
- c1dc2a4: Deprecate bubbling `model` inputs.
- 1a70e7d: Make Looper model switchable.
- Updated dependencies [3b9229d]
- Updated dependencies [bbcdd2d]
- Updated dependencies [fa8a752]
- Updated dependencies [9ed58cf]
- Updated dependencies [13c27cb]
- Updated dependencies [7f2ef33]
- Updated dependencies [3cb60e9]
- Updated dependencies [85fb144]
- Updated dependencies [3cb60e9]
- Updated dependencies [c1dc2a4]
- Updated dependencies [7d46a63]
- Updated dependencies [125cf75]
- Updated dependencies [1a70e7d]
- Updated dependencies [bac2e35]
- Updated dependencies [ec2fedd]
  - @google-labs/agent-kit@0.11.0
  - @breadboard-ai/build@0.9.1
  - @breadboard-ai/shared-ui@1.16.1
  - @google-labs/gemini-kit@0.7.0
  - @breadboard-ai/example-boards@0.3.1
  - @google-labs/core-kit@0.14.1
  - @google-labs/breadboard@0.26.0
  - @breadboard-ai/data-store@0.2.2
  - @google-labs/json-kit@0.3.7
  - @breadboard-ai/manifest@0.4.3
  - @google-labs/node-nursery-web@1.3.1
  - @google-labs/palm-kit@0.1.3
  - @google-labs/template-kit@0.3.9

## 1.17.0

### Minor Changes

- cacd8e2: Introduce HTML preview for llm-output.
- 1a6a9cf: Teach Specialist to ask for a model.
- e0dccfe: Polish app view.
- f6c6378: Remove auto-sign-in machinery (it can't work as designed)
- 068e8cb: Introduce the invite links system for board server.
- 78a6bcf: Remove example inputs from gemini-generator
- de90fb7: Extract UI to packages/shared-ui
- e0d5971: Teach App view to stop/restart gracefully.
- 28895c3: Add support for inline controls
- 494d5ca: Remove examples from Agent Kit components.
- 7de241c: Remove `BoardRunner`.

### Patch Changes

- 49b3612: Restore preview functionality
- df6ba88: Add environment variables to files group for build
- efdb201: Prevent multiple save calls happening in parallel
- b201e07: Implement edge-based UI in board-server (and fix a bunch of bugs
  elsewhere)
- 05e3ff2: Added two new tools
- 0296c89: Teach LLMContentArray check to ignore $metadata
- 5f7f44b: Clear part cache when item changes
- c1e21f7: Move configuration to inline controls
- ee1f9ca: Throttle describe requests to once every 5 seconds.
- 9998938: Configure connection server URL via environment variable
- Updated dependencies [cc5f4b6]
- Updated dependencies [cacd8e2]
- Updated dependencies [1a6a9cf]
- Updated dependencies [49b3612]
- Updated dependencies [e0dccfe]
- Updated dependencies [6404cb3]
- Updated dependencies [9ad0524]
- Updated dependencies [78a6bcf]
- Updated dependencies [a4301e6]
- Updated dependencies [7fdd660]
- Updated dependencies [a940b87]
- Updated dependencies [001b250]
- Updated dependencies [b201e07]
- Updated dependencies [05e3ff2]
- Updated dependencies [15b5659]
- Updated dependencies [374ea85]
- Updated dependencies [0296c89]
- Updated dependencies [de90fb7]
- Updated dependencies [a34bb69]
- Updated dependencies [534d67e]
- Updated dependencies [e0dccfe]
- Updated dependencies [c397d53]
- Updated dependencies [f93ec06]
- Updated dependencies [cc5f4b6]
- Updated dependencies [398bf4f]
- Updated dependencies [28895c3]
- Updated dependencies [a940b87]
- Updated dependencies [d799af1]
- Updated dependencies [494d5ca]
- Updated dependencies [7de241c]
- Updated dependencies [c1e21f7]
- Updated dependencies [a424c92]
- Updated dependencies [ee1f9ca]
- Updated dependencies [c2cd40d]
- Updated dependencies [262cefd]
- Updated dependencies [79d709c]
- Updated dependencies [9998938]
  - @breadboard-ai/build@0.9.0
  - @breadboard-ai/shared-ui@1.16.0
  - @google-labs/agent-kit@0.10.0
  - @google-labs/breadboard@0.25.0
  - @google-labs/gemini-kit@0.6.0
  - @google-labs/core-kit@0.14.0
  - @breadboard-ai/example-boards@0.3.0
  - @breadboard-ai/data-store@0.2.1
  - @breadboard-ai/google-drive-kit@0.2.3
  - @breadboard-ai/python-wasm@0.1.5
  - @google-labs/node-nursery-web@1.3.0
  - @google-labs/json-kit@0.3.6
  - @google-labs/template-kit@0.3.8
  - @breadboard-ai/manifest@0.4.2
  - @google-labs/palm-kit@0.1.2

## 1.15.0

### Minor Changes

- 3f8cdd1: Introduce run store

### Patch Changes

- 00875af: Teach User Input to honor enums
- 89ccc90: Reinstate "Test Component"
- 9f33a12: Remove explicit site name from Firebase hosting config
- 62f8d5b: Fix replay of saved runs
- Updated dependencies [8c694ed]
- Updated dependencies [bbf2c30]
- Updated dependencies [14df6a8]
- Updated dependencies [c5c39be]
- Updated dependencies [1dc645a]
- Updated dependencies [2aabb7a]
- Updated dependencies [fb72771]
- Updated dependencies [9b22cab]
- Updated dependencies [00cc2c5]
- Updated dependencies [c04cff0]
- Updated dependencies [d88c37b]
- Updated dependencies [3f8cdd1]
- Updated dependencies [3a5ced1]
- Updated dependencies [62f8d5b]
  - @google-labs/breadboard@0.24.0
  - @google-labs/agent-kit@0.9.1
  - @google-labs/node-nursery-web@1.2.0
  - @google-labs/core-kit@0.13.0
  - @breadboard-ai/build@0.8.1
  - @breadboard-ai/data-store@0.2.0
  - @breadboard-ai/example-boards@0.2.1
  - @google-labs/gemini-kit@0.5.4
  - @google-labs/json-kit@0.3.5
  - @breadboard-ai/manifest@0.4.1
  - @google-labs/palm-kit@0.1.1
  - @google-labs/template-kit@0.3.7
  - @breadboard-ai/google-drive-kit@0.2.2

## 1.14.0

### Minor Changes

- 9171352: Migrates the node configuration to new unified user input component
- 2b9ef5b: Rewrire Datastore usage
- 1a83a77: Migrate Activity Log to new unified input
- 5f6d97c: Separate playground and examples
- 2312443: Add support for `deprecated` and `experimental` tags on Kits.
- 6ffa89c: Migrate to new data-store package

### Patch Changes

- e6c7269: Reinstate autosubmit of secrets
- 62e5a34: Tidy the unified input a little
- bdaaa81: Add example boards deps to vite build.
- fa9073d: Fix bug where code editor fails to show up
- 4e2fbd6: Prevent nav from jumping when a user selects an item
- ec06605: Improve Array Editor robustness
- 8d2e618: Teach Human to act as a start node.
- 215bd15: Add google-drive-file-id
- 2a206e8: Add "copy board URL to clipboard" option to overflow menu
- 645eb63: Minor UI tweaks to VE and website
- a0852df: Update titles and help links in Core Kit.
- 8b370d7: Increase the set of reasons to refresh the side nav
- 98f0ff2: Improve board support in unified editor
- 9a2ffab: Unpin @breadboard-ai/build dependency from being overly constrained
- 0a846ff: Switch from google-drive connection id to google-drive-limited, which
  requests access only to shared files, not all files.
- 618e265: Add MVP of Node Runner
- a527740: Add improved support for untyped arrays and objects
- f1546f5: Make some tweaks to help newer users
- 960922e: Store the OAuth client ID locally, in addition to the token details.
  Useful for APIs that require the client ID to be provided.
- 1d98374: Teach unified input to honor multiline strings
- 70ba2d3: Teach Activity Log & Unified User Input about secrets
- Updated dependencies [cb0f513]
- Updated dependencies [ad8aa22]
- Updated dependencies [0519ebb]
- Updated dependencies [1e1be2a]
- Updated dependencies [6d2939e]
- Updated dependencies [15b6171]
- Updated dependencies [5c5b665]
- Updated dependencies [2b094a3]
- Updated dependencies [fa93c3f]
- Updated dependencies [8d2e618]
- Updated dependencies [f78ec0a]
- Updated dependencies [215bd15]
- Updated dependencies [2b9ef5b]
- Updated dependencies [8dbbe20]
- Updated dependencies [a0852df]
- Updated dependencies [38e3232]
- Updated dependencies [7298a47]
- Updated dependencies [ea7e2a1]
- Updated dependencies [8edcbc0]
- Updated dependencies [5ce1026]
- Updated dependencies [8db38aa]
- Updated dependencies [5f6d97c]
- Updated dependencies [9a2ffab]
- Updated dependencies [b049e00]
- Updated dependencies [0a846ff]
- Updated dependencies [b99472b]
- Updated dependencies [4bfaec5]
- Updated dependencies [2312443]
- Updated dependencies [1341291]
- Updated dependencies [b76f9a1]
- Updated dependencies [6ffa89c]
- Updated dependencies [15ae381]
  - @breadboard-ai/google-drive-kit@0.2.1
  - @breadboard-ai/build@0.8.0
  - @google-labs/gemini-kit@0.5.3
  - @google-labs/breadboard@0.23.0
  - @google-labs/core-kit@0.12.0
  - @google-labs/template-kit@0.3.6
  - @breadboard-ai/data-store@0.1.0
  - @google-labs/agent-kit@0.9.0
  - @google-labs/json-kit@0.3.4
  - @breadboard-ai/example-boards@0.2.0
  - @breadboard-ai/manifest@0.4.0
  - @breadboard-ai/python-wasm@0.1.4
  - @google-labs/palm-kit@0.1.0
  - @google-labs/node-nursery-web@1.1.6

## 1.12.0

### Minor Changes

- 6f82dea: Update Visual Editor package name
- 0f9d617: Move breadboard-web to visual-editor; remove breadbuddy
- 4ba1243: Migrate breadboard-ui to visual-editor

### Patch Changes

- 39f1aed: Improve paste handling in main area
- c77b034: Add Getting Started Guide to Visual Editor
- 43fc9fc: Change edit board to close
- f4397b9: Update remaining breadboard-web paths
- 66918fc: Enable pasting when on the Welcome Pane
- 4c5bc52: Add Other Features section to Visual Editor docs
- 4bf8894: Redirect older /graphs/ URLs to /example-boards/
- 6b91b3e: Remove unused editable property
- eaca143: Fall back to URL Constructor for browsers without canParse
- 54cb2d4: Fix subgraph metadata bug
- 6a59c83: Use the filename from the board's URL when exporting
- e414ba0: Add New Board button to Welcome Pane
- b357fbc: Sort nodes by selection status
- bc8dcdd: Remind generate-graphs that it depends on agent-kit
- fa2d1ab: Add fancy-json component for rendering JSON with configurable
  highlighting
- 51034a0: Fix editor locking input focus (again)
- 7bdb5a2: Default node x & y to 0 if not set
- cb455ef: Account for schema mismatch in fetch component
- 10bfeba: Clean up recent boards on delete
- d016297: Tweak pasting of nodes when there is no metadata
- ffe100b: Tweak the board selector to only show tools
- bd55f95: Add components section to Visual Editor docs
- cb0237d: Remove default when changing from array to anything else
- 05f3acb: Null out the editor property sooner
- 9d4ea07: Attempt to maintain property order in the schema editor
- 164d104: Show red squigglies in port tooltips under mismatched schema
  constraints
- 4c1a17c: Rename node to component; fix schema issue
- a0587ec: Version Bump
- 359424b: Add Activity Pane section to Visual Editor docs
- a30fb39: Release drag behavior when clicking on port
- Updated dependencies [a925cf0]
- Updated dependencies [f2d9839]
- Updated dependencies [f4d2416]
- Updated dependencies [bc94299]
- Updated dependencies [f4397b9]
- Updated dependencies [166f290]
- Updated dependencies [da43bb5]
- Updated dependencies [5cf08f1]
- Updated dependencies [9d93cf8]
- Updated dependencies [9d93cf8]
- Updated dependencies [bc8dcdd]
- Updated dependencies [ffbf163]
- Updated dependencies [8928fb7]
- Updated dependencies [9d93cf8]
- Updated dependencies [d6706f2]
- Updated dependencies [5f6432b]
- Updated dependencies [5447426]
- Updated dependencies [4da35e5]
- Updated dependencies [26e1099]
- Updated dependencies [7e1f01c]
- Updated dependencies [a9def5c]
  - @google-labs/breadboard@0.22.0
  - @breadboard-ai/google-drive-kit@0.2.0
  - @google-labs/core-kit@0.11.0
  - @google-labs/agent-kit@0.8.1
  - @breadboard-ai/build@0.7.1
  - @breadboard-ai/manifest@0.3.0
  - @breadboard-ai/example-boards@0.1.1
  - @google-labs/gemini-kit@0.5.2
  - @google-labs/json-kit@0.3.3
  - @google-labs/node-nursery-web@1.1.5
  - @google-labs/palm-kit@0.0.16
  - @google-labs/template-kit@0.3.5
  - @breadboard-ai/python-wasm@0.1.3

## 1.10.1

### Patch Changes

- 29774aa: Update dependency package versions.
- Updated dependencies [29774aa]
  - @breadboard-ai/google-drive-kit@0.1.3
  - @google-labs/template-kit@0.3.4
  - @breadboard-ai/python-wasm@0.1.2
  - @google-labs/gemini-kit@0.5.1
  - @google-labs/core-kit@0.10.1
  - @google-labs/json-kit@0.3.2

## 1.10.0

### Minor Changes

- 59dd0f5: Add support for "mine" property
- 345738d: Implement auth support for board server.
- b3aa884: Introduce undo/redo capability in Editor API.
- 57e8714: Add basic support for board servers
- 7af14cf: Add support for comment nodes
- bcfba50: Add App View to Board Server
- 631babd: Make board server deployable in more environments.
- 778f7aa: Teach Breadboard to load runs with non-text content.
- 808f5e2: Introduce graph edit history API.
- e0fdbc3: Use LLMContent types in blank graphs.
- 14853d5: Add Gemini Nano node.
- 8798514: Combine several Editor API methods to one `edit`.
- 431fa3d: Add support for website embeds of boards & YouTube videos
- 8c90376: Add support for help
- c53ca01: Plumb `DataStore` throuh to `NodeHandlerContext`.
- 37418d9: Introduce the `iframe.html` entry point for running Breadboard in an
  iframe.
- d1a9d8a: Update icons to match designs
- 5b03d96: Start using multi-edit capability when pasting nodes.
- f0d8d67: Remove the old "star port as ad-hoc port drop zone" machinery.
- 225c7cc: Implement simple ACL for board server.
- 546752d: Move Provider List to be nearer designs
- 009e0ea: Add Welcome Panel
- 7429050: Teach Visual Editor about copy-pasting nodes
- 331d4b5: Add published/draft controls for boards

### Patch Changes

- 5a55b7d: Don't prefill inputs from bubbled inputs.
- f4c9d36: Add support for tool tagging
- 7dd8fee: Fix various UX issues with multi-select
- 2e023b8: Shorten replay delay to 10ms.
- 3d5ae56: Refactor app main bar to have overflow menu
- dfc6054: Teach Specialist about boards with no inputs.
- 0a9769b: Various small tweaks
- 9c97650: Restore settings to menu
- 608edac: Add support for links in comments
- 5a55b7d: Only ask to choose when there are more than one choices.
- fea8967: Add basic "Save As..." support
- d131307: No longer require property to be named `context`.
- 499eac0: Ensure Graph Renderer is only initialized once
- 00746bb: Remove old multilayout event
- 726d38e: Switch setting defaults
- 83ed3b5: Fall back to fetch and teach `GraphAssets` to be more loose about
  asset-loading.
- 54b03b9: Update nav styling
- 714a536: A working sketch of a server.
- cf17933: Add history overlay element (plus a few other minor fixes)
- 1f7e37d: updates for breadboard web
- bfa65a3: Disable incremental configuration edits.
- 3ab7a87: Add undo/redo to main header bar
- ef86632: Remind generate-graphs that it depends on agent-kit
- 4db3ab7: Teach Specialist to pass context to tools.
- 537d9f9: Add guide on creating tools
- 8ec03e0: Tidy up the RemoteGraphProvider canProvide function
- 2e3f555: Fix missing icons
- 7c1b4cb: Temporarily mark new board server boards as published.
- 702cfe1: Unblock UI on Providers
- a5898df: Retire the single node move event
- 08c999a: Add support for "Save As..." when save is unavailable
- c03173d: Minor UI fixes for recent boards
- d6867c0: Support drag and drop of run data
- 8dbb1cf: Add manifest as a build dependency.
- Updated dependencies [5a55b7d]
- Updated dependencies [f4c9d36]
- Updated dependencies [7dd8fee]
- Updated dependencies [f62d4da]
- Updated dependencies [74ade20]
- Updated dependencies [bac5642]
- Updated dependencies [7840ff9]
- Updated dependencies [16e50fb]
- Updated dependencies [c27c176]
- Updated dependencies [59dd0f5]
- Updated dependencies [cc50932]
- Updated dependencies [583f813]
- Updated dependencies [81315de]
- Updated dependencies [4e66406]
- Updated dependencies [d9b76bd]
- Updated dependencies [0ff2afd]
- Updated dependencies [417323c]
- Updated dependencies [3d5ae56]
- Updated dependencies [b3aa884]
- Updated dependencies [85bbc00]
- Updated dependencies [dfc6054]
- Updated dependencies [f0b68d0]
- Updated dependencies [00825d5]
- Updated dependencies [57e8714]
- Updated dependencies [e79d6c3]
- Updated dependencies [9bbdfc7]
- Updated dependencies [3d7b4a7]
- Updated dependencies [cf7710c]
- Updated dependencies [b44de19]
- Updated dependencies [89dcc4f]
- Updated dependencies [7af14cf]
- Updated dependencies [bcfba50]
- Updated dependencies [4db3ab7]
- Updated dependencies [c4e0dc1]
- Updated dependencies [d9b76bd]
- Updated dependencies [0a9769b]
- Updated dependencies [9c97650]
- Updated dependencies [608edac]
- Updated dependencies [5a55b7d]
- Updated dependencies [fea8967]
- Updated dependencies [14cf52b]
- Updated dependencies [778f7aa]
- Updated dependencies [808f5e2]
- Updated dependencies [9226f7c]
- Updated dependencies [5498957]
- Updated dependencies [d131307]
- Updated dependencies [499eac0]
- Updated dependencies [00746bb]
- Updated dependencies [5ebd65f]
- Updated dependencies [e0fdbc3]
- Updated dependencies [a4b3d7c]
- Updated dependencies [e0eac55]
- Updated dependencies [091fff2]
- Updated dependencies [83ed3b5]
- Updated dependencies [54b03b9]
- Updated dependencies [810d7fd]
- Updated dependencies [8bb2684]
- Updated dependencies [14853d5]
- Updated dependencies [07a8642]
- Updated dependencies [d6ab0c5]
- Updated dependencies [5a0afe4]
- Updated dependencies [8798514]
- Updated dependencies [e0b3503]
- Updated dependencies [85f023d]
- Updated dependencies [0d61879]
- Updated dependencies [3352ec5]
- Updated dependencies [71f3366]
- Updated dependencies [b7dab90]
- Updated dependencies [32a48a3]
- Updated dependencies [c52e81d]
- Updated dependencies [eb64b9a]
- Updated dependencies [6fdd89e]
- Updated dependencies [cf17933]
- Updated dependencies [1f7e37d]
- Updated dependencies [431fa3d]
- Updated dependencies [c82138d]
- Updated dependencies [8c90376]
- Updated dependencies [32a48a3]
- Updated dependencies [4db3ab7]
- Updated dependencies [cd73b17]
- Updated dependencies [81d82fe]
- Updated dependencies [537d9f9]
- Updated dependencies [2a7531b]
- Updated dependencies [2e3f555]
- Updated dependencies [7c1b4cb]
- Updated dependencies [c692608]
- Updated dependencies [702cfe1]
- Updated dependencies [a5898df]
- Updated dependencies [bebd96e]
- Updated dependencies [91cb723]
- Updated dependencies [3e10f0f]
- Updated dependencies [0e54e55]
- Updated dependencies [c53ca01]
- Updated dependencies [6ada218]
- Updated dependencies [4c681cb]
- Updated dependencies [fb2e584]
- Updated dependencies [39789fd]
- Updated dependencies [d3dec5f]
- Updated dependencies [a8bb460]
- Updated dependencies [9491266]
- Updated dependencies [0e76614]
- Updated dependencies [2ace620]
- Updated dependencies [295b767]
- Updated dependencies [faca485]
- Updated dependencies [c5f8e4f]
- Updated dependencies [fcef799]
- Updated dependencies [08c999a]
- Updated dependencies [37418d9]
- Updated dependencies [26556b6]
- Updated dependencies [083f69c]
- Updated dependencies [ff498e1]
- Updated dependencies [5f09b1d]
- Updated dependencies [c03173d]
- Updated dependencies [b75a43e]
- Updated dependencies [914015f]
- Updated dependencies [d6867c0]
- Updated dependencies [6fdd89e]
- Updated dependencies [cd73e95]
- Updated dependencies [69b04a0]
- Updated dependencies [5f09b1d]
- Updated dependencies [d1a9d8a]
- Updated dependencies [5b03d96]
- Updated dependencies [244e642]
- Updated dependencies [8e2c44d]
- Updated dependencies [f0d8d67]
- Updated dependencies [9b1513a]
- Updated dependencies [510e198]
- Updated dependencies [836389d]
- Updated dependencies [225c7cc]
- Updated dependencies [546752d]
- Updated dependencies [78510e3]
- Updated dependencies [009e0ea]
- Updated dependencies [9491266]
- Updated dependencies [7429050]
- Updated dependencies [98665dd]
- Updated dependencies [06c3f57]
- Updated dependencies [331d4b5]
  - @google-labs/breadboard@0.21.0
  - @google-labs/breadboard-ui@0.9.0
  - @google-labs/agent-kit@0.8.0
  - @google-labs/core-kit@0.10.0
  - @breadboard-ai/build@0.7.0
  - @google-labs/template-kit@0.3.3
  - @google-labs/json-kit@0.3.1
  - @google-labs/gemini-kit@0.5.0
  - @google-labs/breadboard-manifest@0.2.0
  - @google-labs/node-nursery-web@1.1.4
  - @google-labs/palm-kit@0.0.15
  - @breadboard-ai/google-drive-kit@0.1.1
  - @breadboard-ai/python-wasm@0.1.1

## 1.9.0

### Minor Changes

- 23b8acb: Teach UI to handle arrays of LLM Content
- 04e892e: Update UI colors
- 69b6e44: Tidy event names
- 42495d8: Teach UI Controller about stopping runs
- 94caed3: Teach editor about ad-hoc edges

### Patch Changes

- fe4c564: Teach settings about node type descriptions
- 4203076: Update boards to make better use of `llm-content`.
- 7d0b89c: Teach Preview to use inputs in settings
- 9212366: Various UI Tweaks
- e337629: Add part controls to LLM Content Input
- c91fb1e: Tidy events a little bit
- 3397974: Add `InspectableNode.type()` and start using it.
- fe2066b: Teach LLM Content to handle plain text a bit better
- cc1a625: Bring back Preview
- a945fba: Teach editor to disambiguate edges
- Updated dependencies [8097177]
- Updated dependencies [1db4a8f]
- Updated dependencies [29d3712]
- Updated dependencies [ffd2e8e]
- Updated dependencies [e00f855]
- Updated dependencies [8774855]
- Updated dependencies [1b596d4]
- Updated dependencies [edec774]
- Updated dependencies [29eda71]
- Updated dependencies [4957dc5]
- Updated dependencies [7936d8b]
- Updated dependencies [fe4c564]
- Updated dependencies [8eaedaf]
- Updated dependencies [c69f1c5]
- Updated dependencies [4203076]
- Updated dependencies [a297d10]
- Updated dependencies [23b8acb]
- Updated dependencies [f60cb06]
- Updated dependencies [3f0ce31]
- Updated dependencies [c3d386a]
- Updated dependencies [9212366]
- Updated dependencies [f4ed7ba]
- Updated dependencies [04e892e]
- Updated dependencies [cec6d54]
- Updated dependencies [e337629]
- Updated dependencies [bfdb36a]
- Updated dependencies [c91fb1e]
- Updated dependencies [87eb8fe]
- Updated dependencies [4eeacbe]
- Updated dependencies [69b6e44]
- Updated dependencies [f97a4d5]
- Updated dependencies [f0cb9e3]
- Updated dependencies [150f3bd]
- Updated dependencies [60a18c5]
- Updated dependencies [b0ed6f3]
- Updated dependencies [4957dc5]
- Updated dependencies [f0409d1]
- Updated dependencies [ffbea5d]
- Updated dependencies [a209c51]
- Updated dependencies [339543d]
- Updated dependencies [3f0ce31]
- Updated dependencies [cdcbcdb]
- Updated dependencies [a4d9d23]
- Updated dependencies [40ce086]
- Updated dependencies [e68c06d]
- Updated dependencies [3397974]
- Updated dependencies [09d8288]
- Updated dependencies [7368fdd]
- Updated dependencies [c9c0e06]
- Updated dependencies [8838ba7]
- Updated dependencies [b6ade85]
- Updated dependencies [b2a968b]
- Updated dependencies [fe2066b]
- Updated dependencies [6c659f2]
- Updated dependencies [c1acf24]
- Updated dependencies [8170942]
- Updated dependencies [3e58d25]
- Updated dependencies [8bef702]
- Updated dependencies [af54870]
- Updated dependencies [2197ed6]
- Updated dependencies [3920805]
- Updated dependencies [d10f568]
- Updated dependencies [ab9a4ce]
- Updated dependencies [1f4e3b4]
- Updated dependencies [74434ea]
- Updated dependencies [3b2bb4a]
- Updated dependencies [a35406c]
- Updated dependencies [31cf016]
- Updated dependencies [ab43276]
- Updated dependencies [477e6e6]
- Updated dependencies [7b18cb2]
- Updated dependencies [cbd6053]
- Updated dependencies [cdcbcdb]
- Updated dependencies [d66af7b]
- Updated dependencies [ee85b67]
- Updated dependencies [791ec2a]
- Updated dependencies [c0293c9]
- Updated dependencies [bfdb36a]
- Updated dependencies [c27aa9b]
- Updated dependencies [1d29493]
- Updated dependencies [093e769]
- Updated dependencies [b6f5644]
- Updated dependencies [f870bdd]
- Updated dependencies [42495d8]
- Updated dependencies [afffaaf]
- Updated dependencies [a945fba]
- Updated dependencies [94caed3]
- Updated dependencies [43edef6]
  - @google-labs/breadboard@0.20.0
  - @google-labs/breadboard-ui@0.8.0
  - @google-labs/gemini-kit@0.4.0
  - @google-labs/core-kit@0.9.0
  - @breadboard-ai/build@0.6.0
  - @google-labs/json-kit@0.3.0
  - @google-labs/agent-kit@0.7.0
  - @google-labs/node-nursery-web@1.1.3
  - @google-labs/palm-kit@0.0.14
  - @google-labs/pinecone-kit@0.1.12
  - @google-labs/template-kit@0.3.2

## 1.8.1

### Patch Changes

- Updated dependencies [63eb779]
  - @google-labs/breadboard@0.19.0
  - @google-labs/breadboard-ui@0.7.1
  - @breadboard-ai/build@0.5.1
  - @google-labs/core-kit@0.8.1
  - @google-labs/gemini-kit@0.3.1
  - @google-labs/json-kit@0.2.2
  - @google-labs/node-nursery-web@1.1.2
  - @google-labs/palm-kit@0.0.13
  - @google-labs/pinecone-kit@0.1.11
  - @google-labs/template-kit@0.3.1

## 1.8.0

### Minor Changes

- f03d11f: Make node proxy servers configurable in settings.
- cdc23bb: Make bubbled input values configurable.
- e736f37: Remove deprecated input-multipart
- 3d48482: Change all multi-modal inputs to be a format of llm-content
- 24230c1: Introduce LLM Content Editor
- bd44e29: Support audio input
- 12b825f: Implement streamlined properties panel

### Patch Changes

- dbd9267: Teach graph how to expand and collapse nodes
- 39016d9: Teach node selector about node shortcuts
- 54baba8: Implement `AbortSignal` support.
- cc47fe7: Add additional types to LLM Content Input
- f2eda0b: Fix lots of bugs around Tool Worker.
- 5d601fb: Add setting for show/hide of "advanced ports"
- 6a2af3e: Hide Embedded Board Selector When Empty
- ad5f570: Teach Editor to have basic overflow menu
- 5369037: Fix JSONata calls to account for LLM Content
- Updated dependencies [dbd9267]
- Updated dependencies [3f9507d]
- Updated dependencies [39016d9]
- Updated dependencies [cef20ca]
- Updated dependencies [55a9647]
- Updated dependencies [1e86a87]
- Updated dependencies [3f9507d]
- Updated dependencies [18b9f34]
- Updated dependencies [1adb24c]
- Updated dependencies [1e86a87]
- Updated dependencies [d7829a1]
- Updated dependencies [fbf7a83]
- Updated dependencies [fefd109]
- Updated dependencies [706c6a8]
- Updated dependencies [e7faf4b]
- Updated dependencies [c1dcb0a]
- Updated dependencies [54baba8]
- Updated dependencies [49c3aa1]
- Updated dependencies [cdc23bb]
- Updated dependencies [c1652c2]
- Updated dependencies [416aed2]
- Updated dependencies [1adb24c]
- Updated dependencies [fefd109]
- Updated dependencies [a1fcaea]
- Updated dependencies [1aa96c6]
- Updated dependencies [d9ac358]
- Updated dependencies [691f3d6]
- Updated dependencies [c3ed6a7]
- Updated dependencies [81a43c4]
- Updated dependencies [cc47fe7]
- Updated dependencies [f1883d1]
- Updated dependencies [1adb24c]
- Updated dependencies [d8cb0c9]
- Updated dependencies [e736f37]
- Updated dependencies [34d9c6d]
- Updated dependencies [34d9c6d]
- Updated dependencies [e6e0168]
- Updated dependencies [3d48482]
- Updated dependencies [fb3f870]
- Updated dependencies [24230c1]
- Updated dependencies [1adb24c]
- Updated dependencies [c117d4f]
- Updated dependencies [f2eda0b]
- Updated dependencies [5d601fb]
- Updated dependencies [3f9507d]
- Updated dependencies [626139b]
- Updated dependencies [1adb24c]
- Updated dependencies [3f9507d]
- Updated dependencies [bd44e29]
- Updated dependencies [c4ca6dc]
- Updated dependencies [1adb24c]
- Updated dependencies [6a2af3e]
- Updated dependencies [cfbcdf2]
- Updated dependencies [1d9cb16]
- Updated dependencies [ad5f570]
- Updated dependencies [49da151]
- Updated dependencies [31200be]
- Updated dependencies [43da00a]
- Updated dependencies [3f9507d]
- Updated dependencies [dfd5ce2]
- Updated dependencies [cfc0f15]
- Updated dependencies [5d08172]
- Updated dependencies [00ccb9d]
- Updated dependencies [776f043]
- Updated dependencies [08eabf4]
- Updated dependencies [79909eb]
- Updated dependencies [5369037]
- Updated dependencies [12b825f]
- Updated dependencies [c3587e1]
- Updated dependencies [34d9c6d]
- Updated dependencies [99fcffe]
- Updated dependencies [1e86a87]
- Updated dependencies [4d6ce42]
- Updated dependencies [3f9507d]
- Updated dependencies [ff4bfe9]
- Updated dependencies [d9ac358]
  - @google-labs/breadboard-ui@0.7.0
  - @breadboard-ai/build@0.5.0
  - @google-labs/breadboard@0.18.0
  - @google-labs/template-kit@0.3.0
  - @google-labs/core-kit@0.8.0
  - @google-labs/node-nursery-web@1.1.1
  - @google-labs/json-kit@0.2.1
  - @google-labs/palm-kit@0.0.12
  - @google-labs/gemini-kit@0.3.0
  - @google-labs/agent-kit@0.6.0
  - @google-labs/pinecone-kit@0.1.10

## 1.7.0

### Minor Changes

- 3a31595: Add support for metadata editing
- 634712b: Teach Visual Editor about embedded boards
- 5a7bc86: Teach Node Info to use Board Selector
- 68c2ac4: Consolidate UI components somewhat

### Patch Changes

- 276152e: Add "quick jump" for embedded subgraphs
- 8046c47: Be a little more economical with settings saves
- a5543eb: Add tab support for code editor
- 7bafa40: Introduce `graphchangereject` event in Editor API.
- 6498389: Educate sub board selector how to change sub board info
- 9a8bd0e: Teach Preview to use & save secrets from settings
- 12c1a72: Teach node info about code
- Updated dependencies [b244fba]
- Updated dependencies [de524a4]
- Updated dependencies [72b3319]
- Updated dependencies [41afcac]
- Updated dependencies [f6f5202]
- Updated dependencies [c3cb25f]
- Updated dependencies [de524a4]
- Updated dependencies [ae79e4a]
- Updated dependencies [152f17d]
- Updated dependencies [de524a4]
- Updated dependencies [276152e]
- Updated dependencies [72c5c6b]
- Updated dependencies [de524a4]
- Updated dependencies [3a31595]
- Updated dependencies [634712b]
- Updated dependencies [a5543eb]
- Updated dependencies [0831735]
- Updated dependencies [dd810dd]
- Updated dependencies [1b6fb74]
- Updated dependencies [c5ba396]
- Updated dependencies [7bafa40]
- Updated dependencies [d439ae5]
- Updated dependencies [2932f4b]
- Updated dependencies [51159c4]
- Updated dependencies [55ed307]
- Updated dependencies [cffceb9]
- Updated dependencies [407b726]
- Updated dependencies [5a7bc86]
- Updated dependencies [68c2ac4]
- Updated dependencies [6498389]
- Updated dependencies [6f9ba52]
- Updated dependencies [229ad22]
- Updated dependencies [914353c]
- Updated dependencies [231dd0e]
- Updated dependencies [12c1a72]
- Updated dependencies [d60f38b]
- Updated dependencies [5602f1e]
- Updated dependencies [de524a4]
  - @google-labs/template-kit@0.2.6
  - @breadboard-ai/build@0.4.0
  - @google-labs/breadboard-ui@0.6.0
  - @google-labs/breadboard@0.17.0
  - @google-labs/core-kit@0.7.0
  - @google-labs/gemini-kit@0.2.0
  - @google-labs/node-nursery-web@1.1.0
  - @google-labs/agent-kit@0.5.0
  - @google-labs/json-kit@0.2.0
  - @google-labs/palm-kit@0.0.11
  - @google-labs/pinecone-kit@0.1.9

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
- 986af39: Update GraphProvider to support additional methods; land
  IDBGraphProvider
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
- 9a76a87: Various fixes to Editor API found while playing with the visual
  editor.
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
- 58b623b: Introduce `ask-user` board and adapt `agent` board to be useful with
  it.
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
