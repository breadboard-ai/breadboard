# Developing Labs Prototypes Repo

## The lay of the land

This repository is configured as a TypeScript monorepo, using Node's built-in [workspace](https://docs.npmjs.com/cli/v9/using-npm/workspaces?v=true) capability.

Each prototype project lives as an `npm` package. There are two kinds of packages, with a separate directory to store each kind:

- `core` -- contains projects that are core to the repo. These are usually well-established, largely settled bits of code.

- `packages` -- contains early experiments and things that aren't fully fleshed out. Most projects will be packages in this directory.

We use [Wireit](https://github.com/google/wireit) as the build tool for the monorepo.

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

Install all of the dependencies for all of the packages in the monorepo:

```bash
npm i
```

To build the whole project:

```bash
npm run build
```

To run all tests:

```bash
npm run test
```

Most of the time, you will likely want to bring up the Breadboard Web UI. To do so, run the `w` command:

```bash
npm run w
```

To start a doc site server:

```bash
npm run d
```

To start a board server and a Breadboard Web UI:

```bash
npm run s
```

Occasionally, there will be changes that will require a full rebuild with installing new packages, etc.

When you find your repo in a funky state, use the `clean` command. It will delete all build artifacts and bring the repo back to the pristine state, allowing you to restart with `npm i` and all those things.

> [!CAUTION]
> If you have any local files that you have saved in the tree, they will be deleted.

```bash
npm run clean

```

## Starting a new project

To start a new project:

:one: Copy a template project as a new directory under `packages`. For example, if the name of your new prototyping project is `awesome-ai-game`, you would run something like this:

```bash
cp -rf templates/blank packages/awesome-ai-game
```

:two: Replace the following placeholders:

- `{{name}}` -- specify the name of the package. It usually matches the name of the directory you just created, like `awesome-ai-game`.
- `{{description}}` -- describe the nature of the project in one sentence.

:three: Add project as a reference to the `tsconfig.json`. For example, for `awesome-ai-game`:

```json
{
  "extends": "@google-labs/tsconfig/base.json",
  "files": [],
  "references": [{ "path": "packages/awesome-ai-game" }]
}
```

:four: Verify that you have the right setup. Run `npm i` and `npm run build` and make sure that the new package shows up in the build log. Then try to run it:

```bash
cd packages/awesome-ai-game
node .
```

You should see `code goes here` as output.

:five: Build the awesome AI game or whatever it is you've dreamed up.

The new package is configured as a private package by default. If you would like to publish it to `npm`, flip the `private` flag to `true` in `package.json`.

## Working on your project

If everything is set up well, you will spend most of your time tinkering inside of your package.

We recommend opening [VSCode](https://code.visualstudio.com/) in the package directory to reduce the amount of clutter. When you run `npm run` inside of your package directory, it will automatically scope the build to only dependencies in your package.

To build your package:

```bash
npm run build
```

To test your package:

```bash
npm test
```

You can add more commands to `package.json` and invoke them using `npm run <command>`.

To add a new dependency for your package, just run `npm i <package-name>` in your package working directory.

When you need to refer to other packages in the monorepo, you will need to do a bit of manual wiring.

In your project's `package.json` edit the contents of `dependencies` (or `devDependencies`) to add the entry for the package on which you want this package to depend. For example, if we're adding a dependency on the package called `"@google-labs/ai-game-engine"` that also resides in this monorepo, we will do:

```json
"dependencies": {
  "@google-labs/ai-game-engine": "*",
}
```

## Testing

Out of the box, the project template is configured to use [ava](https://github.com/avajs/ava) for testing. You can pick a different test framework. Just make sure to configure your `package.json` to point to it, so that `npm` can run it.

## Cleaning stuff

Sometimes, TypeScript Compiler or Wireit (or both!) gets confused, and the only way forward is to clean up the build artifacts and start over. To do that, run:

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
- Run `npm run build` to build the code.
- Run your code with `node .` or whatever is the right way to run it. For convenience, create an [npm script](https://docs.npmjs.com/cli/v9/using-npm/scripts) to combine building and running. See example here.
- Go to the “Write some code” step.

### Build system

This is a monorepo, which in Node.js vernacular means that it is a flat list of npm packages that are all hosted in the same git repository.

The main reason we need to run `npm run build` is because in the monorepo, we need to compute the dependency graph before compiling TypeScript to Javascript, and that is not something that comes standard with the TypeScript compiler.

#### Front-end

[Vite](https://vitejs.dev/) is currently brought up in the `breadboard-web` dir. Use it as a template for other front-end TypeScript packages. Alternatively, you can use `npm init @google-labs/breadboard [project-name]` to
create a new front-end project.

## Sending PRs

This repo protects the `main` branch, which means all changes must go through a
GitHub PR. This enforces that all tests pass and packages builds before any
change lands, and provides an opportunity for code review.

> [!TIP]
> The [GitHub CLI](https://cli.github.com/) makes it easy to send PRs by
> typing `gh pr create`. You can use the `--fill` or `-f` flag to automatically
> populate the title and description from your commits. See the [create command
> documentation](https://cli.github.com/manual/gh_pr_create) for more
> information.

### Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) to ease
the burden of releasing of NPM packages. The benefits are that it publishes
multiple packages at once, understands the dependencies between all packages in
the monorepo, automatically updates the `package.json` and `CHANGELOG.md` files,
and automatically creates release tags.

> [!TIP]
> If you need to publish NPM packages, see the [Publishing NPM
> packages](#publishing-npm-packages) section below.

After sending a PR, you may receive a comment from
[**changeset-bot**](https://github.com/apps/changeset-bot) that looks like this:

![changeset-bot comment](https://user-images.githubusercontent.com/11481355/66183943-dc418680-e6bd-11e9-998d-e43f90a974bd.png)

This bot is telling you that your PR does not contain a [Changeset
file](https://github.com/changesets/changesets/blob/main/docs/detailed-explanation.md).
Changeset files are how Changesets understands which packages need to be
released at any given time, along with the kind of version bump that is needed
for them.

The easiest way to create a Changeset file for your PR is to run this command:

```
npx changeset
```

This command will prompt you with an interactive list of packages. Select the
packages that your PR affects and indicate whether the changes are
[semver](https://semver.org/) `major` (breaking), `minor` (new features), or
`patch` (bug fixes).

> [!NOTE]
> If your change only affects **unpublished** packages, then you can
> safely skip adding a changeset file and ignore the bot.

Then just push the generated changeset file to your PR!

## Publishing NPM packages

To publish an NPM package, you have to be a Googler. This is unlikely
to change in the future. Having said that, here are the steps to publish a
package.

1. At the root of the repository, ensure you are synchronized to the tip of
   `main` and create a new release branch.

   ```bash
   git checkout main
   git pull
   git checkout -b release
   ```

2. Use the Changesets
   [version](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md#version)
   command to find all packages that need releasing and automatically update
   their `package.json` and `CHANGELOG.md` files. Note that Changesets
   automatically bumps the semver constraints for dependent packages when
   needed, so there is no need to manually edit any `package.json` files.

   ```bash
   npx changeset version
   ```

3. Check what is planned to be published by looking at the latest commit which
   Changesets created in the previous step. Make sure it looks reasonable, and
   send a PR with the changes so that others can see what will be published.

   ```bash
   git show
   gh pr create -f # or git push if you don't have the gh tools
   ```

4. Sign in to NPM:

   ```bash
   npm adduser
   ```

5. Generate a token for the Google NPM release proxy registry. Running the
   command below will open a browser window. Select _24 hour temporary token_
   after which the command should exit by itself.

   ```bash
   npm login --registry https://wombat-dressing-room.appspot.com
   ```

6. Wait for the PR from step 3 to pass CI.

7. Use the Changesets
   [publish](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md#publish)
   command to publish all changes and generate release tags (e.g.
   `@google-labs/breadboard@0.8.0`).

   ```bash
   npx changeset publish
   ```

8. Push the release tags added in step 7 to GitHub so that they are associated
   with the commit from step 2.

   ```bash
   git push --follow-tags
   ```

9. Merge the PR from step 3.

10. If one of the packages released was `hello-world`, please update the Replit project template:

    - Go to [Breadboard Starter Project](https://replit.com/@dglazkov/Breadboard-Starter-Project) template.
    - Run `npx degit breadboard-ai/breadboard/packages/hello-world --force`.
    - Doing so will overwrite existing and add new files. Clean up deleted files.
