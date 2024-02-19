# Changelog

## 0.2.0

### Minor Changes

- 0085ee2: Teach inspector API to correctly describe nodes.

### Patch Changes

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

## 0.1.4

### Patch Changes

- 3e56a4f: Added a few TSDoc comments to kits for Intellisense.
- Updated dependencies [fb1c768]
  - @google-labs/breadboard@0.10.1

## 0.1.3

### Patch Changes

- Updated dependencies [9bcd607]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard@0.10.0

## 0.1.2

### Patch Changes

- Updated dependencies [8eccdad]
- Updated dependencies [6e8c08d]
- Updated dependencies [780909c]
- Updated dependencies [bba68fd]
- Updated dependencies [b557794]
- Updated dependencies [a9206fc]
- Updated dependencies [931a95b]
  - @google-labs/breadboard@0.9.0

## 0.1.1

### Patch Changes

- Updated dependencies [af00e58]
  - @google-labs/breadboard@0.8.0

## [0.3.1] - 2024-01-14

- Update dependencies and type info for new syntax.

## [0.3.0] - 2023-12-06

- The `generateText` and `embedText` moved to `palm-kit`.
- Lots of error-handling improvements.
- Streaming and Server-sent event support for `fetch`.

## [0.2.1] - 2023-11-08

- In `fetch`, do not add request body if method is `GET`
- In `generateText`, set `text` and `PALM_KEY` as required.

## [0.2.0] - 2023-10-17

- **M2 Release**
- dependency changes
- all nodes now describe themselves
- new node: `embedText`
- kit can run in a Web worker now
- `generateText` properly supports `$error` output.

## [0.1.2] - 2023-09-15

- dependency changes.
- [M1 Release](https://github.com/breadboard-ai/breadboard/milestone/4)

## [0.1.1] - 2023-09-02

- `secrets` node now throws on missing keys
- `promptTemplate` node now correctly serializes inputs as JSON.

## [0.1.0] - 2023-08-23

- strong typing plumbing
- `runJavascript` now recognizes arguments
- `runJavascript` can now outputs raw JSON with `raw` property
- `append` correctly stringifies non-stringy values
- `promptTemplate` no longer barfs on dashes in parameter names
- the kit works in browser!
- bug fixes, refactorings.

## [0.0.1] - 2023-08-04

- started a changelog
- [M0 Release](https://github.com/breadboard-ai/breadboard/issues?q=is%3Aissue+milestone%3A%22LLM+Starter+Kit+M0%22+is%3Aclosed)
