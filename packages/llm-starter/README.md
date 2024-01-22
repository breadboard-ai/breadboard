# LLM Starter Kit

![Milestone](https://img.shields.io/badge/milestone-M3-red) ![Stability](https://img.shields.io/badge/stability-wip-green)

The LLM Starter Kit is a collection of [Breadboard](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard) nodes that are helpful for building LLM-based (Generative AI) applications.

## Installing

LLM Starter Kit requires Node version >=v19.0.0. To install:

```sh
npm install @google-labs/llm-starter
```

## Node Types

Here are all node handlers that are included in the LLM Starter Kit.

### The `promptTemplate` node

Use this node to populate simple handlebar-style templates. A required input is `template`, which is a string that contains the template prompt template. The template can contain zero or more placeholders that will be replaced with values from inputs. Specify placeholders as `{{inputName}}` in the template. The placeholders in the template must match the inputs wired into this node. The node will replace all placeholders with values from the input property bag and pass the result along as the `prompt` output property.

#### Example:

If we send the following inputs to `promptTemplate`:

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

- `prompt` a string that contains the result of replacing placeholders in the template with values from the inputs.

#### Implementation:

- [src/nodes/prompt-template.ts](src/nodes/prompt-template.ts)

### The `runJavascript` node

Use this node to execute JavaScript code. The node recognizes a required `code` input property, which is a string that contains the code to be executed. It also recognizes a `name` input property, which is a string that specifies the name of the function that will be invoked to execute the code. If not supplied, the `run` function name will be used.

All other input properties will be passed as arguments to the function.

The code is executed in a new V8 context in Node or a Web Worker in the browser, which means that it cannot access any variables or functions from the outside.

The node will pass the result of the execution as the `result` output property.

#### Example:

If we send the following inputs to `runJavascript`:

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

If we send:

```json
{
  "code": "function run({ what }) { return `hello ${what}`; }",
  "what": "world"
}
```

We will get:

```json
{
  "result": "hello world"
}
```

#### Inputs:

- `code` - required, must contain the code to execute
- `name` - optional, must contain the name of the function to invoke (default: `run`)
- zero or more inputs that will be passed as arguments to the function.

#### Outputs:

- `result` - the result of the execution

#### Implementation:

- [src/nodes/run-javascript.ts](src/nodes/run-javascript.ts)

### The `secrets` node

Use this node to access secrets, such as API keys or other valuable bits of information that you might not want to store in the graph itself. The node takes in an array of strings named `keys`, matches the process environment values, and returns them as outputs. This enables connecting edges from environment variables.

#### Example:

Use this node to pass the `PALM_KEY` environment variable to the `text-completion` node. The input:

```json
{
  "keys": ["PALM_KEY"]
}
```

Will produce this output:

```json
{
  "PALM_KEY": "<value of the API key from the environment>"
}
```

#### Inputs:

- `keys` - required, must contain an array of strings that represent the keys to look up in the environment. If not supplied, empty output is returned.

#### Outputs:

- one output for each key that was found in the environment.

#### Implementation:

- [src/nodes/secrets.ts](src/nodes/secrets.ts)

### The `urlTemplate` node

Use this node to safely construct URLs. It's similar in spirit to the `promptTemplate` node, except it ensures that the handlebar parameters are properly encoded as part of the URL. This node relies on the [URI template specification](https://tools.ietf.org/html/rfc6570) to construct URLs, so the syntax is using single curly braces instead of double curly braces.

#### Example:

If we send the following inputs to `urlTemplate`:

```json
{
  "template": "https://example.com?question={question}",
  "question": "How old is planet Earth?"
}
```

We will get this output:

```json
{
  "url": "https://example.com?question=How%20old%20is%20planet%20Earth%3F"
}
```

#### Inputs:

- `template` -- required, a template for the URL. It can contain zero or more placeholders that will be replaced with values from the input property bag. Specify placeholders as `{propertyName}` in the template.
- zero or more inputs that will be used to replace placeholders in the template.

#### Outputs:

- `url` a string that contains the result of replacing placeholders in the template with values from the inputs.

#### Implementation:

- [src/nodes/url-template.ts](src/nodes/url-template.ts)

### The `fetch` node

Use this node to fetch data from the Internet. Practically, this is a wrapper around [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

#### Example:

If we would like to fetch data from `https://example.com`, we would send the following inputs to `fetch`:

```json
{
  "url": "https://example.com"
}
```

And receive this output:

```json
{
  "response": "<response from https://example.com>"
}
```

#### Inputs:

- `url` -- required, URL to fetch. For now, this node can only make a GET request.
- `headers` -- object (optional), a set of headers to be passed to the request.
- `raw` boolean (optional), specifies whether or not to return raw text (`true`) or parse the response as JSON (`false`). The default value is `false`.

#### Outputs:

- `response` -- the response from the server. If `raw` is `false`, the response will be parsed as JSON.

#### Implementation:

- [src/nodes/fetch.ts](src/nodes/fetch.ts)
