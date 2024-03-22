# Changelog

## 0.3.7

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

## 0.3.6

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

## 0.3.5

### Patch Changes

- Updated dependencies [9bcd607]
- Updated dependencies [f6a7f43]
  - @google-labs/breadboard@0.10.0

## 0.3.4

### Patch Changes

- Updated dependencies [8eccdad]
- Updated dependencies [6e8c08d]
- Updated dependencies [780909c]
- Updated dependencies [bba68fd]
- Updated dependencies [b557794]
- Updated dependencies [a9206fc]
- Updated dependencies [931a95b]
  - @google-labs/breadboard@0.9.0

## 0.3.3

### Patch Changes

- Updated dependencies [af00e58]
  - @google-labs/breadboard@0.8.0

## [0.3.2] - 2024-01-22

- Deprecated. See [Issue 177](https://github.com/breadboard-ai/breadboard/issues/177) for details.

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
