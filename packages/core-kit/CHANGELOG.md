# Changelog

## 0.19.0

### Minor Changes

- 470e548: Start landing connector infrastructure.
- 34e24f0: Implement MCP connector.
- 99a5d95: Teach fetch to handle streams and files.

### Patch Changes

- Updated dependencies [228d3c4]
- Updated dependencies [470e548]
- Updated dependencies [81d2666]
- Updated dependencies [26fdb89]
- Updated dependencies [9d75ab2]
- Updated dependencies [e21ee39]
- Updated dependencies [66a01e0]
- Updated dependencies [fedacbd]
- Updated dependencies [856c387]
- Updated dependencies [0c0a419]
- Updated dependencies [e7abb8a]
- Updated dependencies [f11621f]
- Updated dependencies [a63fb1e]
- Updated dependencies [af10dc4]
- Updated dependencies [a2d4ee5]
- Updated dependencies [97be783]
- Updated dependencies [8cffe63]
- Updated dependencies [2eee8da]
- Updated dependencies [a564054]
- Updated dependencies [9203afc]
- Updated dependencies [7e17fe2]
- Updated dependencies [0e6f849]
- Updated dependencies [7c6388f]
- Updated dependencies [2074b64]
- Updated dependencies [0c6ad80]
- Updated dependencies [a53adf0]
- Updated dependencies [da0a7a2]
- Updated dependencies [410bc4e]
- Updated dependencies [34e24f0]
- Updated dependencies [ae68b4d]
- Updated dependencies [99a5d95]
- Updated dependencies [eba969c]
- Updated dependencies [b9681e9]
- Updated dependencies [8ce093a]
- Updated dependencies [da380d1]
- Updated dependencies [7b67a8c]
- Updated dependencies [f7bb416]
- Updated dependencies [0d0953e]
- Updated dependencies [10c7441]
- Updated dependencies [ec25bbe]
- Updated dependencies [c8876ee]
- Updated dependencies [27b9c34]
- Updated dependencies [9f87f37]
- Updated dependencies [e58b680]
- Updated dependencies [eef58fa]
  - @breadboard-ai/types@0.7.0
  - @google-labs/breadboard@0.34.0
  - @breadboard-ai/build@0.12.2

## 0.18.1

### Patch Changes

- Updated dependencies [f466c2d]
- Updated dependencies [4ed89ea]
- Updated dependencies [98f6609]
- Updated dependencies [3547630]
- Updated dependencies [dd6b9c1]
- Updated dependencies [b872936]
- Updated dependencies [a09a9c3]
- Updated dependencies [e8abf9f]
- Updated dependencies [a638ffa]
- Updated dependencies [1abb0e3]
  - @google-labs/breadboard@0.33.0
  - @breadboard-ai/build@0.12.1

## 0.18.0

### Minor Changes

- 69d315b: Add support for `redirect` config property in `fetch`.
- 63a1930: Introduce presentation hints and icon on Schema.

### Patch Changes

- Updated dependencies [2144bc3]
- Updated dependencies [3af8f62]
- Updated dependencies [59d6fe7]
- Updated dependencies [925e4bf]
- Updated dependencies [220f27a]
- Updated dependencies [c6f9889]
- Updated dependencies [a2e7a36]
- Updated dependencies [6b6052c]
- Updated dependencies [65f89e0]
- Updated dependencies [0ad7660]
- Updated dependencies [10fee14]
- Updated dependencies [0b1dc88]
- Updated dependencies [83bdea5]
- Updated dependencies [e39ea7e]
- Updated dependencies [c9fc7b0]
- Updated dependencies [74124b8]
- Updated dependencies [63a1930]
- Updated dependencies [b93a70f]
- Updated dependencies [26b1194]
- Updated dependencies [b17362c]
- Updated dependencies [881f8ab]
- Updated dependencies [8e2fc1f]
  - @google-labs/breadboard@0.32.0
  - @breadboard-ai/build@0.12.0

## 0.17.1

### Patch Changes

- 11e4c86: Fix a bunch of bugs I made last week.
- Updated dependencies [25dd1c2]
- Updated dependencies [45c7e5f]
- Updated dependencies [37e3fbd]
- Updated dependencies [71992c0]
- Updated dependencies [8722c8f]
- Updated dependencies [64bbe1b]
- Updated dependencies [e4631ff]
- Updated dependencies [96ea699]
- Updated dependencies [e22e33b]
- Updated dependencies [4a898eb]
- Updated dependencies [7ea05ca]
- Updated dependencies [cae3a3f]
- Updated dependencies [862c53c]
- Updated dependencies [f9dc26b]
- Updated dependencies [df6926d]
- Updated dependencies [84f6a3a]
- Updated dependencies [f6c31d3]
- Updated dependencies [2a6d643]
- Updated dependencies [183c9eb]
- Updated dependencies [c91a1ed]
- Updated dependencies [b685d49]
- Updated dependencies [a717ddc]
- Updated dependencies [46c9327]
- Updated dependencies [07b5676]
- Updated dependencies [66105f9]
- Updated dependencies [4eb6d6d]
- Updated dependencies [032d962]
- Updated dependencies [78da2ab]
- Updated dependencies [96b0597]
- Updated dependencies [404a08f]
- Updated dependencies [eb3fc28]
- Updated dependencies [91e0930]
- Updated dependencies [2130bc6]
- Updated dependencies [d73587b]
- Updated dependencies [b23168c]
- Updated dependencies [e4521d9]
- Updated dependencies [11e4c86]
- Updated dependencies [93a0a94]
- Updated dependencies [3ce820e]
- Updated dependencies [c6935b7]
- Updated dependencies [7ea3b85]
- Updated dependencies [99532f4]
  - @google-labs/breadboard@0.31.0
  - @breadboard-ai/build@0.11.1

## 0.17.0

### Minor Changes

- 18dace0: Allow subgraphs to access modules
- 32b50af: Expose side wires in `InspectableGraph`.
- 8d44489: Implement support for module-based describers
- 856e249: Add some infrastructure for types to JSandbox.

### Patch Changes

- ca466cd: Plumb probe events (node/graph start/end) for runModule.
- d42ab17: Teach Board Server about sandboxed runModule.
- Updated dependencies [e37a9bf]
- Updated dependencies [a13caa0]
- Updated dependencies [ca466cd]
- Updated dependencies [18dace0]
- Updated dependencies [605af98]
- Updated dependencies [32b50af]
- Updated dependencies [19fc2d0]
- Updated dependencies [62d627f]
- Updated dependencies [8d44489]
- Updated dependencies [ce3a00c]
- Updated dependencies [b541052]
- Updated dependencies [c75e26f]
- Updated dependencies [cc19e8c]
- Updated dependencies [9d5f11b]
- Updated dependencies [31ddc9a]
- Updated dependencies [66041a7]
- Updated dependencies [a934fe2]
- Updated dependencies [2c7587a]
- Updated dependencies [9e5390d]
- Updated dependencies [1fb9857]
  - @google-labs/breadboard@0.30.0
  - @breadboard-ai/build@0.11.0

## 0.16.0

### Minor Changes

- a00058b: Introduce `runModule` component (experimental).
- ee2844b: Teach Visual Editor about different edge states.
- 9bd4439: Implement a JS sandbox and start using it in runModule.

### Patch Changes

- 9d5d6d9: Fixes to jsandbox run
- 39d1913: Add webpackIgnore to server-only code
- 5332cbc: Add `module` behavior
- Updated dependencies [4dc21f4]
- Updated dependencies [71d42aa]
- Updated dependencies [1fc5812]
- Updated dependencies [63abd70]
- Updated dependencies [e014e42]
- Updated dependencies [6215ade]
- Updated dependencies [850c217]
- Updated dependencies [ee2844b]
- Updated dependencies [39d1913]
- Updated dependencies [bdf80d8]
- Updated dependencies [29762d6]
- Updated dependencies [c6f1a69]
- Updated dependencies [5332cbc]
- Updated dependencies [db93a6a]
- Updated dependencies [2d5b24e]
- Updated dependencies [8f079a1]
  - @google-labs/breadboard@0.29.0
  - @breadboard-ai/build@0.10.5

## 0.15.3

### Patch Changes

- 413992d: Teach fetch that body can be a string.
- Updated dependencies [5aded4a]
- Updated dependencies [b640cd2]
- Updated dependencies [ffbcf09]
- Updated dependencies [7adeed8]
- Updated dependencies [ca5f932]
- Updated dependencies [b5981d0]
- Updated dependencies [049a83b]
- Updated dependencies [c031dd6]
  - @google-labs/breadboard@0.28.0
  - @breadboard-ai/build@0.10.4

## 0.15.2

### Patch Changes

- @google-labs/breadboard@0.27.3
- @breadboard-ai/build@0.10.3

## 0.15.1

### Patch Changes

- Updated dependencies [370b7ca]
- Updated dependencies [7921983]
  - @google-labs/breadboard@0.27.2
  - @breadboard-ai/build@0.10.2

## 0.15.0

### Minor Changes

- 4dadf16: Introduce experimental storeData and retrieveData components in Core
  Kit.
- f61ccf3: Introduce URL-based component types.
- b673bfa: Migrate curry to build api
- 4423c35: Switch runJavascript worker to be a module worker.

### Patch Changes

- 54c8197: Make build API kit function async
- 88298d5: The result of calling code() now includes a test() method which can
  be used to directly invoke the function. Useful for testing so that you don't
  need to factor out a separate function.
- feeed7a: Allow map to take string boards, and export a coreKit object for
  build api
- 9783ba8: Fix worker memory leak and throttle describers.
- 9c04caa: Convert reduce to build api
- Updated dependencies [49e2740]
- Updated dependencies [54c8197]
- Updated dependencies [703f17d]
- Updated dependencies [6136d87]
- Updated dependencies [cb8c99a]
- Updated dependencies [2f1b85c]
- Updated dependencies [4dadf16]
- Updated dependencies [c145fdd]
- Updated dependencies [226be62]
- Updated dependencies [8f9fddf]
- Updated dependencies [2fa05f0]
- Updated dependencies [f61ccf3]
- Updated dependencies [e61fa66]
- Updated dependencies [f71bcfb]
- Updated dependencies [a104fa7]
- Updated dependencies [8a1b8c4]
- Updated dependencies [3188607]
- Updated dependencies [9797718]
- Updated dependencies [8540b93]
- Updated dependencies [81eafad]
- Updated dependencies [4c03455]
- Updated dependencies [3137076]
- Updated dependencies [157c31e]
- Updated dependencies [4cc71ee]
- Updated dependencies [8330f0c]
- Updated dependencies [a039d2e]
- Updated dependencies [1423647]
- Updated dependencies [9783ba8]
- Updated dependencies [6cdf20c]
- Updated dependencies [f63a497]
- Updated dependencies [aafec7f]
- Updated dependencies [1ad3001]
- Updated dependencies [91fe8bb]
- Updated dependencies [100fc95]
- Updated dependencies [cab83ce]
- Updated dependencies [e19f046]
- Updated dependencies [5834c81]
- Updated dependencies [d7606d3]
- Updated dependencies [0ef793f]
- Updated dependencies [84ca649]
- Updated dependencies [d9fd0ab]
- Updated dependencies [a6128a3]
  - @breadboard-ai/build@0.10.0
  - @google-labs/breadboard@0.27.0

## 0.14.1

### Patch Changes

- 85fb144: Support passing \* StarInputs to code helper
- Updated dependencies [bbcdd2d]
- Updated dependencies [9ed58cf]
- Updated dependencies [7f2ef33]
- Updated dependencies [7d46a63]
- Updated dependencies [bac2e35]
- Updated dependencies [ec2fedd]
  - @breadboard-ai/build@0.9.1
  - @google-labs/breadboard@0.26.0

## 0.14.0

### Minor Changes

- a4301e6: Introduce the ability to write custom describers.
- 7de241c: Remove `BoardRunner`.
- ee1f9ca: Throttle describe requests to once every 5 seconds.

### Patch Changes

- cc5f4b6: Updates for new board function API in build package
- Updated dependencies [cc5f4b6]
- Updated dependencies [49b3612]
- Updated dependencies [e0dccfe]
- Updated dependencies [6404cb3]
- Updated dependencies [9ad0524]
- Updated dependencies [a4301e6]
- Updated dependencies [7fdd660]
- Updated dependencies [a940b87]
- Updated dependencies [b201e07]
- Updated dependencies [15b5659]
- Updated dependencies [374ea85]
- Updated dependencies [0296c89]
- Updated dependencies [a34bb69]
- Updated dependencies [534d67e]
- Updated dependencies [c397d53]
- Updated dependencies [f93ec06]
- Updated dependencies [398bf4f]
- Updated dependencies [7de241c]
- Updated dependencies [a424c92]
- Updated dependencies [c2cd40d]
- Updated dependencies [262cefd]
- Updated dependencies [79d709c]
  - @breadboard-ai/build@0.9.0
  - @google-labs/breadboard@0.25.0

## 0.13.0

### Minor Changes

- 00cc2c5: Remove `lambda`, introduce standalone `invokeGraph` and `runGraph`
  functions, and other plumbing refactoring.
- 3a5ced1: Refactor `map` to run serially when `RunStateManager` is present.

### Patch Changes

- Updated dependencies [8c694ed]
- Updated dependencies [bbf2c30]
- Updated dependencies [14df6a8]
- Updated dependencies [1dc645a]
- Updated dependencies [2aabb7a]
- Updated dependencies [fb72771]
- Updated dependencies [9b22cab]
- Updated dependencies [00cc2c5]
- Updated dependencies [c04cff0]
- Updated dependencies [d88c37b]
- Updated dependencies [3f8cdd1]
- Updated dependencies [3a5ced1]
- Updated dependencies [62f8d5b]
  - @google-labs/breadboard@0.24.0
  - @breadboard-ai/build@0.8.1

## 0.12.0

### Minor Changes

- 6d2939e: Remove the ability to bubble up inputs from `map` component.
- 7298a47: Add simplistic caching to `service` component.

### Patch Changes

- 5c5b665: Stop leaking blob URLs in runJavascript.
- a0852df: Update titles and help links in Core Kit.
- ea7e2a1: Mark `schema` as deprecated on `runJavascript`.
- 8edcbc0: Update Template and Core Kit to jive with docs.
- 9a2ffab: Unpin @breadboard-ai/build dependency from being overly constrained
- b99472b: Update titles in `curry` component.
- 4bfaec5: Improve documentation/metadata for unnest and cast nodes
- Updated dependencies [ad8aa22]
- Updated dependencies [1e1be2a]
- Updated dependencies [2b094a3]
- Updated dependencies [fa93c3f]
- Updated dependencies [f78ec0a]
- Updated dependencies [215bd15]
- Updated dependencies [2b9ef5b]
- Updated dependencies [a0852df]
- Updated dependencies [2312443]
- Updated dependencies [b76f9a1]
- Updated dependencies [6ffa89c]
- Updated dependencies [15ae381]
  - @breadboard-ai/build@0.8.0
  - @google-labs/breadboard@0.23.0

## 0.11.0

### Minor Changes

- 166f290: Introduce `service` node.

### Patch Changes

- f4d2416: Add cast node and helper to core-kit, for asserting some JSON schema
  as the type of some value.
- bc94299: The unnest node now uses the actual describe function of the
  connected node to discover the incoming schema, and sets the outgoing schema
  to match.
- 9d93cf8: Added inputSchema and outputSchema properties. The old "schema"
  property is now deprecated in favor of "outputSchema" (though will fall back
  to "schema").
- 9d93cf8: Add extractTypeFromValue function.
- a9def5c: Fix bug in automatic output schema when using code helper.
- Updated dependencies [a925cf0]
- Updated dependencies [da43bb5]
- Updated dependencies [5cf08f1]
- Updated dependencies [ffbf163]
- Updated dependencies [8928fb7]
- Updated dependencies [9d93cf8]
- Updated dependencies [d6706f2]
- Updated dependencies [5447426]
- Updated dependencies [26e1099]
- Updated dependencies [7e1f01c]
  - @google-labs/breadboard@0.22.0
  - @breadboard-ai/build@0.7.1

## 0.10.1

### Patch Changes

- 29774aa: Update dependency package versions.

## 0.10.0

### Minor Changes

- c27c176: Actually commit the runJavascript change
- 4e66406: Automatically handle errors in `map`.
- 417323c: Teach Board Server to use Node Proxy Server
- 4db3ab7: Teach `runJavascript` to be kind fo esbuild.
- d9b76bd: Teach fetch to handle blob responses.
- 14853d5: Add Gemini Nano node.
- 3e10f0f: Introduce `DataCapability` and add support for multipart form data in
  `fetch`.
- c53ca01: Plumb `DataStore` throuh to `NodeHandlerContext`.
- 0e76614: Fetch will now treat any text/\* MIME type as text
- 2ace620: Teach `InspectableGraph.describe` to correctly propagate
  fixed/flexible bit.
- 26556b6: Teachs runJavaScript to accept a schema
- 5f09b1d: Teach runJavascript to report errors.
- 510e198: Convert map to new build API
- 9491266: Introduce `deflate` node.

### Patch Changes

- 85bbc00: Teach runJavascript to run in Service Workers.
- 5a0afe4: Add inflate node
- 6fdd89e: Add unnest node, for expanding an object value with N properties into
  a node with N output ports
- c82138d: Allow code nodes to return promises
- 0e54e55: Mark `$board` port as `config` on `invoke` node.
- b75a43e: Change `invoke.$board` input to `object` type.
- 6fdd89e: Mark "response" as the primary output of fetch
- 9b1513a: Make sure `structuredClone` is available when running JS in Node.
- Updated dependencies [5a55b7d]
- Updated dependencies [74ade20]
- Updated dependencies [59dd0f5]
- Updated dependencies [417323c]
- Updated dependencies [b3aa884]
- Updated dependencies [00825d5]
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
- Updated dependencies [6ada218]
- Updated dependencies [4c681cb]
- Updated dependencies [fb2e584]
- Updated dependencies [9491266]
- Updated dependencies [2ace620]
- Updated dependencies [c5f8e4f]
- Updated dependencies [fcef799]
- Updated dependencies [37418d9]
- Updated dependencies [083f69c]
- Updated dependencies [5b03d96]
- Updated dependencies [f0d8d67]
- Updated dependencies [836389d]
- Updated dependencies [225c7cc]
- Updated dependencies [06c3f57]
  - @google-labs/breadboard@0.21.0
  - @breadboard-ai/build@0.7.0

## 0.9.0

### Minor Changes

- af54870: Convert passthrough to new API. The output schema of passthrough is
  now taken from the connected inputSchema instead of just using the values.
  This preserves more information about the ports that are being passed-through.

### Patch Changes

- 8774855: Allow code outputs to be optional
- 1b596d4: Add a `code` function which creates a `runJavascript` node in a
  type-safe way.
- 4957dc5: Handle the case in secrets describe where there are no input keys yet
- ee85b67: Add a `secret` function which creates and configures a `secrets` node
  for just one secret, and returns the corresponding output port. A simpler way
  to get secrets in the API.
- 1d29493: Export passthrough node definition
- f870bdd: Allow returning errors from code helper function
- Updated dependencies [8097177]
- Updated dependencies [29eda71]
- Updated dependencies [f60cb06]
- Updated dependencies [cec6d54]
- Updated dependencies [87eb8fe]
- Updated dependencies [f97a4d5]
- Updated dependencies [60a18c5]
- Updated dependencies [b0ed6f3]
- Updated dependencies [4957dc5]
- Updated dependencies [a209c51]
- Updated dependencies [3397974]
- Updated dependencies [7368fdd]
- Updated dependencies [c9c0e06]
- Updated dependencies [c1acf24]
- Updated dependencies [3920805]
- Updated dependencies [ab9a4ce]
- Updated dependencies [3b2bb4a]
- Updated dependencies [a35406c]
- Updated dependencies [31cf016]
- Updated dependencies [ab43276]
- Updated dependencies [477e6e6]
- Updated dependencies [cdcbcdb]
- Updated dependencies [791ec2a]
- Updated dependencies [c0293c9]
- Updated dependencies [b6f5644]
- Updated dependencies [43edef6]
  - @google-labs/breadboard@0.20.0
  - @breadboard-ai/build@0.6.0

## 0.8.1

### Patch Changes

- Updated dependencies [63eb779]
  - @google-labs/breadboard@0.19.0
  - @breadboard-ai/build@0.5.1

## 0.8.0

### Minor Changes

- fefd109: The fetch node is now implemented with @breadboard-ai/build. This
  should not affect any board behavior.
- 34d9c6d: fetch, secrets, and run-javascript are slightly more correct in their
  descriptions (object vs any JSON value)
- c117d4f: Port runJavascript node to @breadboard-ai/build

### Patch Changes

- 54baba8: Implement `AbortSignal` support.
- 416aed2: Introduce `metadata` for `NodeHandler` entries, teaching node types
  in Kits to describe themselves.
- f2eda0b: Fix lots of bugs around Tool Worker.
- 776f043: Export fetch, invoke, runJavascript, and secrets node definitions
- Updated dependencies [3f9507d]
- Updated dependencies [cef20ca]
- Updated dependencies [55a9647]
- Updated dependencies [1e86a87]
- Updated dependencies [3f9507d]
- Updated dependencies [1adb24c]
- Updated dependencies [1e86a87]
- Updated dependencies [fbf7a83]
- Updated dependencies [fefd109]
- Updated dependencies [c1dcb0a]
- Updated dependencies [54baba8]
- Updated dependencies [49c3aa1]
- Updated dependencies [cdc23bb]
- Updated dependencies [416aed2]
- Updated dependencies [1adb24c]
- Updated dependencies [a1fcaea]
- Updated dependencies [d9ac358]
- Updated dependencies [c3ed6a7]
- Updated dependencies [f1883d1]
- Updated dependencies [1adb24c]
- Updated dependencies [d8cb0c9]
- Updated dependencies [34d9c6d]
- Updated dependencies [e6e0168]
- Updated dependencies [3d48482]
- Updated dependencies [1adb24c]
- Updated dependencies [f2eda0b]
- Updated dependencies [3f9507d]
- Updated dependencies [626139b]
- Updated dependencies [1adb24c]
- Updated dependencies [3f9507d]
- Updated dependencies [bd44e29]
- Updated dependencies [c4ca6dc]
- Updated dependencies [1adb24c]
- Updated dependencies [cfbcdf2]
- Updated dependencies [1d9cb16]
- Updated dependencies [49da151]
- Updated dependencies [43da00a]
- Updated dependencies [3f9507d]
- Updated dependencies [dfd5ce2]
- Updated dependencies [cfc0f15]
- Updated dependencies [00ccb9d]
- Updated dependencies [08eabf4]
- Updated dependencies [c3587e1]
- Updated dependencies [99fcffe]
- Updated dependencies [1e86a87]
- Updated dependencies [3f9507d]
- Updated dependencies [d9ac358]
  - @breadboard-ai/build@0.5.0
  - @google-labs/breadboard@0.18.0

## 0.7.0

### Minor Changes

- 0831735: Introduce `curry` node.
- d60f38b: Deprecate `path` on `core.invoke`.

### Patch Changes

- 5602f1e: Remove the warning when encountering unknown function format.
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

## 0.6.0

### Minor Changes

- 9d19852: Teach `map` and `reduce` to support embedded subgraphs.

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

## 0.5.3

### Patch Changes

- 182a546: Do not throw in `invoke` describer when board couldn't be loaded.
- Updated dependencies [76da09d]
- Updated dependencies [938015d]
  - @google-labs/breadboard@0.15.0

## 0.5.2

### Patch Changes

- Updated dependencies [e8d0737]
  - @google-labs/breadboard@0.14.0

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

- 26367fe: Fixing typo in describe that would mean passthrough and reflect would
  not tell the system of their inputs

### Patch Changes

- Updated dependencies [07e66bf]
  - @google-labs/breadboard@0.11.2

## 0.3.1

### Patch Changes

- 3ed66b9: Add a resolve node to core-kit which resolves relative URLs to
  absolute URLs.
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
  - Moved from Breadboard: `passthrough`, `reflect`, `slot`, `include`,
    `import`, and `invoke`
  - Graduated from Node Nursery: `batch`, `map`
