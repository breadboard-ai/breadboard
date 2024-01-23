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

### Import

Imports an OpenAPI spec and converts the interface into a breadboard file that you can use.

`npx breadboard import https://raw.githubusercontent.com/breadboard-ai/breadboard/c371c2cd5aca33673e30fc647c920228752e41ee/recipes/tools/openapi/tests/specs/openai.json -o ./` - Will import the latest `OpenAI` OpenAPI JSON spec and emit a breadboard file for each endpoint in the spec.

or

`npx breadboard import https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml -o ./` - Will import the latest `OpenAI` OpenAPI YAML spec and emit a breadboard file for each endpoint in the spec.

`npx breadboard import https://raw.githubusercontent.com/breadboard-ai/breadboard/c371c2cd5aca33673e30fc647c920228752e41ee/recipes/tools/openapi/tests/specs/openai.json -a createEmbeddings` - Will import the latest `OpenAI` OpenAPI spec emit only the named endpoint (in this case `createEmbeddings`)

If you don't specify an API (with `-a`), then you must specify the `-o` (output directory) flag because the tool will create a file for each endpoint in the spec.

The `-o` flag will output to the filesystem and not the terminal.

Note: The code for importing the OpenAPI spec is not complete - for example it doesn't handle all types of auth (currently only Bearer.)

Now you can also do neat things such as ``npx breadboard import https://raw.githubusercontent.com/breadboard-ai/breadboard/c371c2cd5aca33673e30fc647c920228752e41ee/recipes/tools/openapi/tests/specs/openai.json -a createEmbeddings | npx breadboard mermaid`

### Mermaid

Creates a mermaid diagram from a breadboard file.

Pass in a file: `npx breadboard mermaid packages/breadboard-cli/tests/echo.json`

Pipe in a file: `npx breadboard mermaid < packages/breadboard-cli/tests/echo.json | npx breadboard mermaid`

Pipe the output of a command: `cat packages/breadboard-cli/tests/echo.json | npx breadboard mermaid`

Watching and piping the output of a command: `fswatch see/recipes/rss.ts | xargs -n1 -I {} sh -c "npx breadboard mermaid {} -o ./ | mmdc -o test.png -i -"`

### Make

Creates a graph json from a breadboard javascript file: `npx breadboard make packages/breadboard-cli/boards/echo.js`

Pipe it to mermaid: `npx breadboard make packages/breadboard-cli/boards/echo.js | npx breadboard mermaid`

Watch a directory and make the files: `fswatch see/recipes/*.ts | xargs -n1 -I {} sh -c "npx breadboard make {} -o ./`

### Run

Creates a graph json from a breadboard javascript file.

`npx breadboard run packages/breadboard-cli/boards/echo.js` - Runs the board and outputs the result to the console. Because there is no input defined, the board will ask you for input data.

You can also pass in your own input with the `-i` flag: `npx breadboard run packages/breadboard-cli/boards/echo.js -i "{\"text\": \"Hello World\"}"``

If your board has kits, then you can pass in the kit name with the `--kit` flag (specify --kit for each kit you want to use)

`npx breadboard run boards/news.json -i "{\"topic\": \"Paul Kinlan\"}" --kit "@google-labs/core-kit"`
