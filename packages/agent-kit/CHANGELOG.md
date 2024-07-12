# @google-labs/agent-kit

## 0.8.1

### Patch Changes

- f4397b9: Update remaining breadboard-web paths

## 0.8.0

### Minor Changes

- bac5642: Teach Specialist a bit more about joining multiple tool contexts (the "single" mode).
- 16e50fb: Teach Joiner to merge contexts.
- f0b68d0: Teach Human about multimodal inputs.
- b44de19: Teach Specialist to receive LLM Content as tool output.
- 9226f7c: Introduce "Pick One" mode for Human.
- d131307: No longer require property to be named `context`.
- e0eac55: Only show choices when Human is in "choice" mode.
- b7dab90: Teach Specialist about parallel function calls.
- c52e81d: Skip over metadata when merging contexts.
- 4db3ab7: Teach Specialist to pass context to tools.
- 2ace620: Teach `InspectableGraph.describe` to correctly propagate fixed/flexible bit.

### Patch Changes

- f62d4da: Account for `item` in the multiple function-calling results.
- 7840ff9: Don't delete `context` in function calling
- d9b76bd: Pass function args even if there's LLM Content.
- dfc6054: Teach Specialist about boards with no inputs.
- 9bbdfc7: Only add Looper task to the first Specialist after it.
- 5a55b7d: Only ask to choose when there are more than one choices.
- 14cf52b: Update helper text for Agent Kit nodes.
- 295b767: Teach Joiner to assign a role when merging.
- faca485: [Debugger] Fix store provider for nav
- 8e2c44d: Teach Specialist about multi-part functionCalls.

## 0.7.0

### Minor Changes

- c69f1c5: Teach Looper how to plan and add `responseMimeType` to Gemini API.
- a297d10: Implement "Done" condition support for Looper.
- 3f0ce31: Teach Human to display LLM Content.
- e68c06d: Add a Joiner utility node.
- 3397974: Add `InspectableNode.type()` and start using it.
- 09d8288: Teach Super Worker to use tools.
- 8170942: Teach Looper Node a bit more about planning.
- 7b18cb2: Rename `Super Worker` to `Specialist`.
- d66af7b: Deprecate the Tool Worker.

### Patch Changes

- f0409d1: Pass looper tasks to context in Specialist.
- 40ce086: Start passing tasks via metadata.
- 8838ba7: Clean up metadata after a looper run.
- d10f568: Various bug fixes to help looper and specialist work better.
- 74434ea: Teach Looper that step-by-step jobs and until-done jobs are mutually exclusive.

## 0.6.0

### Minor Changes

- 79909eb: Introduce SuperWorker.

### Patch Changes

- fb3f870: Fix a problem with incorrect context appending.
- f2eda0b: Fix lots of bugs around Tool Worker.
- 5d08172: Teach tool worker to properly accumulate context.

## 0.5.0

### Minor Changes

- 407b726: Switch Tool Worker to use proper board loading (using `curry`).

## 0.4.0

### Minor Changes

- 76da09d: Early support for voting (yes/no) in Human node.

### Patch Changes

- 8be93c8: Make Human more flexible in what kind of Context it accepts.

## 0.3.0

### Minor Changes

- f005b3b: Introduce `load` API for kits.
- ad5c1be: Introduce Tool Worker node in Agent Kit.
- ff4abd6: Teach Repeater to allow inner worker to exit early.

### Patch Changes

- 99446b8: Various quality improvements to schemas and Graph Inspector API.
- decfa29: Introduce `DebuggerGraphProvider`.
- 6e631c4: Load agent-kit via manifest dynamically.
- eabd97b: Introduce the concept of log levels in Run Inspector API.
- 8d9bba9: Add better metadata for Agent Kit.
- b1fc53b: Teach `breadboard debug` to load PaLM Kit dynamically.

## 0.2.0

### Minor Changes

- 73455ce: Implement "human" node in Agent Kit

## 0.1.0

### Minor Changes

- a9daeda: Introduce Repeater node in Agent Kit.
- a4146c4: Introduce "Agent Kit" to the Breadboard Kit family.
- 5221586: Add "Structured Worker" node to Agent Kit.
- c3966d3: Improve 'Worker' to take instructions and accept string as context.
- 0085ee2: Teach inspector API to correctly describe nodes.
- f06f400: Introduce Agent Kit.

### Patch Changes

- 0c2e494: Add 'Summarizer' board illustrating Agent Kit.
- b944657: Update existing boards to use Structured Worker.
- 56ccae5: Introduce a way to inspect kits.
- e9696df: Teach Agent Kit to describe its nodes automatically.
