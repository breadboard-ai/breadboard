# @breadboard-ai/runtime

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
