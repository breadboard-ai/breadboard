# @google-labs/breadboard-web

## 1.2.1

### Patch Changes

- 464c10e: Various fixes to UI
- 73455ce: Implement "human" node in Agent Kit
- Updated dependencies [464c10e]
- Updated dependencies [c1b6c94]
- Updated dependencies [3ed66b9]
- Updated dependencies [73455ce]
- Updated dependencies [05136f8]
- Updated dependencies [ef305d1]
- Updated dependencies [aea9178]
- Updated dependencies [eaac69a]
- Updated dependencies [f17784a]
- Updated dependencies [20a0e5c]
  - @google-labs/breadboard-ui@0.2.0
  - @google-labs/core-kit@0.3.1
  - @google-labs/agent-kit@0.2.0
  - @google-labs/breadboard@0.11.1

## 1.2.0

### Minor Changes

- a4146c4: Introduce "Agent Kit" to the Breadboard Kit family.
- e6ed591: Change primary visualizer to editor
- 0c2e494: Add 'Summarizer' board illustrating Agent Kit.
- d378070: Introduce `bb-embed` element for easy Breadboard embedding.
- 0085ee2: Teach inspector API to correctly describe nodes.
- ee00249: Introduce `NodeMetadata`.
- 57e68ba: Adds LiteGraph editor
- 4c5b853: Implement output bubbling.
- 3f3f090: Teach `jsonata` and `invoke` nodes to better describe themselves.

### Patch Changes

- cd4f6e2: Add support for creating, deleting, and moving edges
- a9daeda: Introduce Repeater node in Agent Kit.
- 5221586: Add "Structured Worker" node to Agent Kit.
- 5cf1555: Make Chat Bot 2.0 work.
- 9a76a87: Various fixes to Editor API found while playing with the visual editor.
- b944657: Update existing boards to use Structured Worker.
- f06f400: Introduce Agent Kit.
- 56ccae5: Introduce a way to inspect kits.
- 10a8129: Add docs for the Agent Kit
- a4029de: Implement a Repeater-based summarizer
- c3966d3: Add licensing headers
- Updated dependencies [c19513e]
- Updated dependencies [cd4f6e2]
- Updated dependencies [a9daeda]
- Updated dependencies [a4146c4]
- Updated dependencies [5221586]
- Updated dependencies [2237a4c]
- Updated dependencies [e6ed591]
- Updated dependencies [bd68ebd]
- Updated dependencies [9a76a87]
- Updated dependencies [0c2e494]
- Updated dependencies [ea652f3]
- Updated dependencies [56954c1]
- Updated dependencies [b944657]
- Updated dependencies [c3966d3]
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
- Updated dependencies [abe8819]
- Updated dependencies [53406ad]
- Updated dependencies [4c5b853]
- Updated dependencies [e9696df]
- Updated dependencies [3f3f090]
- Updated dependencies [d7a7903]
- Updated dependencies [4401a98]
- Updated dependencies [b3ae9c7]
- Updated dependencies [f6e9b2c]
  - @google-labs/breadboard-ui@0.1.0
  - @google-labs/breadboard@0.11.0
  - @google-labs/agent-kit@0.1.0
  - @google-labs/core-kit@0.3.0
  - @google-labs/json-kit@0.1.0
  - @google-labs/template-kit@0.2.0
  - @google-labs/node-nursery-web@1.0.3
  - @google-labs/gemini-kit@0.1.2
  - @google-labs/palm-kit@0.0.5
  - @google-labs/pinecone-kit@0.1.2

## 1.1.1

### Patch Changes

- 7dbc32e: Bump version of gemini-kit geps.

## 1.1.0

### Minor Changes

- 5c3076a: Add `Webcam` board to demo gemini.vision node.
- fb1c768: Introduce Gemini Kit.

### Patch Changes

- Updated dependencies [3e56a4f]
- Updated dependencies [fb1c768]
  - @google-labs/template-kit@0.1.4
  - @google-labs/gemini-kit@0.1.0
  - @google-labs/core-kit@0.2.2
  - @google-labs/breadboard@0.10.1

## 1.0.4

### Patch Changes

- 1b3f266: Display structured errors in preview/debug views.
- Updated dependencies [1b3f266]
- Updated dependencies [9bcd607]
- Updated dependencies [5b1913f]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard-ui@0.0.6
  - @google-labs/breadboard@0.10.0
  - @google-labs/pinecone-kit@0.1.1
  - @google-labs/core-kit@0.2.1
  - @google-labs/json-kit@0.0.5
  - @google-labs/node-nursery-web@1.0.2
  - @google-labs/palm-kit@0.0.4
  - @google-labs/template-kit@0.1.3

## 1.0.3

### Patch Changes

- bbbd9f4: Fixes Continue button in debugger and preview
- Updated dependencies [bbbd9f4]
  - @google-labs/breadboard-ui@0.0.5

## 1.0.2

### Patch Changes

- 81e2840: Add "Agent Loop" board
- Updated dependencies [2f524ef]
- Updated dependencies [81e2840]
  - @google-labs/pinecone-kit@0.1.0
  - @google-labs/breadboard@0.9.1

## 1.0.1

### Patch Changes

- Updated dependencies [deb0d19]
  - @google-labs/node-nursery-web@1.0.0

## 1.0.0

### Major Changes

- 6222fb3: Initial publish of breadboard-web

### Minor Changes

- c89b67a: Introduce the Agent Chain board.

### Patch Changes

- 67073c8: Fix a bug of handling empty context in `gemini-generator`.
- 3ab5892: Prepare a blank template with new syntax and debugger.
- 780909c: Stop displaying subgraphs in Breadboard Debugger.
- 58b623b: Introduce `ask-user` board and adapt `agent` board to be useful with it.
- c71339f: Stop generating mermaid files automatically.
- 605cff3: Improve resilience of boards (error-handling, safer paths)
- 3356d08: Add favicon
- Updated dependencies [8eccdad]
- Updated dependencies [6e8c08d]
- Updated dependencies [eeb55f0]
- Updated dependencies [780909c]
- Updated dependencies [bba68fd]
- Updated dependencies [c08bd6b]
- Updated dependencies [c89b67a]
- Updated dependencies [cce897a]
- Updated dependencies [b557794]
- Updated dependencies [a9206fc]
- Updated dependencies [149222f]
- Updated dependencies [931a95b]
  - @google-labs/breadboard@0.9.0
  - @google-labs/breadboard-ui@0.0.4
  - @google-labs/core-kit@0.2.0
  - @google-labs/json-kit@0.0.4
  - @google-labs/node-nursery-web@0.0.3
  - @google-labs/palm-kit@0.0.3
  - @google-labs/pinecone-kit@0.0.3
  - @google-labs/template-kit@0.1.2

## 0.0.2

### Patch Changes

- Updated dependencies [af00e58]
  - @google-labs/breadboard@0.8.0
  - @google-labs/breadboard-ui@0.0.3
  - @google-labs/core-kit@0.1.3
  - @google-labs/json-kit@0.0.3
  - @google-labs/node-nursery-web@0.0.2
  - @google-labs/palm-kit@0.0.2
  - @google-labs/pinecone-kit@0.0.2
  - @google-labs/template-kit@0.1.1
