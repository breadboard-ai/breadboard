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

:two: build the project:

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
  "references": [{ "path": "seeds/awesome-ai-game" }]
}
```

:four: Verify that you have the right setup. Run `npm i` and `npx turbo build` and make sure that the new package shows up in the build log. Then try to run it:

```bash
cd seeds/awesome-ai-game
node .
```

You should see `code goes here` as output.

:five: Build the awesome AI game or whatever it is you've dreamed up.

The new package is configured as a private package by default. If you would like to publish it to `npm`, flip the `private` flag to `true` in `package.json`.

## Working on your project

If everything is set up well, you will spend most of your time tinkering inside of your package.

We recommend opening [VSCode](https://code.visualstudio.com/) in the package directory to reduce the amount of clutter. When you run `npx turbo` inside of your package directory, it will automatically scope the build to only dependencies in your package.

To build your package:

```bash
npx turbo build
```

To test your package:

```bash
npx turbo test
```

You can add more commands to `package.json` and invoke them either using `npx turbo <command>` or if you don't want to use `npx turbo`, you can get the same results (with more typing and checking) by using `npm` directly.

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

## Cleaning stuff

Sometimes, TypeScript Compiler or Turbo (or both!) gets confused, and the only way forward is to clean up the build artifacts and start over. To do that, run:

```bash
npm run clean
```

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

## TypeScript Developer Happy Path

This section describes that I ([dglazkov](https://github.com/dglazkov)) use and it's probably what will give you the most comfortable developer experience in this repo.

### VSCode

Get [VSCode](https://code.visualstudio.com/). There are tons of other editors, but VSCode has likely the most seamless TypeScript integration.

Install “ESLint” and “Prettier” extensions. TypeScript support is built-in by default.

- “ESLint” – provides live commentary on the quality of your code.
- “Prettier” – will make your code look pretty automatically.

If you are playing with graphs, install the “Markdown Preview Mermaid Support” extension.

(Optional) Install Fira Code (the font you’re reading right now)

Tweak the settings to your liking. The most important one is to format-on-save, so that you never need to worry about formatting TypeScript ever again. Here is what I have:

```
"editor.rulers": [80] <-- Draws a nice ruler at 80 columns
"editor.fontFamily": "Fira Code", <-- Fira Code support
"editor.fontLigatures": true, <-- make pretty arrows with Fira Code
"editor.defaultFormatter": "esbenp.prettier-vscode"
"editor.formatOnSave": true, <-- format with Prettier on save
```

Use the built-in terminal (Ctrl+`). For convenience, split the TERMINAL and PROBLEMS tabs horizontally.

This setup creates a really nice separation of the workspace: the top part is where I write code, and the bottom part is where I see if it works. As I type, the problems come and go in the bottom-right window. When I am ready to try running my code, I switch to the terminal and run it from there.

Because TypeScript is built-in, TypeScript errors will show up live in the PROBLEMS window as well, which is super-convenient.
Learn keyboard shortcuts. Ctrl+P (Cmd+P) and Ctrl+Shift+P (Cmd+Shift+P) are likely the most important ones.

Occasionally, VSCode’s built-in TypeScript machinery gets into a confused state. For this purpose, there’s a “TypeScript: Restart TS Server“ command available via Ctrl+Shift+P. You can also use the “Developer: Reload Windows“ command to flush out the gremlins.

### Workflow

The dev cycle is:

- Open the directory of the package (or several of them) in VSCode
- Write some code
- Make ESLint and TypeScript live-compiler happy (no errors show up in the PROBLEMS window)
- Run `npx turbo build` to build the code.
- Run your code with `node .` or whatever is the right way to run it. For convenience, create an [npm script](https://docs.npmjs.com/cli/v9/using-npm/scripts) to combine building and running. See example here.
- Go to the “Write some code” step.

### Build system

This is a monorepo, which in Node.js vernacular means that it is a flat list of npm packages that are all hosted in the same git repository.

The main reason we need to run `npx turbo build` is because in the monorepo, we need to compute the dependency graph before compiling TypeScript to Javascript, and that is not something that comes standard with the TypeScript compiler.

There are other ways to do it, and turbo is likely an overkill. There are more elegant setups with ts-node that make it possible to avoid the build steps altogether, but I haven’t put it together yet. If you have a better/neater way to build, please let me know.

#### Front-end

[Vite](https://vitejs.dev/) is currently brought up in the `web-demo` dir. Use it as a template for other front-end TypeScript packages.

## Publishing NPM packages

Currently, to publish an NPM package, you have to be a Googler. This is unlikely to change in the future. Having said that, here are the steps to publish a package

1. At the root of the repository, run:

```bash
git pull
npm run clean:build
npm i
npx turbo build
```

2. Change directory to the package to be published. For example:

```
cd seeds/graph-runner
```

3. Update `package.json` of this package with the version bump. Follow the [semver](https://semver.org/) guidance. Basically, minor fixes increment the patch version (third number) and everything else increments the minor version (second number).

4. Update `CHANGELOG.md` file to summarize the changes since the last release. You can see the list of changes by looking at the packge directory commit history on Github. For example, for `seeds/graph-runner`, commit history is at [https://github.com/google/labs-prototypes/commits/main/seeds/graph-runner](commits/main/seeds/graph-runner). Follow the convention in the changelog doc. It is loosely inspired by [keepachangelog.com](https://keepachangelog.com/en/1.1.0/)

5. If there are version dependencies on the newly-published package in this monorepo, update their respective `package.json` entries to point to the new version and re-run `npm i`.

6. If this publication corresponds to a change in milestone, change the milestone value of the shield in the `README.md` of the package. Some packages might not have a shield. Consider adding it.

7. Commit changes with the title: `` [<package-name>] Publish  `<version>`. `` and push them to Github.

8. If new milestone tag was added:

Tag the milestone:

```bash
git tag <package>-<milestone> # example: breadboard-m1
```

Push tags

```bash
git push <remote> --tags
```

9. Log into the [wombat NPM proxy](https://opensource.googleblog.com/2020/01/wombat-dressing-room-npm-publication_10.html):

```bash
npm login --registry https://wombat-dressing-room.appspot.com
```

10. Publish to npm:

```bash
npm publish --registry https://wombat-dressing-room.appspot.com
```
## Updating Generated API Docs
As more development takes place and more features are added, the documentation requires update to stay in sync with these developments. <br> <br>
The TSDoc tool provides a command that when run automatically updates the generated docs and inserts it into the workflow. The modules/packages have been configured with a ready TSDoc command that gets triggered when a certain command is specified. <br> <br>
:one: Navigate to your working directory where the change was made. <br> <br>
:two: Run this command in your terminal:
  ```
  npm run generate:docs
  ```
This command successfully regenerates the docs.