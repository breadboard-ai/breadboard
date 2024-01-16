# Welcome to your Breadboard starter project

The simplest way to start is to use the Breadboard UI. You can do this by running `npm run debug` and then opening the browser to `http://localhost:3000`.

You can create and edit boards directly in the `recipes/` folder and the changes will be automatically built and be available in the UI.

## Running the recipes from the command line

You can also run the recipes directly on the command line with `npm run recipe --recipe=<path-to-recipe>`.

By default the `npm run recipe` command will include a number of the default kits (e.g, `@google-labs/core-kit`), if you want to use some custom kits, then you can add them to the command line with `npm run recipe --recipe=<path-to-recipe> -- --kit <kit-name> --kit <kit-name>`.
