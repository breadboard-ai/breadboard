# Changelog

## 0.5.0

### Minor Changes

- 55a9647: Rename assertOutput to unsafeOutput
- 1adb24c: Replace multiline field with format, which can be multiline or javascript
- d9ac358: Convert secrets node to use @breadboard-ai/build. No functional difference, but the JSON schema should be slightly stricter.
- 1e86a87: Allow object types to have additional properties. Additional properties are now disabled by default.

### Patch Changes

- 3f9507d: The breadboard type expression object({}) is now more strictly constrained to plain objects (rather than anything).
- 1e86a87: Add enumeration type
- 3f9507d: Simpler JSON schema serialization for array
- 1adb24c: additionalProperties is now set on generated port JSON schemas
- 1e86a87: Add support for default values on static inputs
- fefd109: JSON schema for outputs no longer sets any required properties
- c1dcb0a: Make serialization order more similar to existing one
- 416aed2: Introduce `metadata` for `NodeHandler` entries, teaching node types in Kits to describe themselves.
- f1883d1: Add an output function for customizing a board's output node layout
- 1adb24c: Inbound edges, even if they don't have a value, now inform the auto generated input schema
- d8cb0c9: Add unsafeCast function as an escape hatch for when an output doesn't match a type but you're really really sure it's ok
- 34d9c6d: Generated JSON schemas are now more explicit and verbose
- e6e0168: Allow describe functions to be async
- 1adb24c: Fix some incorrect type errors from certain describe functions.
- 3f9507d: The describe function can now return objects with new descriptions
- 1adb24c: Automatically detected input ports are no longer required. Only static ones.
- 3f9507d: Add multiline option to port config
- c4ca6dc: Allow setting node IDs
- 1adb24c: Allow specifying behaviors
- cfbcdf2: Pass NodeHandlerContext to invoke functions
- 1d9cb16: Inputs can now have examples
- 49da151: Allow setting id on inputs, which can be used to customize the input node id,
  or to create multiple input nodes. If two input objects reference the same
  id, then they will both be placed into a BGL input node with that ID. If no
  id is specified, the usual "input-0" is used.
- 3f9507d: Simpler JSON schema serialization for anyOf
- dfd5ce2: Input ports can now be marked as optional.
- cfc0f15: Add support for input titles
- 00ccb9d: Add unsafeSchema function which allows returning raw arbitrary JSON schema from a describe function
- 08eabf4: Title, description, and version are now included in BGL
- 99fcffe: describe function now receives a NodeDescriberContext
- d9ac358: Add ability to override default port title
- Updated dependencies [cef20ca]
- Updated dependencies [fbf7a83]
- Updated dependencies [54baba8]
- Updated dependencies [49c3aa1]
- Updated dependencies [cdc23bb]
- Updated dependencies [416aed2]
- Updated dependencies [a1fcaea]
- Updated dependencies [c3ed6a7]
- Updated dependencies [3d48482]
- Updated dependencies [f2eda0b]
- Updated dependencies [626139b]
- Updated dependencies [bd44e29]
- Updated dependencies [43da00a]
- Updated dependencies [c3587e1]
- Updated dependencies [3f9507d]
  - @google-labs/breadboard@0.18.0

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
