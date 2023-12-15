# CLI tools that let you play with breadboard

`npm install -g @google-labs/breadboard-cli`

## Usage

### Debug

`npx breadboard debug` - Brings up the web debug server
`npx breadboard debug ./tests/echo.json` - Brings up the local board hosted in the UI

`npx breadboard debug ./tests/` - Brings up the local board hosted in the UI and show all the boards in the folder.

`npx breadboard debug ./tests/ --watch` - Brings up the local board hosted in the UI and show all the boards in the folder. If new boards added to the folder then they will be added to the UI.

### Mermaid

Creates a mermaid diagram from a breadboard file

Pass in a file

`npx breadboard mermaid seeds/breadboard-cli/tests/echo.json`

Pipe in a file
`npx breadboard mermaid < seeds/breadboard-cli/tests/echo.json | npx breadboard mermaid`

Pipe the output of a command
`cat seeds/breadboard-cli/tests/echo.json | npx breadboard mermaid`

Watching and piping the output of a command
`fswatch see/recipes/rss.ts | xargs -n1 -I {} sh -c "npx breadboard mermaid {} -o ./ | mmdc -o test.png -i -"`

### Make

Creates a graph json from a breadboard javascript file.

`npx breadboard make seeds/breadboard-cli/boards/echo.js`

Pipe it to mermaid
`npx breadboard make seeds/breadboard-cli/boards/echo.js | npx breadboard mermaid`

### Run

Creates a graph json from a breadboard javascript file.

`npx breadboard make seeds/breadboard-cli/boards/echo.js`

Pipe it to mermaid
`npx breadboard make seeds/breadboard-cli/boards/echo.js | npx breadboard mermaid`

Include kits:

`npx breadboard run boards/news.json -i "{\"topic\": \"Paul Kinlan\"}" --kit "@google-labs/llm-starter"`
