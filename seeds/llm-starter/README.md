# Your README goes here

## LLM Starter Kit Node Types

Here are all node handlers that are included in the LLM Starter Kit.

### `prompt-template`

Use this node to populate simple handlebar-style templates. A reuired input is `template`, which is a string that contains the template prompt template. The template can contain zero or more placeholders that will be replaced with values from inputs. Specify placeholders as `{{inputName}}` in the template. The placeholders in the template must match the inputs wired into this node. The node will replace all placeholders with values from the input property bag and pass the result along as the `prompt` output property.

#### Example:

If we send the following inputs to `prompt-template`:

```json
{
  "template": "Question: {{question}}\nThought: {{thought}}",
  "question": "How old is planet Earth?",
  "thought": "I wonder how old planet Earth is?"
}
```

We will get this output:

```json
{
  "prompt": "Question: How old is planet Earth?\nThought: I wonder how old planet Earth is?"
}
```

#### Inputs:

- `template` - required property
- zero or more inputs that will be used to replace placeholders in the template.

#### Outputs:

- `prompts` a string that contains the result of replacing placeholders in the template with values from the inputs.

#### Implementation:

- [src/nodes/prompt-template.ts](src/nodes/prompt-template.ts)

### `local-memory`

Use this node as a simple text line-based accumulator. Every input is added to the list as a line, and the list is passed the `context` output property. Every time the node is visited by the graph, the list keeps growing.

#### Example:

if we send it an input of `Question` with the value of `How old is planet Earth?`, we will see the following output from the node:

```json
{
  "context": "Question: How old is planet Earth?"
}
```

If we visit this node again with the input `Thought` and the value of `I wonder how old planet Earth is?`, we will see the following output from the node:

```json
{
  "context": "Question: How old is planet Earth?\nThought: I wonder how old planet Earth is?"
}
```

#### Inputs:

- any input

#### Outputs:

- `context` a string that contains the result of accumulating all inputs as lines.

#### Implementation:

- [src/nodes/local-memory.ts](src/nodes/local-memory.ts)

### `run-javascript`

Use this node to execute JavaScript code. The node takes a required `code` input property, which is a string that contains the code to be executed. It also takes an `name` input property, which is a string that specifies the name of the function that will be invoked to execute the code. If not supplied, the `run` function name will be used.

The code is executed in a new V8 context in Node or a Web Worker in the browser, which means that it cannot access any variables or functions from the outside.

The node will pass the result of the execution as the `result` output property.

#### Example:

If we send the following inputs to `run-javascript`:

```json
{
  "code": "function run() { return 1 + 1; }"
}
```

We will get this output:

```json
{
  "result": 2
}
```

#### Inputs:

- `code` - required, must contain the code to execute
- `name` - optional, must contain the name of the function to invoke (default: `run`)

#### Outputs:

- `result` - the result of the execution

#### Implementation:

- [src/nodes/run-javascript.ts](src/nodes/run-javascript.ts)

### `jsonata`

Use this node to execute [JSONata](https://jsonata.org/) expressions. The node takes the following properties:

- `expression` input property, which is a string that contains the expression to be executed. This is a required property.
- `json` input property, which is a JSON object that will be used as the context for the expression. This is a required property.
- `raw` input property, which is a boolean that specifies whether the result of the expression should be passed as-is (`true`), or it should be passed as the `result` output property (`false`). This is an optional property, and its default value is `false`.

The node will pass the result of the execution as the `result` output property, unless the `raw` property is set to `true`.

### `secrets`

Use this node to access secrets, such as API keys or other valuable bits of information that you might not want to store in the graph itself. The node needs no inputs and currently simply returns the `process.env` object as output. This enables connecting edges directly from environment variables. For example, use this node to pass the `API_KEY` environment variable to the `text-completion` node.

### `url-template`

Use this node to safely construct URLs. The node takes one required input property:

- `template` string, which is a template for the URL. It can contain zero or more placeholders that will be replaced with values from the input property bag. Specify placeholders as `{{propertyName}}` in the template.

The node will pas the result of replacing placeholders as the `url` output property.

### `xml-to-json`

Use this node to convert XML to JSON. The node takes one required input property:

- `xml` string, which is a string that contains the XML to be converted.

The node will pass the result of the conversion as the `json` output property. The format of JSON follows the `alt-json` convention that is described in https://developers.google.com/gdata/docs/json.

### `fetch`

Use this node to fetch data from the Internet. The node takes the following input properties:

- `url` string (required), which is the URL to fetch. For now, this node can only make a GET request.

- `headers` object (optional), which is a set of headers to be passed to the request.

- `raw` boolean (optional), which specifies whether or not to return raw text (`true`) or parse the response as JSON (`false`). The default value is `false`.

The node will fetch data from the specified URL, parse it as JSON, and pass the result of the fetch as a `response` output property.

### `text-completion`

This is a PaLM API text completion node. It has two required input properties:

- `API_KEY` string, which must contain the Google Cloud Platform API key for the project has the "Generative Language API" API enabled.
- `text` string, which is used as the prompt for the completion.

The node has the following optional input properties:

- `stop-sequences` array of strings. These will be passed as the stop sequences to the completion API.

The node will produce the following output properties:

- `completion` as pass the result of the PaLM API text completion.

### `google-search`

Use this node to invoke the Google Custom Search API.

This node requires two environment variables to be defined:

1. The `API_KEY` environment variable, containing the Google Cloud Platform API key for the project has the "Custom Search API" API enabled.

2. The `GOOGLE_CSE_ID` enviornment variable to be defined. The `GOOGLE_CSE_ID` is the Programmable Search Engine ID. You can create one [here](https://programmablesearchengine.google.com/). When configuring the search engine, make sure to enable the `Search the entire Web` option.

The node takes one required property, `query`, which is a string that contains the query to be passed to the search API.

The node will pass the result of the search as the `results` output property, formatted as a multi-line string, each line a `snippet` from the [Custom Search Engine response](https://developers.google.com/custom-search/v1/reference/rest/v1/Search#Result).
