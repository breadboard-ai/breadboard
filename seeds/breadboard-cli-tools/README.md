# CLI tools that let you play with breadboard

`npm install -g breadboard-cli-tools`

## Usage

### Debug

If it's not installed:

`npm run run-debug debug` - Brings up the web debug server
`npm run run-debug debug ./tests/echo.json` - Brings up the local board hosted in the UI

If it is installed:

`breadboard debug` - Brings up the web debug server
`breadboard debug ./tests/echo.json` - Brings up the local board hosted in the UI

### Mermaid

Creates a mermaid diagram from a breadboard file

Pass in a file

`npx breadboard mermaid seeds/breadboard-cli-tools/tests/echo.json`

Pipe in a file
`npx breadboard mermaid < seeds/breadboard-cli-tools/tests/echo.json | npx breadboard mermaid`

Pipe the output of a command
`cat seeds/breadboard-cli-tools/tests/echo.json | npx breadboard mermaid`

### Make

Creates a graph json from a breadboard javascript file.

`npx breadboard make seeds/breadboard-cli-tools/boards/echo.js`

Pipe it to mermaid
`npx breadboard make seeds/breadboard-cli-tools/boards/echo.js | npx breadboard mermaid`

### Run

Creates a graph json from a breadboard javascript file.

`npx breadboard make seeds/breadboard-cli-tools/boards/echo.js`

Pipe it to mermaid
`npx breadboard make seeds/breadboard-cli-tools/boards/echo.js | npx breadboard mermaid`

Include kits:

`npx breadboard run boards/news.json -i "{\"topic\": \"Paul Kinlan\"}" --kit "@google-labs/llm-starter"`