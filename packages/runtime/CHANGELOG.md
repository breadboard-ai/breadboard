# @breadboard-ai/runtime

## 0.2.0

### Minor Changes

- d0458a0: Teach runtime about stop actions.
- fbeaf8f: Introduce "Run from here" capability.
- 073a296: Plumb error handling to renderer and console for new runtime.
- f9a1143: Introduce error metadata to increase precision of error message.
- c52549b: Initial support for action buttons in Visual Editor
- 01cee42: Add step-by-step running mode in new runtime.
- e94bb52: Properly display status and react to actions.
- 54f46d8: Introduce "Code Execution" tool.
- 0bc8d11: Teach new runtime to respond to graph topology changes.

### Patch Changes

- 5143dad: Polish wiring states in the new runtime.
- ff1ce19: Show activity for edges and nodes.
- b06b895: Disallow 3P describer invocations.
- 32d90b3: Remove RunObsever machinery.
- Updated dependencies [f7a7772]
- Updated dependencies [f609a62]
- Updated dependencies [342dbb8]
- Updated dependencies [d0458a0]
- Updated dependencies [48eb9b0]
- Updated dependencies [4166203]
- Updated dependencies [fbeaf8f]
- Updated dependencies [b305c1b]
- Updated dependencies [5143dad]
- Updated dependencies [cc976c3]
- Updated dependencies [492e542]
- Updated dependencies [073a296]
- Updated dependencies [f9a1143]
- Updated dependencies [e99ede7]
- Updated dependencies [ff1ce19]
- Updated dependencies [5ba1719]
- Updated dependencies [4d8a6fa]
- Updated dependencies [426ffce]
- Updated dependencies [1d6cb7b]
- Updated dependencies [42d301f]
- Updated dependencies [2b801c3]
- Updated dependencies [c52549b]
- Updated dependencies [db11ca8]
- Updated dependencies [c0d18de]
- Updated dependencies [6d9a147]
- Updated dependencies [01cee42]
- Updated dependencies [f14f927]
- Updated dependencies [483ee70]
- Updated dependencies [3d6740f]
- Updated dependencies [e94bb52]
- Updated dependencies [a74c8cf]
- Updated dependencies [071b34d]
- Updated dependencies [5e95de6]
- Updated dependencies [54f46d8]
- Updated dependencies [0bc8d11]
- Updated dependencies [82ba7de]
- Updated dependencies [32d90b3]
- Updated dependencies [f09982c]
- Updated dependencies [bac03d4]
  - @breadboard-ai/types@0.9.0
  - @breadboard-ai/data@0.1.0
  - @breadboard-ai/utils@0.1.0
  - @breadboard-ai/loader@0.0.3

## 0.1.0

### Minor Changes

- a02142b: Add interactive mode to PlanRunner.
- f488e2b: Add runtime flags support and the first `usePlanRunner` flag.
- 8a3fb19: Start on the next-gen runtime for Breadboard
- 4115045: Introduce `PlanRunner`, a drop-in replacement for `LocalRunner`.

### Patch Changes

- fdc7b73: Introduce `@breadboard-ai/data` package and move data transformation
  bits to it.
- e28bf13: Account for all processing states when checking for doneness.
- a2483c3: Move Schema utilities to `utils` package.
- 66814df: Move remaining utils to `utils` packages and clean up.
- 22b02b8: Factor runtime bits out of `breadboard` package.
- 0df3f14: Introduce a more coherent node lifecycle.
- 6201f69: A bit more clean-up of the runtime legacy API endpoints.
- 97ea4dc: Make skip-propagation logic more robust.
- Updated dependencies [fdc7b73]
- Updated dependencies [f488e2b]
- Updated dependencies [8cdb091]
- Updated dependencies [a2483c3]
- Updated dependencies [66814df]
- Updated dependencies [22b02b8]
- Updated dependencies [bb833fa]
- Updated dependencies [6201f69]
- Updated dependencies [a7c691e]
- Updated dependencies [9923fe0]
  - @breadboard-ai/loader@0.0.2
  - @breadboard-ai/utils@0.0.2
  - @breadboard-ai/data@0.0.2
  - @breadboard-ai/types@0.8.0
