# @google-labs/breadboard-cli

## 0.8.2

### Patch Changes

- Updated dependencies [0068682]
- Updated dependencies [ad9c233]
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
  - @google-labs/breadboard-web@1.6.0
  - @google-labs/breadboard@0.16.0
  - @google-labs/core-kit@0.6.0
  - @breadboard-ai/build@0.3.1
  - @google-labs/template-kit@0.2.5

## 0.8.1

### Patch Changes

- Updated dependencies [76da09d]
- Updated dependencies [938015d]
- Updated dependencies [182a546]
- Updated dependencies [4de92a3]
  - @google-labs/breadboard-web@1.5.1
  - @google-labs/breadboard@0.15.0
  - @google-labs/core-kit@0.5.3
  - @breadboard-ai/build@0.3.0
  - @google-labs/template-kit@0.2.4

## 0.8.0

### Minor Changes

- 261db21: Add CLI support for @breadboard-ai/build boards

### Patch Changes

- Updated dependencies [7949ec9]
- Updated dependencies [949bce7]
- Updated dependencies [e8d0737]
- Updated dependencies [da2e263]
- Updated dependencies [da2e263]
  - @breadboard-ai/build@0.2.0
  - @google-labs/breadboard@0.14.0
  - @google-labs/breadboard-web@1.5.0
  - @google-labs/core-kit@0.5.2
  - @google-labs/template-kit@0.2.3

## 0.7.1

### Patch Changes

- bdf14e1: Don't crash on TS errors in hot reload.

## 0.7.0

### Minor Changes

- 6d3c77c: Implement soft-reload

### Patch Changes

- edcf822: Avoid hard-coding `localhost` into a kit URL.
- Updated dependencies [05e74c9]
- Updated dependencies [faf1e12]
- Updated dependencies [51a38c0]
- Updated dependencies [8363d27]
- Updated dependencies [644c1ee]
- Updated dependencies [66128fa]
- Updated dependencies [d49b80e]
- Updated dependencies [9326bd7]
- Updated dependencies [5cd01a2]
- Updated dependencies [60f1754]
- Updated dependencies [fbad949]
  - @google-labs/breadboard-web@1.4.0
  - @google-labs/breadboard@0.13.0
  - @google-labs/core-kit@0.5.1
  - @google-labs/template-kit@0.2.2

## 0.6.0

### Minor Changes

- c3303a6: Adds --kit to `breadboard debug`
- b3beb36: Support loading kits via URL (both heavy and light kits)
- 3c497b0: Use esbuild.build to compile the boards. This enables importing modules.
- a8fc3f3: Teach `GraphProvider` to watch for file change notifications.

### Patch Changes

- decfa29: Introduce `DebuggerGraphProvider`.
- 6e631c4: Load agent-kit via manifest dynamically.
- c4f887b: Use simpler URLs in debugger.
- 2e3f0dc: Mark Node-specific packages as external
- 7ad0e2d: Updating `breadboard import` to use TypeScript and not board syntax. It changes the way boards work and can be called (no longer uses args)
- 1bbd16a: Start loading all heavy kits dynamically.
- b1fc53b: Teach `breadboard debug` to load PaLM Kit dynamically.
- Updated dependencies [f73c637]
- Updated dependencies [99446b8]
- Updated dependencies [866fc36]
- Updated dependencies [88b0f3a]
- Updated dependencies [a8bab08]
- Updated dependencies [a9e1849]
- Updated dependencies [699723b]
- Updated dependencies [decfa29]
- Updated dependencies [c3303a6]
- Updated dependencies [f005b3b]
- Updated dependencies [1f01afc]
- Updated dependencies [49c25aa]
- Updated dependencies [564f60c]
- Updated dependencies [6e631c4]
- Updated dependencies [c0d87f4]
- Updated dependencies [dcfdc37]
- Updated dependencies [d971aad]
- Updated dependencies [048e8ec]
- Updated dependencies [6143c58]
- Updated dependencies [dc35601]
- Updated dependencies [9cda2ff]
- Updated dependencies [60bd63c]
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
- Updated dependencies [ff4abd6]
- Updated dependencies [3e8cfcf]
- Updated dependencies [986af39]
- Updated dependencies [10f5110]
- Updated dependencies [3c497b0]
- Updated dependencies [3d536b6]
- Updated dependencies [eabd97b]
- Updated dependencies [14d5220]
- Updated dependencies [0bdff0b]
- Updated dependencies [6b5e96e]
- Updated dependencies [2008f69]
- Updated dependencies [1bbd16a]
- Updated dependencies [88372d9]
- Updated dependencies [c0f785a]
- Updated dependencies [a8fc3f3]
- Updated dependencies [32cfbaf]
- Updated dependencies [8dc4e00]
- Updated dependencies [6438930]
- Updated dependencies [5118c60]
- Updated dependencies [53df4e9]
- Updated dependencies [dd2cce6]
- Updated dependencies [cac4f4f]
- Updated dependencies [b1fc53b]
- Updated dependencies [ef05634]
- Updated dependencies [9f343a6]
- Updated dependencies [c208cfc]
  - @google-labs/core-kit@0.5.0
  - @google-labs/breadboard-web@1.3.0
  - @google-labs/breadboard@0.12.0
  - @google-labs/template-kit@0.2.1

## 0.5.2

### Patch Changes

- ff274a2: remove bundleDependencies

## 0.5.1

### Patch Changes

- Updated dependencies [07e66bf]
- Updated dependencies [26367fe]
  - @google-labs/breadboard@0.11.2
  - @google-labs/core-kit@0.4.0
  - @google-labs/breadboard-web@1.2.2

## 0.5.0

### Minor Changes

- f6e9b2c: Teach the Breadboard CLI how to use proxies

### Patch Changes

- 18a8089: Improves debug and make commands and how files are output
- f06f400: Remove temporary files created by TypeScript loader.
- Updated dependencies [c19513e]
- Updated dependencies [cd4f6e2]
- Updated dependencies [a9daeda]
- Updated dependencies [a4146c4]
- Updated dependencies [5221586]
- Updated dependencies [2237a4c]
- Updated dependencies [5cf1555]
- Updated dependencies [e6ed591]
- Updated dependencies [bd68ebd]
- Updated dependencies [9a76a87]
- Updated dependencies [0c2e494]
- Updated dependencies [ea652f3]
- Updated dependencies [56954c1]
- Updated dependencies [b944657]
- Updated dependencies [d378070]
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
- Updated dependencies [a4029de]
- Updated dependencies [53406ad]
- Updated dependencies [4c5b853]
- Updated dependencies [c3966d3]
- Updated dependencies [3f3f090]
- Updated dependencies [d7a7903]
- Updated dependencies [4401a98]
- Updated dependencies [f6e9b2c]
  - @google-labs/breadboard@0.11.0
  - @google-labs/breadboard-web@1.2.0
  - @google-labs/core-kit@0.3.0
  - @google-labs/template-kit@0.2.0

## 0.4.1

### Patch Changes

- 45654e1: update dependencies for running in a clean environment
- Updated dependencies [7dbc32e]
  - @google-labs/breadboard-web@1.1.1

## 0.4.0

### Minor Changes

- 9b55885: Fixing hosting directories in `breadboard debug`

### Patch Changes

- 7f9485b: Reenable cleanUrls for root
- d24932d: Catch compile/load errors to keep `breadboard debug` running.
- Updated dependencies [1b3f266]
- Updated dependencies [9bcd607]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard-web@1.0.4
  - @google-labs/breadboard@0.10.0
  - @google-labs/core-kit@0.2.1
  - @google-labs/template-kit@0.1.3

## 0.3.2

### Patch Changes

- d0b9b19: Fix a bug with file paths across Node releases.

## 0.3.1

### Patch Changes

- 3e9735e: Fix path resolution and stop serializing board URLs.

## 0.3.0

### Minor Changes

- d1f5299: Updating the import board

### Patch Changes

- b997fe4: Fix errors releating to missing dist/debugger files

## 0.2.1

### Patch Changes

- 1779e50: Add missing `vite` dependency.
- Updated dependencies [bbbd9f4]
  - @google-labs/breadboard-web@1.0.3

## 0.2.0

### Minor Changes

- 8eccdad: [breadboard-cli] Improvements to OpenAPI import to handle parameters as dynamic inputs and input config files

### Patch Changes

- 42a2b38: Updating the import board to dynamically resolve inputs for an API defined via OpenAPI
- Updated dependencies [67073c8]
- Updated dependencies [8eccdad]
- Updated dependencies [6e8c08d]
- Updated dependencies [3ab5892]
- Updated dependencies [780909c]
- Updated dependencies [bba68fd]
- Updated dependencies [6222fb3]
- Updated dependencies [58b623b]
- Updated dependencies [c89b67a]
- Updated dependencies [c71339f]
- Updated dependencies [b557794]
- Updated dependencies [a9206fc]
- Updated dependencies [605cff3]
- Updated dependencies [3356d08]
- Updated dependencies [931a95b]
- Updated dependencies [c89b67a]
  - @google-labs/breadboard-web@1.0.0
  - @google-labs/breadboard@0.9.0
  - @google-labs/core-kit@0.2.0
  - @google-labs/template-kit@0.1.2

## 0.1.1

### Patch Changes

- Updated dependencies [af00e58]
  - @google-labs/breadboard@0.8.0
  - @google-labs/breadboard-web@0.0.2
  - @google-labs/core-kit@0.1.3
  - @google-labs/template-kit@0.1.1
