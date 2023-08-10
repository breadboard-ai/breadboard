# Developing Labs Prototypes Repo

## The lay of the land

This repository is configured as a TypeScript monorepo, using Node's built-in [workspace](https://docs.npmjs.com/cli/v9/using-npm/workspaces?v=true) capability.

Each prototype project lives as an `npm` package. There are two kinds of packages, with a separate directory to store each kind:

- `core` -- contains projects that are core to the repo. These are usually well-established, largely settled bits of code.

- `seeds` -- contains early experiments and things that aren't fully fleshed out. Most projects will be packages in this directory.

We use [Turborepo](https://turbo.build/repo/docs) as the build tool for the monorepo.

All packages within the monorepo have a similar structure:

```text

├── package.json
├── src
│   └── index.ts
├────── <dir>
│        ├── <file>.ts
│
│        ...
├── tests
│   └── <file>.ts
│
│   ...

```

Project source files go into the `src` directory, while tests go into `tests`.

The TypeScript build is configured to produce a `dist` directory in the root of each package. This is the directory that is published to `npm`.

## Getting started

After cloning the repo:

:one: Install all of the dependencies for all of the packages in the monorepo:

```bash
npm i
```

:two: Install Turborepo:

```bash
npm i -g turbo
```

If you would prefer not to install `turbo` globally on your machine, you can also invoke it via `npx`. Just don't forget to prefix every turbo command with `npx `.

:three: build the project:

```bash
turbo build
```

or, using `npx`:

```bash
npx turbo build
```

## Starting a new project

To start a new project:

:one: Copy a template project as a new directory under `seeds`. For example, if the name of your new prototyping project is `awesome-ai-game`, you would run something like this:

```bash
cp -rf templates/blank seeds/awesome-ai-game
```

:two: Replace the following placeholders:

- `{{name}}` -- specify the name of the package. It usually matches the name of the directory you just created, like `awesome-ai-game`.
- `{{description}}` -- describe the nature of the project in one sentence.

:three: Add project as a reference to the `tsconfig.json`. For example, for `awesome-ai-game`:

```json
{
  "extends": "@google-labs/tsconfig/base.json",
  "files": [],
  "references": [
    { "path": "seeds/awesome-ai-game" }
  ]
}
```

:four: Verify that you have the right setup. Run `npm i` and `turbo build` and make sure that the new package shows up in the build log. Then try to run it:

```bash
cd seeds/awesome-ai-game
node .
```

You should see `code goes here` as output. 

:five: Build the awesome AI game or whatever it is you've dreamed up.

The new package is configured as a private package by default. If you would like to publish it to `npm`, flip the `private` flag to `true` in `package.json`.

## Working on your project

If everything is set up well, you will spend most of your time tinkering inside of your package. 

We recommend opening [VSCode](https://code.visualstudio.com/) in the package directory to reduce the amount of clutter. When you run `turbo` inside of your package directory, it will automatically scope the build to only dependencies in your package.

To build your package:

```bash
turbo build
```

To test your package:

```bash
turbo test
```

You can add more commands to `package.json` and invoke them either using `turbo <command>` or if you don't want to use `turbo`, you can get the same results (with more typing and checking) by using `npm` directly.

To add a new dependency for your package, just run `npm i <package-name>` in your package working directory.

When you need to refer to other packages in the monorepo, you will need to do a bit of manual wiring.

In your project's `package.json` edit the contents of `dependencies` (or `devDependencies`) to add the entry for the package on which you want this package to depend. For example, if we're adding a dependency on the package called `"@google-labs/ai-game-engine"` that also resides in this monorepo, we will do:

```json
"dependencies": {
  "@google-labs/ai-game-engine": "*",
}
```

## Testing

Out of the box, the project template is configured to use [ava](https://github.com/avajs/ava) for testing. You can pick a different test framework. Just make sure to configure your `package.json` to point to it, so that `turbo` can run it.

## Source Code Headers

Every file containing source code must include copyright and license
information. This includes any JS/CSS files that you might be serving out to
browsers. (This is to help well-intentioned people avoid accidental copying that
doesn't comply with the license.)

```javascript
/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
```
