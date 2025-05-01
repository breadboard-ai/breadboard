# @breadboard-ai/jsandbox

## 0.6.0

### Minor Changes

- 470e548: Start landing connector infrastructure.
- 81d2666: Land early (mostly stubs) listification bits.
- 856c387: Introduce "Generate" step.
- e7abb8a: Add support for reactive ports.
- f11621f: Add `asType` flag for describers.
- a2d4ee5: Introduce `hint-chat-mode` behavior.
- 8cffe63: More progress on listification.
- a53adf0: Add support for system instruction in "Generate Text"
- 99a5d95: Teach fetch to handle streams and files.
- f7bb416: Add support for images when saving to Google Drive.
- 10c7441: Introduce support for rich enum metadata.

### Patch Changes

- 0e6f849: Add a bit more robust error handling around capabilities.

## 0.5.0

### Minor Changes

- e018c92: Plumb atob/btoa to sandbox.
- a09a9c3: Introduce "Go over a list" step in A2.
- 1abb0e3: Allow connecting {{ in }} parms with wires.

## 0.4.0

### Minor Changes

- 69d315b: Implement "Search Web" tool
- 925e4bf: Introduce "main-port" behavior and start using it.
- a2e7a36: Add support for {{asset}} and {{in}} params in A2.
- 63a1930: Introduce presentation hints and icon on Schema.
- b93a70f: Introduce a more flexible way to tag and curate components.
- 12aea89: CAtch up to the latest Gemini LLMContent types.

### Patch Changes

- 9fe7195: Plumb input format to schema from "Ask User".
- 83a5186: Fix a typo.

## 0.3.0

### Minor Changes

- 37e3fbd: Connect file system to Visual Editor.
- 2a6d643: Introduce `output` capability.
- 07b5676: Add support for `@describe` capability.

### Patch Changes

- 7ea05ca: Remove the use of `inspect` inside `packages/breadboard`.
- cae3a3f: A plethora of bug fixes and polish
- a717ddc: Fix various bugs with describer capability
- 032d962: Fix the replay and runModule telemetry bugs.
- 96b0597: Introduce `GraphStore`: a top-level holder of all boards.
- d73587b: Type declaration tweaks and better error unwrapping.

## 0.2.0

### Minor Changes

- 1131130: Scope capabilities to one invocation.
- ca466cd: Plumb probe events (node/graph start/end) for runModule.
- c75e26f: Introduce Imperative Graphs.
- 856e249: Add some infrastructure for types to JSandbox.
- 1f1f7bc: Provide much nicer error messages.

### Patch Changes

- 9250262: Various fixes in module editing.
- 97b85d4: A few more fixes while working with imperative modules.
- 669694a: Add `sandbox.wasm` to the list published files.
- 74aa9b7: Teach jsandbox about LLMContent
- db52fbc: Pass module spec at invoke/describe time.
- d42ab17: Teach Board Server about sandboxed runModule.

## 0.1.0

### Minor Changes

- 49c7cb7: Add support for peer imports and custom describers (latter not yet
  plumbed through)
- 2e7d66f: Add `secrets` to capabilities.
- df7ad14: Implement support for custom describers in runModule.
- 526f310: Teach JSandbox to handle errors and load "breadboard:capabilities"
  import
- 387447c: Add support for async capabilities.
- 38defd8: Make `jsandbox` a real package.
- 37dd928: Add support for `invoke` capability.

### Patch Changes

- 4e7c3fe: Add console plugin tests.
- afd0d4d: Handle unknown capabilities.
