# Changelog

## [0.3.1] - 2023-09-15

- Updated milestone shield.

## [0.3.0] - 2023-09-15

- There is no more `seeksInput` property on `RunResult`. Instead, the `type` property will tell us why the board paused. Currently, three valid results are `input`, `output`, and `beforehandler`. The first two existed before. The third one now interrupts before running every node.
- The boards now can store metadata about them. See https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/graphs/call-react-with-slot.json for an example. Yes, you can put Markdown in description.
- The boards now have URLs associated with them. When a board is loaded from a URL, the `url` property will reflect that value. All subsequent URLs are resolved relative to the URL of the board.
- If the URL is not supplied, the board is assumed to have a URL of the current working directory of whatever loaded the board.
- There's a `ResultRun.isAtExitNode` method that reports true if the currently visited node is an exit node for the graph.
- There's a `Board.runRemote` method that allows running a board remotely (powered by `seeds/breadboard-server`). This functionality is nascent and may not work exactly as expected.

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
- [M0 release](https://github.com/google/labs-prototypes/issues?q=is%3Aissue+milestone%3A%22Breadboard+M0%22+is%3Aclosed)
