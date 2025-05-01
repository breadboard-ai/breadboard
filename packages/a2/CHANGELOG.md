# @breadboard-ai/a2

## 0.4.0

### Minor Changes

- 228d3c4: Start showing parameters in various UI surfaces.
- 470e548: Start landing connector infrastructure.
- 81d2666: Land early (mostly stubs) listification bits.
- ac39a64: Make "chat mode" work with and without tools.
- 26fdb89: Add support for tools in connectors.
- 8537c16: Teach "Ask User" to display multi-modal content rather than just
  text.
- 013d624: Make "Generate Text" work across lists/chat/tool modes.
- e76a576: Save TypeScript sources of modules as separate files.
- 394daae: Improve summarizer/organizer for GOAL.
- 9d75ab2: [a2] Switch tools to use the new backend API.
- 01eb8d8: Teach GOAL to think in lists
- e21ee39: Implement autonaming behind flag.
- 8abad23: Move System Instruction out of experimental.
- 0810b47: Teach connectors to be editable with `bb-entity-editor`.
- b393b0d: Introduce the NotebookLM connector.
- fedacbd: Expose `/env/settings/general` to module file system and use it to
  hide experimental bits.
- 856c387: Introduce "Generate" step.
- 2484861: Add support for connector previews.
- e7abb8a: Add support for reactive ports.
- a63fb1e: Switch Gemini API calls to use OAuth in A2.
- af10dc4: Introduce parameters infrastructure.
- a2d4ee5: Introduce `hint-chat-mode` behavior.
- 9a078bd: Teach various steps about lists.
- 3dab17c: Introduce Google Drive connector (WIP)
- 8cffe63: More progress on listification.
- 11a6c4a: Switch to use opaque `generation-mode` in Generate step.
- e1a1696: Disallow nested lists for now.
- f337039: Update Generation Mode titles to match the underlying models.
- fd23454: Introduce embedded board server and use it for A2 server.
- 7e17fe2: Teach Gemini API to flatten list if it seem them, and add tests.
- c4d29c0: Teach listification to "Make Text" and GOAL.
- 2c27b5f: Update generate step to have Juno and Gemini Image out
- 4f0b23e: Various improvements to "Think as I go" strategy.
- 0c6ad80: Plumb Graph metadata as `/env/metadata` and teach "Render Outputs" to
  use it to pick theme colors.
- 3128d36: Rename "Render Outputs" to "Display" and update icons.
- a53adf0: Add support for system instruction in "Generate Text"
- bea10c4: Add an example with multiple steps.
- 763063b: Implement instance-aware saving and slides/sheets load support for
  Google Drive connector.
- 34e24f0: Implement MCP connector.
- 99a5d95: Teach fetch to handle streams and files.
- e307f33: Clean up sideboards and switch Autoname to use embedded A2.
- 06aafd9: Switch theme creator sideboard to use embedded A2.
- eba969c: Teach parameters to work in subgraphs.
- 8ce093a: Add "Create New Document" to Google Drive file picker and many other
  fixes.
- ff4864a: Teach Drive Connector to use Drive Picker.
- e0aefd1: Add a workbench to exercise GOAL and memory.
- da380d1: Teach params about modalities and sample values.
- f7bb416: Add support for images when saving to Google Drive.
- fea9351: Remove circular dependency.
- 10c7441: Introduce support for rich enum metadata.
- a6a0533: Start using the new "Generate Text".
- 99dd67b: Further separate Imagent and Gemini Image steps
- c8876ee: Polish parameters a bit.
- 9f87f37: First complete rev of Connector machinery.
- 8feb690: Bring "chat with user" back.
- 6c846f0: Remove "Self-critique" option for now (it didn't do anything anyway)
- 1838960: Add a new (not yet used) Generate Text backing node (will replace
  "text" in Generate step)
- 62d04cd: Remap "Generate" icons at source level

### Patch Changes

- c61a5d3: Teach "generate" to actually be at-wireable and connectable.
- 3823d5e: Bring back tools
- 30578bc: Use fewer words in "Ask user"
- 3de4459: Various "Chat with user" fixes.
- 53f53b0: Various fixes to "Ask User" and "Change Edge".
- 49ac76c: Teach "Ask User" to be at-wireable.
- f11621f: Add `asType` flag for describers.
- 01d42eb: Adjust tool URLs in push.
- 398ac99: Ensure absolute blob paths are converted to FileData in Gemini API
- 42f34b8: Align A2 configurations
- 63ab291: Add a README
- c575292: Add module-making experiment
- 913bc45: Minor logging, documentation, and error handling cleanups
- dce4fe8: Update port forwarding mapping to account for "image-gen".
- 4e4efc6: Handle empty executionOutputs
- a8fafd0: Styling tweaks for Activity panel.
- 08972a2: Remove old code in generate text.
- b39bc95: Filter out non-A2 connectors and remove "experimental" flag from
  "Generate"
- 669b6f6: Fix the issue where the chat exits early.
- 0996277: Teach StructuredResponse about more than 3 parts.
- 053ccbd: Unbreak "Make Text" when used with tools.
- ec25bbe: Clear pending result in LocalRunner after resuming
- ee084e8: A bunch of fixs to bring app view back up again.
- 06f21e1: Update node selection shelf
- dc544cc: Update tools to work with the newly added `asType` argument.
- f11621f: Update the order of portt maps to match the list of options.
- Updated dependencies [470e548]
- Updated dependencies [81d2666]
- Updated dependencies [26fdb89]
- Updated dependencies [9d75ab2]
- Updated dependencies [e21ee39]
- Updated dependencies [66a01e0]
- Updated dependencies [fedacbd]
- Updated dependencies [856c387]
- Updated dependencies [0c0a419]
- Updated dependencies [e7abb8a]
- Updated dependencies [f11621f]
- Updated dependencies [a63fb1e]
- Updated dependencies [af10dc4]
- Updated dependencies [a2d4ee5]
- Updated dependencies [97be783]
- Updated dependencies [2eee8da]
- Updated dependencies [a564054]
- Updated dependencies [fd23454]
- Updated dependencies [9203afc]
- Updated dependencies [7e17fe2]
- Updated dependencies [0e6f849]
- Updated dependencies [2074b64]
- Updated dependencies [0c6ad80]
- Updated dependencies [a53adf0]
- Updated dependencies [da0a7a2]
- Updated dependencies [410bc4e]
- Updated dependencies [34e24f0]
- Updated dependencies [ae68b4d]
- Updated dependencies [99a5d95]
- Updated dependencies [eba969c]
- Updated dependencies [b9681e9]
- Updated dependencies [8ce093a]
- Updated dependencies [da380d1]
- Updated dependencies [7b67a8c]
- Updated dependencies [f7bb416]
- Updated dependencies [0d0953e]
- Updated dependencies [10c7441]
- Updated dependencies [ec25bbe]
- Updated dependencies [c8876ee]
- Updated dependencies [9f87f37]
- Updated dependencies [e58b680]
- Updated dependencies [eef58fa]
  - @google-labs/breadboard@0.34.0
  - @breadboard-ai/embedded-board-server@0.1.0

## 0.3.0

### Minor Changes

- f466c2d: Add "custom tool" infrastructure (based on subgraphs)
- 0728238: Mark "@" references as invalid when a connecting edge is removed.
- 51801a6: Make "@" references more or less reactive to changes to their
  sources.
- 9e55e20: Add "Thinking" strategy to A2 GOAL.
- 3c91797: Teach "Do Deep Research" about assets.
- b872936: Bug fixes plus teach "Make Image" and "Make Audio" to introduce
  themselves.
- e8abf9f: Switch "Do deep research" to use A2 tools and to use default
  configuraiton.
- 4d86a09: Teach GOAL about multiple tools, structured response, and sequential
  strategy.
- a09a9c3: Introduce "Go over a list" step in A2.
- 1abb0e3: Allow connecting {{ in }} parms with wires.
- f047b77: Teach A2 about introductions and custom tools.

### Patch Changes

- c97b5a2: Use node id for autowire ports instead of title to make them unique.
- e16bdc1: Show any A2 BGLs whose title starts with "A2" to show up in step
  selector

## 0.2.0

### Minor Changes

- 56b58cf: Teach Assets to behave like LLMContent.
- cc4b76d: Port remaining tools to A2.
- 5ecebfc: Add support for "Instruction" config port for Image Generator.
- 69d315b: Implement "Search Web" tool
- 925e4bf: Introduce "main-port" behavior and start using it.
- 9ffe9ee: Make autowire work with "Make Text" and "Make I mage"
- fcc05e1: Implement "Researcher" component.
- a2e7a36: Add support for {{asset}} and {{in}} params in A2.
- 06bf630: Teach A2 to about {{tool}} params.
- 6b6052c: Support icons in custom component metadata.
- 65f89e0: Introduce Organizer to visual editor.
- 750499a: Stub out A2 tools
- 90db217: Update model list and make `gemini-2.0-flash` the new default model.
- 948b50c: Introduce Combine Outputs component.
- 0b1dc88: Introduce `GraphDescriptor.imports` and start using it in modules.
- e39ea7e: Add "Text" component.
- b18aa5e: Add "Researcher", "Image Generator" and other changes.
- 2b1fc4d: Teach "Make Image" to be more resilient and graceful. Add dynamic
  hints to "Ask User"
- 44d6e2e: Polish "Combine Outputs".
- 5edbb3f: Teach "Make Text" and "Make Image" about assets.
- c9fc7b0: Add "Audio Generator" and {{param}} support to all components.
- 74124b8: Use "generative" icon in A2 components.
- 6093cfc: Implement "Search Wikipedia" tool.
- 63a1930: Introduce presentation hints and icon on Schema.
- b93a70f: Introduce a more flexible way to tag and curate components.
- 26b1194: Implement Get Weather tool.
- 0b1e733: Make "Chat with user" work.
- f2d0061: Introduce Tools input for Researcher.
- 12aea89: CAtch up to the latest Gemini LLMContent types.
- dd0015e: Teach Visual Editor about the full power of the "@" symbol.
- 8e2fc1f: Implement API that allows rendering Fast Access menu (fka "@" menu).

### Patch Changes

- b3a39ad: Implement and refine "Ask User" component.
- 2144bc3: Teach Edit API about editing assets.
- 3af8f62: Introduce ChatController, an abstraction to manage chat state.
- 220f27a: A2-related UI polish
- 724069f: One more round of polish for A2.
- 95a8265: Add presentation hints for outputs
- 1fd4aaa: Another round of polish for A2.
- 5e1e24c: Colorize nodes
- 9fe7195: Plumb input format to schema from "Ask User".
- be771bf: Prototype "Make Code"
- f0c78ab: Account for non-text inputs when checking whether to continue.
- b17362c: Bug fixes in ChatController.
- 7c64db3: Hard-code the header input port as "context" for now.
- 3460bf4: Update some icons

## 0.1.0

### Minor Changes

- 183c9eb: Start moving A2 to multi-export setup.
- e89cfa9: Add workbench BGL and better error handling.
- a69302b: Create a place for the A2 framework
