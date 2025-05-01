# @google-labs/agent-kit

## 0.18.0

### Minor Changes

- 856c387: Introduce "Generate" step.
- e7abb8a: Add support for reactive ports.
- a2d4ee5: Introduce `hint-chat-mode` behavior.
- a53adf0: Add support for system instruction in "Generate Text"
- 10c7441: Introduce support for rich enum metadata.

### Patch Changes

- Updated dependencies [228d3c4]
- Updated dependencies [470e548]
- Updated dependencies [81d2666]
- Updated dependencies [26fdb89]
- Updated dependencies [8cffe63]
- Updated dependencies [7c6388f]
- Updated dependencies [34e24f0]
- Updated dependencies [da380d1]
- Updated dependencies [7b67a8c]
- Updated dependencies [27b9c34]
- Updated dependencies [9f87f37]
- Updated dependencies [eef58fa]
  - @breadboard-ai/types@0.7.0
  - @breadboard-ai/build@0.12.2

## 0.17.0

### Minor Changes

- 1abb0e3: Allow connecting {{ in }} parms with wires.

### Patch Changes

- Updated dependencies [4ed89ea]
- Updated dependencies [b852b6c]
- Updated dependencies [44fb75c]
- Updated dependencies [a09a9c3]
  - @breadboard-ai/types@0.6.0
  - @breadboard-ai/build@0.12.1

## 0.16.0

### Minor Changes

- 925e4bf: Introduce "main-port" behavior and start using it.
- 63a1930: Introduce presentation hints and icon on Schema.

### Patch Changes

- Updated dependencies [2144bc3]
- Updated dependencies [a2e7a36]
- Updated dependencies [782b7e4]
- Updated dependencies [eaef053]
- Updated dependencies [0b1dc88]
- Updated dependencies [63a1930]
- Updated dependencies [b93a70f]
- Updated dependencies [9ade1ed]
- Updated dependencies [12aea89]
- Updated dependencies [83a5186]
  - @breadboard-ai/types@0.5.0
  - @breadboard-ai/build@0.12.0

## 0.15.0

### Minor Changes

- e7d4316: Add "Prompt" to Model (aka "Task" in Specialist)
- 3915ad0: Update the list of available Gemini models.

### Patch Changes

- abf3ab7: Remove Task override in Model describer.
- 5269190: Remove mention of `legacyKit` in Agent Kit.
- 3536a91: Add `gemini-2.0-flash-thinking-exp` to the list of available models
- Updated dependencies [64bbe1b]
- Updated dependencies [4a898eb]
- Updated dependencies [7ea05ca]
- Updated dependencies [96b0597]
- Updated dependencies [df9b8b9]
- Updated dependencies [d73587b]
- Updated dependencies [a8eccc4]
  - @breadboard-ai/build@0.11.1
  - @breadboard-ai/types@0.4.0

## 0.14.0

### Minor Changes

- 32b50af: Expose side wires in `InspectableGraph`.
- 9d5f11b: Convert existing declarative kits to BGL.
- 2c7587a: Rename "Specialist" to "Model".

### Patch Changes

- 392b111: Ignore blank tools in Model (Specialist).
- Updated dependencies [ca466cd]
- Updated dependencies [18dace0]
- Updated dependencies [19fc2d0]
- Updated dependencies [c75e26f]
- Updated dependencies [9d5f11b]
  - @breadboard-ai/types@0.3.0
  - @breadboard-ai/build@0.11.0

## 0.13.0

### Minor Changes

- 83b735f: Introduce "Context To Slides" component.
- a133437: Implement "Role" configuration port for Content component.
- bf69ac9: Teach Specialist to be more robust with routes.
- 8f079a1: Teach Inspector API about modules

### Patch Changes

- @breadboard-ai/build@0.10.5

## 0.12.4

### Patch Changes

- Updated dependencies [b5981d0]
  - @breadboard-ai/build@0.10.4

## 0.12.3

### Patch Changes

- @breadboard-ai/build@0.10.3

## 0.12.2

### Patch Changes

- Updated dependencies [7921983]
  - @breadboard-ai/build@0.10.2

## 0.12.1

### Patch Changes

- 1e7fafd: Various bug fixes
- e3a469e: Use new build-code package to implement agent-kit substitute
  component
- Updated dependencies [690ebe6]
  - @breadboard-ai/build@0.10.1

## 0.12.0

### Minor Changes

- f61ccf3: Introduce URL-based component types.
- f0b5ccc: Delete tool-worker
- 8540b93: Convert Content to Build API and merge Specialist 2 to Specialist.
- 4c03455: Introduce Specialist 2 and make Content component support LLM
  Content.
- 84ca649: Introduce the "Content" component.
- 94759f7: Teach Specialist about routing.

### Patch Changes

- f94f498: Convert structured worker to build API
- 4e0a4f6: Convert looper to build API
- 58d2e8c: The joiner board has been converted to the new Build API. Should have
  no functional effect.
- 679719b: Convert specialist to build api
- 9b62fc2: Use new build API kit function
- e63b5dd: Polish Specialist and Content.
- 74d50d4: Convert repeater to Build API (should be a no-op).
- 9ce8ad3: Fix schemas of persona and task
- 7fdf9c2: Add "gemini-1.5-pro-exp-0827" to the choices in Gemini-calling
  components.
- e38bf19: Set titles for done and loop outputs of looper
- 100fc95: Various fixes and polish.
- e026112: Remind Specialist that it doesn't accept dynamic wires.
- 281ab28: Convert human to build API
- 5fc6e8b: Convert worker board to build API
- Updated dependencies [49e2740]
- Updated dependencies [54c8197]
- Updated dependencies [2f1b85c]
- Updated dependencies [c145fdd]
- Updated dependencies [226be62]
- Updated dependencies [2fa05f0]
- Updated dependencies [f71bcfb]
- Updated dependencies [3188607]
- Updated dependencies [8540b93]
- Updated dependencies [8330f0c]
- Updated dependencies [1423647]
- Updated dependencies [6cdf20c]
- Updated dependencies [f63a497]
- Updated dependencies [91fe8bb]
- Updated dependencies [100fc95]
- Updated dependencies [cab83ce]
- Updated dependencies [e19f046]
- Updated dependencies [5834c81]
- Updated dependencies [0ef793f]
  - @breadboard-ai/build@0.10.0

## 0.11.0

### Minor Changes

- c1dc2a4: Deprecate bubbling `model` inputs.
- 1a70e7d: Make Looper model switchable.

### Patch Changes

- 3b9229d: Teach Specialist to correctly label the tools array as config.
- Updated dependencies [bbcdd2d]
- Updated dependencies [9ed58cf]
- Updated dependencies [7f2ef33]
- Updated dependencies [bac2e35]
- Updated dependencies [ec2fedd]
  - @breadboard-ai/build@0.9.1

## 0.10.0

### Minor Changes

- 1a6a9cf: Teach Specialist to ask for a model.
- 78a6bcf: Remove example inputs from gemini-generator
- 494d5ca: Remove examples from Agent Kit components.

### Patch Changes

- b201e07: Implement edge-based UI in board-server (and fix a bunch of bugs
  elsewhere)
- e0dccfe: Add empty text default to Human input.
- Updated dependencies [cc5f4b6]
- Updated dependencies [a940b87]
- Updated dependencies [374ea85]
- Updated dependencies [f93ec06]
- Updated dependencies [398bf4f]
- Updated dependencies [7de241c]
  - @breadboard-ai/build@0.9.0

## 0.9.1

### Patch Changes

- c5c39be: Internal refactoring (type system)
- Updated dependencies [d88c37b]
  - @breadboard-ai/build@0.8.1

## 0.9.0

### Minor Changes

- 8d2e618: Teach Human to act as a start node.

### Patch Changes

- 8dbbe20: Internal refactoring
- a0852df: Update titles and help links in Core Kit.
- 9a2ffab: Unpin @breadboard-ai/build dependency from being overly constrained
- 1341291: Minor fixes to types and titles.
- Updated dependencies [ad8aa22]
- Updated dependencies [f78ec0a]
- Updated dependencies [2312443]
- Updated dependencies [b76f9a1]
- Updated dependencies [15ae381]
  - @breadboard-ai/build@0.8.0

## 0.8.1

### Patch Changes

- f4397b9: Update remaining breadboard-web paths

## 0.8.0

### Minor Changes

- bac5642: Teach Specialist a bit more about joining multiple tool contexts (the
  "single" mode).
- 16e50fb: Teach Joiner to merge contexts.
- f0b68d0: Teach Human about multimodal inputs.
- b44de19: Teach Specialist to receive LLM Content as tool output.
- 9226f7c: Introduce "Pick One" mode for Human.
- d131307: No longer require property to be named `context`.
- e0eac55: Only show choices when Human is in "choice" mode.
- b7dab90: Teach Specialist about parallel function calls.
- c52e81d: Skip over metadata when merging contexts.
- 4db3ab7: Teach Specialist to pass context to tools.
- 2ace620: Teach `InspectableGraph.describe` to correctly propagate
  fixed/flexible bit.

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
- 74434ea: Teach Looper that step-by-step jobs and until-done jobs are mutually
  exclusive.

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
