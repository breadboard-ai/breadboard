# npm init @google-labs/breadboard your-project-name

This project will quickly create a neat new project for you to start working on.

You can create and edit boards directly in the src/boards folder.

Note: If you are testing locally without publishing the module, then you need to `npm i` in the root before using.

## Usage

If you are running from inside the breadboard repo, and you want to use the latest versions of breadboard (i.e. not the published versions) then you _MUST_ use the `--workspace` command.

```bash
npm init @google-labs/breadboard ../testing --workspace=./packages/create-breadboard
```

This will create a new project in the `../testing` folder relative to the `./packages/create-breadboard` folder.

If you are running from outside the breadboard repo, then you can run:

```bash
npm init @google-labs/breadboard your-project-name
```

This will install `@google-labs/breadboard` from npm and create a new project in the `your-project-name` folder.
