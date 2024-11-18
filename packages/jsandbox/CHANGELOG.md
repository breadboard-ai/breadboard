# @breadboard-ai/jsandbox

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

- 49c7cb7: Add support for peer imports and custom describers (latter not yet plumbed through)
- 2e7d66f: Add `secrets` to capabilities.
- df7ad14: Implement support for custom describers in runModule.
- 526f310: Teach JSandbox to handle errors and load "breadboard:capabilities" import
- 387447c: Add support for async capabilities.
- 38defd8: Make `jsandbox` a real package.
- 37dd928: Add support for `invoke` capability.

### Patch Changes

- 4e7c3fe: Add console plugin tests.
- afd0d4d: Handle unknown capabilities.
