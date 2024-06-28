---
layout: docs.njk
title: Core Kit
tags:
  - kits
  - wip
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/core-kit/src/nodes/" %}

This is the kit that provides the most fundamental building blocks for Breadboard and contains the following nodes:

## The `curry` node

Takes a board and bakes in (curries) supplied arguments into it. Very useful when we want to invoke a board with the same arguments many times (like with `map`).

### Input ports

### Output ports

### Example

### Implementation

- [curry.ts]({{src_url}}curry.ts)

## The `deflate` node

Converts all inline data to stored data, saving memory. Useful when working with multimodal content. Safely passes data through if it's already stored or no inline data is present.

### Input ports

### Output ports

### Example

### Implementation

- [deflate.ts]({{src_url}}deflate.ts)

## The `fetch` node

Use this node to fetch data from the Internet. Practically, this is a wrapper around [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

### Input ports

- `url` -- required, URL to fetch. For now, this node can only make a GET request.
- `headers` -- object (optional), a set of headers to be passed to the request.
- `raw` boolean (optional), specifies whether or not to return raw text (`true`) or parse the response as JSON (`false`). The default value is `false`.

### Output ports

- `response` -- the response from the server. If `raw` is `false`, the response will be parsed as JSON.

### Example

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

### Implementation

- [fetch.ts]({{src_url}}fetch.ts)

## The `inflate` node

Converts stored data to base64.

### Input ports

### Output ports

### Example

### Implementation

- [inflate.ts]({{src_url}}inflate.ts)

## The `invoke` node

Invokes (runOnce) specified board, supplying remaining incoming wires as inputs for that board. Returns the outputs of the board.

Use this node to invoke another board from this board.

It recognizes `path`, `graph`, and `board` properties that specify, respectively, a file path or URL to the serialized board, directly the serialized-as-JSON board, and a `BoardCapability` (returned by `lambda` or `import`).

The rest of the inputs in the property bag are passed along to the invoked board as its inputs. If other inputs were bound to the board via wires into the `lambda` or `import` node, then those have precedence over inputs passed here.

The outputs of the invoked board will be passed along as outputs of the `invoke` node.

### Input ports

- `path`, which specifes the file path or URL to the serialized board to be included.
- `graph`, which is a serialized board
- `board`, a `BoardCapability` representing a board, created by `lambda` or `import`.
- any other properties are passed as inputs for the invoked board.

### Output ports

- the outputs of the invoked board

### Example

### Implementation

- [invoke.ts]({{src_url}}invoke.ts)

## The `map` node

Given a list and a board, iterates over this list (just like your usual JavaScript `map` function), invoking (runOnce) the supplied board for each item.

### Input ports

### Output ports

### Example

### Implementation

- [map.ts]({{src_url}}map.ts)

## The `passthrough` node

This is a no-op node. It takes the input property bag and passes it along as output, unmodified. This node can be useful when the board needs an entry point, but the rest of the board forms a cycle.

### Input ports

- any properties

### Output ports

- the properties that were passed as inputs

### Example

```js
board.input().wire("say->", board.passthrough().wire("say->", board.output()));

board.runOnce({
  say: "Hello, world!",
});

console.log("result", result);
```

Will produce this output:

```sh
result { say: 'Hello, world!' }
```

See [Chapter 9: Let's build a chatbot](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard/docs/tutorial#chapter-9-lets-build-a-chat-bot) of Breadboard tutorial to see another example of usage.

### Implementation

- [passthrough.ts]({{src_url}}passthrough.ts)

## The `reduce` node

Given a list, an initial accumulator value, and a board, invokes a board (runOnce) for each item and accumulator in the list and returns the final accumulator value. Loosely, same logic as the `reduce` function in JavaScript.

### Input ports

### Output ports

### Example

### Implementation

- [reduce.ts]({{src_url}}reduce.ts)

## The `runJavascript` node

Use this node to execute JavaScript code. The node recognizes a required `code` input property, which is a string that contains the code to be executed. It also recognizes a `name` input property, which is a string that specifies the name of the function that will be invoked to execute the code. If not supplied, the `run` function name will be used.

All other input properties will be passed as arguments to the function.

The code is executed in a new V8 context in Node or a Web Worker in the browser, which means that it cannot access any variables or functions from the outside.

The node will pass the result of the execution as the `result` output property.

### Input ports

- `code` - required, must contain the code to execute
- `name` - optional, must contain the name of the function to invoke (default: `run`)
- zero or more inputs that will be passed as arguments to the function.

### Output ports

- `result` - the result of the execution

### Example

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

### Implementation

- [run-javascript.ts]({{src_url}}run-javascript.ts)

## The `secrets` node

Use this node to access secrets, such as API keys or other valuable bits of information that you might not want to store in the graph itself. The node takes in an array of strings named `keys`, matches the process environment values, and returns them as outputs. This enables connecting edges from environment variables.

### The input ports

- `keys` - required, must contain an array of strings that represent the keys to look up in the environment. If not supplied, empty output is returned.

### The output ports

- one output for each key that was found in the environment.

### Example

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

### Implementation

- [secrets.ts]({{src_url}}secrets.ts)

## The `unnest` node

### Input ports

### Output ports

### Example

### Implementation

- [unnest.ts]({{src_url}}unnest.ts)
