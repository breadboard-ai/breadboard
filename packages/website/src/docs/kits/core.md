---
layout: docs.liquid
title: Core Kit
tags:
  - kits
  - wip
---

{% assign src_url = "https://github.com/breadboard-ai/breadboard/tree/main/packages/core-kit/src/nodes/" %}

This is the kit that provides the most fundamental building blocks for Breadboard. The component it provides tend to be fairly low-level. Think of these components as indivisible atoms of Breadboard universe, or as the plumbing that makes everything run. Many of the other components (all of the [Agent Kit](/breadboard/docs/kits/agents/) components, for example) are created by wiring using these together.

> [!TIP]
> Most of these components are closer to actual programming than just dragging and dropping high-level components. Expect climbing a learning curve to get comfortable using them.

## The `curry` component

{{ "/breadboard/static/boards/kits/core-curry.bgl.json" | board }}

Takes a board and bakes in (or [curries](https://en.wikipedia.org/wiki/Currying), using the computer science term) the supplied port inputs into it. Very useful when we want to invoke a board with the same input values many times (like with [`map`](#the-map-component)).

### Input ports

The `curry` component has a single input port plus any number of additional ports.

- **Board** (id: `$board`) -- the board to curry the values into. This port has the `board` behavior and will accept a URL of the board or the actual BGL of the board.

Values supplied with any additional ports will be curried into the output board.

### Output ports

The component has a single output port.

- **Board** (id: `board`) -- the resulting curried board.

### Example

Let's suppose that we have this board that creates a simple greeting given a name and location, using the [`promptTemplate`](/breadboard/docs/kits/templates/) component.

{{ "/breadboard/static/boards/kits/example-simple-greeting.bgl.json" | board }}

If we need to print out a set of greetings for a bunch of people visiting from the same location, we can use the `curry` component to bake the Location information into the board and then call it multiple times with a different name.

{{ "/breadboard/static/boards/kits/core-curry.bgl.json" | board }}

> [!TIP]
> The `curry` component is also useful for introspecting boards: you can use it to load a board via a URL and then examine the output as [BGL](/breadboard/docs/concepts/#breadboard-graph-language-bgl).

### Implementation

- [curry.ts]({{src_url}}curry.ts)

## The `deflate` component

{{ "/breadboard/static/boards/kits/core-deflate.bgl.json" | board }}

This component converts all [inline data to stored data](/breadboard/docs/reference/data-store/), saving memory. Useful when working with multimodal content.

### Input ports

The component has a single input port.

- **Data** (id: `data`) -- the data to scan and convert all instances of inline base64-encoded strings to lightweight handles. Data can be of any shape.

### Output ports

The component has a single output port.

- **Data** (id: `data`) -- the result of deflating the input data. Safely passes data through if it's already stored or no inline data is present.

### Example

In the board above, a chunk of JSON is fetched. This JSON contains a base64-encoded string of an image. The `deflate` component turns it into a lightweight handle and then passes it on to output.

### Implementation

- [deflate.ts]({{src_url}}deflate.ts)

## The `fetch` component

{{ "/breadboard/static/boards/kits/core-fetch.bgl.json" | board }}

Use this component to fetch data from the Internet. Practically, this is a wrapper around [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

### Input ports

- `url` -- required, URL to fetch. For now, this component can only make a GET request.
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

## The `inflate` component

{{ "/breadboard/static/boards/kits/core-inflate.bgl.json" | board }}

Does opposite of what the [`deflate`](#the-deflate-component) component does. Scans provided data and converts all [lightweight handles to inline, base64 encoded strings](/breadboard/docs/reference/data-store/).

### Input ports

The component has a single input port.

- **Data** (id: `data`) -- the data to scan and convert all instances of lightweight handles to inline base64-encoded strings. Data can be of any shape.

### Output ports

The component has a single output port.

- **Data** (id: `data`) -- the result of inflating the input data. Safely passes data through if it's already inline or no stored data is present.

### Example

In the board above, any multimedia content supplied as input will be turned into base64-encoded strings.

### Implementation

- [inflate.ts]({{src_url}}inflate.ts)

## The `invoke` component

{{ "/breadboard/static/boards/kits/core-invoke.bgl.json" | board }}

Invokes (runOnce) specified board, supplying remaining incoming wires as inputs for that board. Returns the outputs of the board.

Use this component to invoke another board from this board.

It recognizes `path`, `graph`, and `board` properties that specify, respectively, a file path or URL to the serialized board, directly the serialized-as-JSON board, and a `BoardCapability` (returned by `lambda` or `import`).

The rest of the inputs in the property bag are passed along to the invoked board as its inputs. If other inputs were bound to the board via wires into the `lambda` or `import` component, then those have precedence over inputs passed here.

The outputs of the invoked board will be passed along as outputs of the `invoke` component.

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

## The `map` component

{{ "/breadboard/static/boards/kits/core-map.bgl.json" | board }}

Given a list and a board, iterates over this list (just like your usual JavaScript `map` function), invoking (runOnce) the supplied board for each item.

### Input ports

### Output ports

### Example

### Implementation

- [map.ts]({{src_url}}map.ts)

## The `passthrough` component

{{ "/breadboard/static/boards/kits/core-passthrough.bgl.json" | board }}

This is a no-op component. It takes the input property bag and passes it along as output, unmodified. This component can be useful when the board needs an entry point, but the rest of the board forms a cycle.

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

## The `reduce` component

{{ "/breadboard/static/boards/kits/core-reduce.bgl.json" | board }}

Given a list, an initial accumulator value, and a board, invokes a board (runOnce) for each item and accumulator in the list and returns the final accumulator value. Loosely, same logic as the `reduce` function in JavaScript.

### Input ports

### Output ports

### Example

### Implementation

- [reduce.ts]({{src_url}}reduce.ts)

## The `runJavascript` component

{{ "/breadboard/static/boards/kits/core-run-javascript.bgl.json" | board }}

Use this component to execute JavaScript code. The component recognizes a required `code` input property, which is a string that contains the code to be executed. It also recognizes a `name` input property, which is a string that specifies the name of the function that will be invoked to execute the code. If not supplied, the `run` function name will be used.

All other input properties will be passed as arguments to the function.

The code is executed in a new V8 context in component or a Web Worker in the browser, which means that it cannot access any variables or functions from the outside.

The component will pass the result of the execution as the `result` output property.

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

## The `secrets` component

{{ "/breadboard/static/boards/kits/core-secrets.bgl.json" | board }}

Use this component to access secrets, such as API keys or other valuable bits of information that you might not want to store in the graph itself. The component takes in an array of strings named `keys`, matches the process environment values, and returns them as outputs. This enables connecting edges from environment variables.

### The input ports

- `keys` - required, must contain an array of strings that represent the keys to look up in the environment. If not supplied, empty output is returned.

### The output ports

- one output for each key that was found in the environment.

### Example

Use this component to pass the `PALM_KEY` environment variable to the `text-completion` component. The input:

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

## The `service` component

{{ "/breadboard/static/boards/kits/core-service.bgl.json" | board }}

Represents an external service that can be used by the board. Useful for integrating external services with Breadboard.

### Input ports

![Service inputs](/breadboard/static/images/core-kit/service-inputs.png)

This component a single fixed "Service URL" configuration port, The endpoint at that URL must conform to [Breadboard Service Endpoint](/breadboard/docs/reference/bse/) (BSE) protocol.

Once the "Service URL" port is configured, Breadboard Visual Editor will ask the service to describe itself and use that description to supply additional input and output ports.

In the example above, the "Query" input port and "News" output port is created based on this description.

> [!NOTE]
> In addition to Breadboard Service Endpoints being able to describe themselves, they also react to configured and wired inputs, making it possible to write services whose inputs and outputs change based their configuration.

### Output ports

The output ports are defined by the Breadboard Service Endpoint.

### Example

For a sample implementation of a BSE protocol, see the [Google News Service](https://www.val.town/v/dglazkov/googlenews) on [Valtown](https://val.town), which is used in the board above.

> [!TIP]
>
> [Valtown](https://val.town) is a quick and easy to create HTTP endpoints for Breadboard services.

### Implementation

- [service.ts]({{src_url}}service.ts)

## The `unnest` component

{{ "/breadboard/static/boards/kits/core-unnest.bgl.json" | board }}

### Input ports

### Output ports

### Example

### Implementation

- [unnest.ts]({{src_url}}unnest.ts)
