# CLI tools that let you play with breadboard

:note: The package is not yet published. You can use it by running `npx breadboard` from this monorepo.

`npm install -g @google-labs/breadboard-cli`

The CLI tools are designed to help you create and debug your breadboard files directly from your command line.

## Usage

### Debug

`npx breadboard debug` - Brings up the web debug server
`npx breadboard debug ./tests/echo.json` - Brings up the local board hosted in the UI

`npx breadboard debug ./tests/` - Brings up the local board hosted in the UI and show all the boards in the folder.

`npx breadboard debug ./tests/ --watch` - Brings up the local board hosted in the UI and show all the boards in the folder. If new boards added to the folder then they will be added to the UI. You still need to `F5` or `CMD+R` to refresh the UI

### Mermaid

Creates a mermaid diagram from a breadboard file.

Pass in a file: `npx breadboard mermaid seeds/breadboard-cli/tests/echo.json`

Pipe in a file: `npx breadboard mermaid < seeds/breadboard-cli/tests/echo.json | npx breadboard mermaid`

Pipe the output of a command: `cat seeds/breadboard-cli/tests/echo.json | npx breadboard mermaid`

Watching and piping the output of a command: `fswatch see/recipes/rss.ts | xargs -n1 -I {} sh -c "npx breadboard mermaid {} -o ./ | mmdc -o test.png -i -"`

### Make

Creates a graph json from a breadboard javascript file: `npx breadboard make seeds/breadboard-cli/boards/echo.js`

Pipe it to mermaid: `npx breadboard make seeds/breadboard-cli/boards/echo.js | npx breadboard mermaid`

Watch a directory and make the files: `fswatch see/recipes/*.ts | xargs -n1 -I {} sh -c "npx breadboard make {} -o ./`

### Run

Creates a graph json from a breadboard javascript file.

`npx breadboard run seeds/breadboard-cli/boards/echo.js` - Runs the board and outputs the result to the console. Because there is no input defined, the board will ask you for input data.

You can also pass in your own input with the `-i` flag: `npx breadboard run seeds/breadboard-cli/boards/echo.js -i "{\"text\": \"Hello World\"}"``

If your board has kits, then you can pass in the kit name with the `--kit` flag (specify --kit for each kit you want to use)

`npx breadboard run boards/news.json -i "{\"topic\": \"Paul Kinlan\"}" --kit "@google-labs/llm-starter"`
