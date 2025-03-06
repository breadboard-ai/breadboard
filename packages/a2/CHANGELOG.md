# @breadboard-ai/a2

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
