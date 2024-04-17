# Changelog

## 0.4.0

### Minor Changes

- de524a4: Change the describe function to return only the names of ports instead of full JSON schema, and be stricter about when it is required/optional/forbidden based on the port configurations.

### Patch Changes

- de524a4: Improved type-safety and type descriptions relating to node definitions.
- de524a4: Add support for reflective nodes, where the inputs provided at instantiation automatically reflect to outputs.
- de524a4: Add `assertOutput` method, for getting an output port in cases where it is not possible at compile-time to know what output ports will exist.
- de524a4: Add support for polymorphic nodes with dynamic output ports.
- Updated dependencies [c3cb25f]
- Updated dependencies [ae79e4a]
- Updated dependencies [72c5c6b]
- Updated dependencies [dd810dd]
- Updated dependencies [c5ba396]
- Updated dependencies [7bafa40]
- Updated dependencies [2932f4b]
- Updated dependencies [51159c4]
- Updated dependencies [6f9ba52]
  - @google-labs/breadboard@0.17.0

## 0.3.1

### Patch Changes

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
  - @google-labs/breadboard@0.16.0

## 0.3.0

### Minor Changes

- 4de92a3: Add placeholder() function, useful for representing cycles.

### Patch Changes

- Updated dependencies [76da09d]
- Updated dependencies [938015d]
  - @google-labs/breadboard@0.15.0

## 0.2.0

### Minor Changes

- 7949ec9: Make "name" required when defining nodes, so that they can always be serialized
- da2e263: Add new board function for creating boards, and serialize for making BGL from them

### Patch Changes

- 949bce7: Add a Value type which can represent a value or a stand-in for a value (output port, input object, etc.)
- Updated dependencies [e8d0737]
  - @google-labs/breadboard@0.14.0

## 0.1.2

### Patch Changes

- Updated dependencies [faf1e12]
- Updated dependencies [51a38c0]
- Updated dependencies [d49b80e]
- Updated dependencies [9326bd7]
- Updated dependencies [fbad949]
  - @google-labs/breadboard@0.13.0

## 0.1.1

### Patch Changes

- fe6b8de: Fix missing build artifacts

## 0.1.0

### Minor Changes

- 6a0bbbf: Initial release of @breadboard-ai/build

## 0.0.1

### Patch Changes

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
