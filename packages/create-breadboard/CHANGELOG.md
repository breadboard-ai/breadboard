# Changelog

## 1.0.3

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
- Updated dependencies [f06f400]
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
  - @google-labs/breadboard-hello-world@1.2.3

## 1.0.2

### Patch Changes

- 45654e1: update dependencies for running in a clean environment
  - @google-labs/breadboard-hello-world@1.2.2

## 1.0.1

### Patch Changes

- 2dcedd8: Clear the repository field from user projects
  - @google-labs/breadboard-hello-world@1.0.1

## 1.0.0

### Major Changes

- 5d72c02: @google-labs/create-breadboard now uses @google-labs/breadboard-hello-world as template,
  which includes an entirely different starting project.

### Patch Changes

- Updated dependencies [5d72c02]
  - @google-labs/breadboard-hello-world@1.0.0

## 0.1.0

### Minor Changes

- b557794: The "recipe" command has been renamed to "board"

## 0.0.9

### Patch Changes

- af00e58: Add missing chalk dependency

## [0.0.7] - 2023-11-24

- Fixing an asset folder location issue that was causing the `npm init` command to fail.
- Don't include imports to kits that aren't yet public.

## [0.0.5] - 2023-11-24

- Adds the `assets` folder to the generated project; It wasn't included in the `dist` folder and it wasn't possible to catch the issue in the mono repo.

## [0.0.4] - 2023-11-23

- Adds the command to create a new breadboard project `npm init @googlelabs/breadboard <project-name>`;
- Updates to use the latest version of `breadboard-web`.
