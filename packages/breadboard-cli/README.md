# CLI tools that let you play with breadboard

:note: The package is not yet published. You can use it by running `npx breadboard` from this monorepo.

`npm install -g @google-labs/breadboard-cli`

The CLI tools are designed to help you create and debug your breadboard files directly from your command line.

## Usage

### Debug

`npx breadboard debug` - Brings up the web debug server
`npx breadboard debug ./tests/echo.json` - Brings up the local board hosted in the UI

`npx breadboard debug ./tests/` - Brings up the local board hosted in the UI and show all the boards in the folder (and sub-folders).

`npx breadboard debug ./tests/ --watch` - Brings up the local board hosted in the UI and show all the boards in the folder. If new boards added to the folder then they will be added to the UI and the UI will be automatically refreshed.

`PORT=1234 npx breadboard debug` - Brings up the web debug server on port 1234 (the default port is
3000).

Note: By default this command will convert any `ts` or `js` board files to `json` and save them along side the original file (this differs from other commands which will use the `-o` flag). If you do not want the boards to be saved, use the `--no-save` flag.

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

Watching and piping the output of a command: `fswatch see/boards/rss.ts | xargs -n1 -I {} sh -c "npx breadboard mermaid {} -o ./ | mmdc -o test.png -i -"`

### Make

Creates a graph json from a breadboard javascript file: `npx breadboard make packages/breadboard-cli/boards/echo.js`

`breadboard make [DIR]` - makes all the boards in dir/\*_/_ and outputs to cwd or `-o DIR`
`breadboard make [FILE]` - makes the file and outputs it to cwd or ` -o DIR``
 `breadboard make [FILE] -n` - makes the file and outputs it to console.

Pipe it to mermaid: `npx breadboard make packages/breadboard-cli/boards/echo.js -n | npx breadboard mermaid`

Watch a directory and make the files: `fswatch see/boards/*.ts | xargs -n1 -I {} sh -c "npx breadboard make {} -o ./`

### Run

Creates a graph json from a breadboard javascript file.

`npx breadboard run packages/breadboard-cli/boards/echo.js` - Runs the board and outputs the result to the console. Because there is no input defined, the board will ask you for input data.

You can also pass in your own input with the `-i` flag: `npx breadboard run packages/breadboard-cli/boards/echo.js -i "{\"text\": \"Hello World\"}"``

If your board has kits, then you can pass in the kit name with the `--kit` flag (specify --kit for each kit you want to use)

`npx breadboard run boards/news.json -i "{\"topic\": \"Paul Kinlan\"}" --kit "@google-labs/core-kit"`

### Proxy

`npx breadboard proxy` - Starts a proxy server that will allow your boards to defer some of their execution to this proxy server. This is useful for when you want to run a board that requires a secret or a token that you don't want to expose in the board file, or if the processing is too complex for the current host.

`npx breadboard proxy --kit @google-labs/core-kit --proxy-node fetch --port 3000` - Starts a proxy server that will allow your boards to the `fetch` (as defined in `core-kit`) to defer some of their execution to this server.

You can then run the board with `npx breadboard run`. For example to run the RSS fetch board you can run `npx breadboard run boards/components/fetch-rss/index.js --proxy http://localhost:3000/ --proxy-node fetch --kit=@google-labs/core-kit --kit @google-labs/json-kit`. This will run the board and defer the `fetch` node to the proxy server.

#### Config file

You can also use a config file to define the proxy server. The config file is a JSON file that looks like this:

```json
{
  "kit": ["@google-labs/core-kit"],
  "proxy": ["fetch"]
}
```

This also allows you to define more complex proxy nodes, such as Secrets tunnelling.
