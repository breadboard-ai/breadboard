# Changelog

## 0.10.1

### Patch Changes

- fb1c768: Introduce Gemini Kit.

## 0.10.0

### Minor Changes

- 9bcd607: Implement `isImage` type annotation.

### Patch Changes

- f6a7f43: Add schemas to serialised boards
- Updated dependencies [e7be365]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard-schema@1.2.0

## 0.9.1

### Patch Changes

- 81e2840: Teach Breadboard about transient bubbled inputs.

## 0.9.0

### Minor Changes

- 8eccdad: [breadboard-cli] Improvements to OpenAPI import to handle parameters as dynamic inputs and input config files
- 6e8c08d: remove breadboard json schema

### Patch Changes

- 780909c: Stop displaying subgraphs in Breadboard Debugger.
- bba68fd: Write the introduction in the "Happy Path" doc.
- b557794: The "recipe" function is now called "board". A "recipe" alias is still exported to ease migration.
- a9206fc: Firm up the error return type.
- 931a95b: Introduce richer error reporting to the harness.

## 0.8.0

### Minor Changes

- af00e58: Various changes. First release managed by Changesets.

## [0.6.0] - 2023-12-06

- Bug fixes
- New `remote` submodule to enable invoking boards over HTTP and workers
- The new syntax! (WIP)
- The `ui` submodule moved to its own package `breadboard-ui`
- [Bubbling](https://github.com/breadboard-ai/breadboard/issues/166) inputs!

## [0.5.1] - 2023-11-18

- Removed unintended dependency on `jsonschema`.
- Removed circular dependency between `Board` and `BoardRunner`.
- Other bug fixes.

## [0.5.0] - 2023-11-08

- The `/ui` submodule changes:
  - supports multiple simultaneous inputs
  - does not ask for keys more than once per session
  - if you specify `type: "object"` for an input, it will try to parse it as JSON data and pass as an object.
  - draw Mermaid diagrams of the boards
  - there's now a link to the running board in the UI.
- The `/worker` submodule changes:
  - bug fixes (will actually queue received messages and not drop them on the floor)
- The following nodes moved out into the Core Kit: `passthrough`, `reflect`, `slot`, `include`, `import`, and `invoke`.
- The `run` method now takes a `NodeHandlerContext` object as its argument, rather than a list of arguments.
- Kits are no longer implicitly imported by Breadboard. Instead, supply loaded Kits as part `NodeHandlerContext` to `run`.

## [0.4.1] - 2023-10-20

- Moved the `mermaid` method to `BoardRunner`.
- Updated URL resolution on constructed Kits.
- Tweaked documentation.
- Multiline support and loading from URL in UI elements
- Other fixes.

## [0.4.0] - 2023-10-17

- **M2 Release**
- Added minified build artifacts.
- Three new nodes: `invoke`, `import`, and `lambda` (see [documentation](https://github.com/breadboard-ai/breadboard/blob/13601657112736ccccb083ed3e167f7e2ae05928/packages/breadboard/docs/nodes.md))
- Deprecated `include` node (the `invoke` node replaces it)
- Rolled `graph-runner` package in. This package now has zero prod dependencies.
- Added a way for nodes to describe themselves in `NodeHandler`.
- All nodes now describe themselves using the mechanism above.
- Added `SchemaBuilder` for easy building of node descriptions.
- Added `/kits` submodule as a future place for easily creating kits
- Added `GenericKit` abstraction for automatically generating kits from handlers.
- Added `/ui` submodule as the future place for simple Web-based UI for Breadboard.
- Added `/worker` submodule as the future place way to build Breadboard-based Web Workers.
- Added the notion of subgraphs (graphs that are embedded into a larger `GraphDescriptor`).
- Edge inputs are now queued (fixes the issue of new outputs overwriting old ones)
- Node outputs are now asynchronous
- Lots of fixes and love and care.

## [0.3.1] - 2023-09-15

- Updated milestone shield.

## [0.3.0] - 2023-09-15

- There is no more `seeksInput` property on `RunResult`. Instead, the `type` property will tell us why the board paused. Currently, three valid results are `input`, `output`, and `beforehandler`. The first two existed before. The third one now interrupts before running every node.
- The boards now can store metadata about them. See https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/graphs/call-react-with-slot.json for an example. Yes, you can put Markdown in description.
- The boards now have URLs associated with them. When a board is loaded from a URL, the `url` property will reflect that value. All subsequent URLs are resolved relative to the URL of the board.
- If the URL is not supplied, the board is assumed to have a URL of the current working directory of whatever loaded the board.
- There's a `ResultRun.isAtExitNode` method that reports true if the currently visited node is an exit node for the graph.
- There's a `Board.runRemote` method that allows running a board remotely (powered by `packages/breadboard-server`). This functionality is nascent and may not work exactly as expected.

## [0.2.0] - 2023-09-02

- New `beforehandler` event
- New `DebugProbe` that is useful for debugging boards
- New `RunResult` class with `load` and `save` methods to support multi-turn and continuous runs.

## [0.1.1] - 2023-08-23

- updated the homepage URL (oops).

## [0.1.0] - 2023-08-23

- lots of tutorial updates
- `run` and `runOnce` now have `slot` parameter to pass in slotted graphs
- `BreadboardRunResult` now has a `node` property that contains current node
- integrity validator plumbing
- bug fixes and refactorings

## [0.0.2] - 2023-08-04

- updated compiled Javascript (oops).

## [0.0.1] - 2023-08-04

- started a changelog
- [M0 release](https://github.com/breadboard-ai/breadboard/issues?q=is%3Aissue+milestone%3A%22Breadboard+M0%22+is%3Aclosed)
