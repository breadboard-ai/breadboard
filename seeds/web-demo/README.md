# Breadboard Web Demo

This is a simple test harness for a number of components in the breadboard project

If the board you're running is asking for `secrets`, they will need to be set in the local storage. To do this:

1. Open the dev tools
2. Go to the Application tab
3. Select Local Storage
4. Add keys and values as needed

For example, for `PALM_KEY`, you will need to add a key of `PALM_KEY` and a value of the key that you want to use.

- To run so that you can debug: `npm run dev`
- To run as if it's production and all of the minification: `npm run preview`

## How to add a Kit?

Because we can load Breadboards from Graphs, and those graphs can list the kits that they support, we need add a kit to the web demo.

1. npm install the kit to the project.
2. Add the kit to the `kits` in vite.config.ts - this will make sure it's compiled for production, and also available to serve in testing
3. Add the kit to the import maps in index.html - this will make sure that the kit is available to the browser and it can map the real module name that would be in the graph to what we have in the web demo.
