# Changelog

## [0.0.7] - 2023-11-24

- Fixing an asset folder location issue that was causing the `npm init` command to fail.
- Don't include imports to kits that aren't yet public.

## [0.0.5] - 2023-11-24

- Adds the `assets` folder to the generated project; It wasn't included in the `dist` folder and it wasn't possible to catch the issue in the mono repo.

## [0.0.4] - 2023-11-23

- Adds the command to create a new breadboard project `npm init @googlelabs/breadboard <project-name>`;
- Updates to use the latest version of `breadboard-web`.
