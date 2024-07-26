# Changelog

## 0.8.0

### Minor Changes

- 2312443: Add support for `deprecated` and `experimental` tags on Kits.

### Patch Changes

- ad8aa22: Add kit function to build for making kits
- f78ec0a: Add intersect function to breadboard type expressions system for intersecting two objects
- b76f9a1: Add id, metadata, and breadboardType to component definition classes
- 15ae381: Fix optional output serialization
- Updated dependencies [1e1be2a]
- Updated dependencies [2b094a3]
- Updated dependencies [fa93c3f]
- Updated dependencies [215bd15]
- Updated dependencies [2b9ef5b]
- Updated dependencies [a0852df]
- Updated dependencies [2312443]
- Updated dependencies [6ffa89c]
  - @google-labs/breadboard@0.23.0

## 0.7.1

### Patch Changes

- da43bb5: Allow wiring inputs directly to outputs
- 5cf08f1: Add "wires" property to NodeDescriberContext which exposes a describe() function for getting the actual schema of a connected port if needed.
- 9d93cf8: Fix bug relating to directly returning JSON Schema from describe function instead of wrapping with unsafeSchema.
- 26e1099: Add describe function to Board component class
- Updated dependencies [a925cf0]
- Updated dependencies [5cf08f1]
- Updated dependencies [ffbf163]
- Updated dependencies [8928fb7]
- Updated dependencies [d6706f2]
- Updated dependencies [5447426]
- Updated dependencies [7e1f01c]
  - @google-labs/breadboard@0.22.0

## 0.7.0

### Minor Changes

- 14853d5: Add Gemini Nano node.
- 6ada218: Input ports with the "board" behavior can now receive board objects declared using the build API. This will be serialized as an embedded graph.
- 2ace620: Teach `InspectableGraph.describe` to correctly propagate fixed/flexible bit.

### Patch Changes

- 00825d5: Can now pass metadata to board function
- c5f8e4f: Teach BreadboardError about BreadboardCapability.
- 06c3f57: Add optionalEdge function which marks an edge optional.
- Updated dependencies [5a55b7d]
- Updated dependencies [74ade20]
- Updated dependencies [59dd0f5]
- Updated dependencies [417323c]
- Updated dependencies [b3aa884]
- Updated dependencies [3d7b4a7]
- Updated dependencies [7af14cf]
- Updated dependencies [fea8967]
- Updated dependencies [778f7aa]
- Updated dependencies [808f5e2]
- Updated dependencies [e0fdbc3]
- Updated dependencies [54b03b9]
- Updated dependencies [810d7fd]
- Updated dependencies [14853d5]
- Updated dependencies [8798514]
- Updated dependencies [eb64b9a]
- Updated dependencies [32a48a3]
- Updated dependencies [cd73b17]
- Updated dependencies [81d82fe]
- Updated dependencies [2a7531b]
- Updated dependencies [7c1b4cb]
- Updated dependencies [702cfe1]
- Updated dependencies [bebd96e]
- Updated dependencies [91cb723]
- Updated dependencies [3e10f0f]
- Updated dependencies [c53ca01]
- Updated dependencies [4c681cb]
- Updated dependencies [fb2e584]
- Updated dependencies [9491266]
- Updated dependencies [2ace620]
- Updated dependencies [fcef799]
- Updated dependencies [37418d9]
- Updated dependencies [083f69c]
- Updated dependencies [5b03d96]
- Updated dependencies [f0d8d67]
- Updated dependencies [836389d]
- Updated dependencies [225c7cc]
  - @google-labs/breadboard@0.21.0

## 0.6.0

### Minor Changes

- f97a4d5: Rename "placeholder" to "loopback".

### Patch Changes

- 29eda71: Board outputs can now be an array of output node configurations
- f60cb06: Set the "type" field when an enumeration is all of one type.
- 87eb8fe: Stringify all defaults and examples
- 60a18c5: Don't make input ports required if there is a default
- b0ed6f3: Allow converge function to take raw values
- 4957dc5: Improve handling of defaults in describe functions. Defaults are now always passed into the describe function, and types will be optional or not based on whether there is a default (default means it can never be undefined).
- a209c51: Use actual schema when auto-computing input schema
- 7368fdd: Allow inputs to be constant
- c9c0e06: Allow declaring objects with optional properties
- c1acf24: Add converge function which allows wiring multiple edges to the same input port
- 3920805: Allow inputs to be optional
- 3b2bb4a: Fix type system bug relating to primary input/output ports (it wasn't working quite right when there were more than one input or output ports).
- 31cf016: Fix a bug in the @breadboard-ai/build type system that allowed node instances to be passed as board outputs even if they did not have a primary port.
- ab43276: Fix bug where constant wouldn't always preserve type information
- 477e6e6: Sort more schema fields for easier comparison across serializers
- cdcbcdb: Node invoke functions can now return $error. All node instances now automatically have an outputs.$error. Throwing from an invoke function will now convert the exception to an $error result; the stack trace is logged to the server, but not shown to the end-user.
- 791ec2a: Add `constant` function which can be used to annotate edges that should get the `constant` bit (also known as memoize).
- c0293c9: New syntax for declaring multiple inputs along with metadata
- b6f5644: Surface a stack trace when an exception is thrown
- 43edef6: Add support for setting $metadata when instantiating a node
- Updated dependencies [8097177]
- Updated dependencies [cec6d54]
- Updated dependencies [3397974]
- Updated dependencies [ab9a4ce]
- Updated dependencies [a35406c]
- Updated dependencies [477e6e6]
  - @google-labs/breadboard@0.20.0

## 0.5.1

### Patch Changes

- Updated dependencies [63eb779]
  - @google-labs/breadboard@0.19.0

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
