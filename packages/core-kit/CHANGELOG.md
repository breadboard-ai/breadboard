# Changelog

## 0.5.1

### Patch Changes

- faf1e12: Teach invoke to be more accepting of uncertainty.
- Updated dependencies [faf1e12]
- Updated dependencies [51a38c0]
- Updated dependencies [d49b80e]
- Updated dependencies [9326bd7]
- Updated dependencies [fbad949]
  - @google-labs/breadboard@0.13.0

## 0.5.0

### Minor Changes

- 866fc36: Refactor `BoardLoader` to be a `GraphLoader` implementation.

### Patch Changes

- f73c637: Teach the `secrets` node to be more resilient with inputs.
- 99446b8: Various quality improvements to schemas and Graph Inspector API.
- 49c25aa: Add describers for a few nodes.
- ad5c1be: Introduce Tool Worker node in Agent Kit.
- bac9bb1: Bring loader machinery closer to cacheable load state.
- Updated dependencies [99446b8]
- Updated dependencies [866fc36]
- Updated dependencies [a8bab08]
- Updated dependencies [decfa29]
- Updated dependencies [f005b3b]
- Updated dependencies [dcfdc37]
- Updated dependencies [d971aad]
- Updated dependencies [048e8ec]
- Updated dependencies [dc35601]
- Updated dependencies [9cda2ff]
- Updated dependencies [60bd63c]
- Updated dependencies [764ccda]
- Updated dependencies [04d5420]
- Updated dependencies [56b90a4]
- Updated dependencies [1b48826]
- Updated dependencies [e648f64]
- Updated dependencies [ad5c1be]
- Updated dependencies [4a4a1f6]
- Updated dependencies [bac9bb1]
- Updated dependencies [3e8cfcf]
- Updated dependencies [986af39]
- Updated dependencies [3c497b0]
- Updated dependencies [eabd97b]
- Updated dependencies [2008f69]
- Updated dependencies [c0f785a]
- Updated dependencies [a8fc3f3]
- Updated dependencies [32cfbaf]
- Updated dependencies [8dc4e00]
- Updated dependencies [6438930]
- Updated dependencies [dd2cce6]
- Updated dependencies [cac4f4f]
- Updated dependencies [b1fc53b]
- Updated dependencies [ef05634]
- Updated dependencies [c208cfc]
  - @google-labs/breadboard@0.12.0

## 0.4.0

### Minor Changes

- 26367fe: Fixing typo in describe that would mean passthrough and reflect would not tell the system of their inputs

### Patch Changes

- Updated dependencies [07e66bf]
  - @google-labs/breadboard@0.11.2

## 0.3.1

### Patch Changes

- 3ed66b9: Add a resolve node to core-kit which resolves relative URLs to absolute URLs.
- Updated dependencies [05136f8]
- Updated dependencies [ef305d1]
- Updated dependencies [aea9178]
- Updated dependencies [20a0e5c]
  - @google-labs/breadboard@0.11.1

## 0.3.0

### Minor Changes

- 4c5b853: Implement output bubbling.
- 3f3f090: Teach `jsonata` and `invoke` nodes to better describe themselves.

### Patch Changes

- a9daeda: Introduce Repeater node in Agent Kit.
- 4920d90: Taught `core.invoke` to describe its own subgraphs.
- Updated dependencies [c19513e]
- Updated dependencies [2237a4c]
- Updated dependencies [bd68ebd]
- Updated dependencies [9a76a87]
- Updated dependencies [ea652f3]
- Updated dependencies [56954c1]
- Updated dependencies [0085ee2]
- Updated dependencies [0ef9ec5]
- Updated dependencies [ee00249]
- Updated dependencies [c13513f]
- Updated dependencies [56ccae5]
- Updated dependencies [4920d90]
- Updated dependencies [10a8129]
- Updated dependencies [c804ccc]
- Updated dependencies [5a65297]
- Updated dependencies [53406ad]
- Updated dependencies [4c5b853]
- Updated dependencies [3f3f090]
- Updated dependencies [d7a7903]
- Updated dependencies [4401a98]
- Updated dependencies [f6e9b2c]
  - @google-labs/breadboard@0.11.0

## 0.2.2

### Patch Changes

- 3e56a4f: Added a few TSDoc comments to kits for Intellisense.
- Updated dependencies [fb1c768]
  - @google-labs/breadboard@0.10.1

## 0.2.1

### Patch Changes

- Updated dependencies [9bcd607]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard@0.10.0

## 0.2.0

### Minor Changes

- c89b67a: Introduce the `reduce` node.

### Patch Changes

- 931a95b: Introduce richer error reporting to the harness.
- Updated dependencies [8eccdad]
- Updated dependencies [6e8c08d]
- Updated dependencies [780909c]
- Updated dependencies [bba68fd]
- Updated dependencies [b557794]
- Updated dependencies [a9206fc]
- Updated dependencies [931a95b]
  - @google-labs/breadboard@0.9.0

## 0.1.3

### Patch Changes

- Updated dependencies [af00e58]
  - @google-labs/breadboard@0.8.0

## [0.1.2] - 2024-01-14

- Update build. Oops.

## [0.1.1] - 2024-01-14

- Update dependencies.

## [0.1.0] - 2023-12-06

- Bump dependencies.
- The `append` node now supports flattening and properly appends to arrays.

## [0.0.1] - 2023-11-08

- First release. Contains the following nodes:
  - Moved from Breadboard: `passthrough`, `reflect`, `slot`, `include`, `import`, and `invoke`
  - Graduated from Node Nursery: `batch`, `map`
