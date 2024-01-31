# Changelog

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
