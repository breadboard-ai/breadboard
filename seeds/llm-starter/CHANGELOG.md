# Changelog

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
- [M1 Release](https://github.com/google/labs-prototypes/milestone/4)

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
- [M0 Release](https://github.com/google/labs-prototypes/issues?q=is%3Aissue+milestone%3A%22LLM+Starter+Kit+M0%22+is%3Aclosed)
