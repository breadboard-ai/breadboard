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

Use this component to fetch data from the Internet. Implementation-wise, this is a wrapper around [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) with a few Breadboard-specific tweaks.

The tweaks are:

- When "Content-Type" is specified as "multipart/form-data", the value passed into the **Body** port is treated as a key/value object representing [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) properties and their values.

- Before sending the request, all [Data store lightweight handles](/breadboard/docs/reference/data-store/) are converted to base64 encoded strings or multipart encoded chunks, depending on the content type.

- After receiving the response, any [blob]() responses are converted to [Data Store lightweight handles](/breadboard/docs/reference/data-store/).

### Input ports

The component has the following input ports.

- **URL** (id: `url`) -- required, the URL to fetch.

- **Method** (id: `method`) -- string (optional), the request [method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods). Default is `GET`.

- **Headers** (id: `headers`) -- object (optional), a set of [request headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers). Default is empty.

- **Body** (id: `body`) -- object (optional), the [request body](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#body). Default is empty.

- **Raw** (id: `raw`) -- boolean (optional), specifies whether or not to return raw text (`true`) or parse the response as JSON (`false`). The default value is `false`.

- **Stream** (id: `stream`) -- boolean (optional), specifies whether the response is expected to be a stream. The default value is `false`.

### Output ports

- **Content Type** (id: 'contentType') -- contains response content type.

- **Response** (id: `response`) -- the response from the server. If `raw` is `false` (which it is by default) and content type is `application/json`, the response will be parsed as JSON.

- **Response Headers** (id: `responseHeaders`) -- contains [response headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers).

- **Status** (id: `status`) -- contains [response status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

- **Status Text** (id: `statusText`) -- contains response status text.

### Example

In the board above, the `fetch` component makes a call to Wikipedia [open search API](https://www.mediawiki.org/wiki/API:Opensearch) and then passes the response to the output.

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

Invokes (using "[run as component](/breadboard/docs/reference/runtime-semantics/#run-as-component-mode)" runtime mode) specified board, supplying remaining incoming wires as input ports for that board. Returns the outputs of the board as its own output ports.

Use this component to invoke another board from your board.

### Input ports

This component has a single static input port and multiple dynamic ports.

- **Board** (id: `$board`) -- required, a board to run. The board can be specified as a URL to the [BGL file](/breadboard/docs/concepts/#breadboard-graph-language-bgl), or as BGL directly.

- all other wired in ports are passed as the input values for the board.

### Output ports

The output ports of this component are the outputs of the invoked board.

### Example

In the board above, the `invoke` component is used to invoke this board:

{{ "/breadboard/static/boards/kits/example-simple-greeting.bgl.json" | board }}

Following the semantics of the "run as component" mode, all inputs of the invoked board are populated by the input ports of the `invoke` component input ports, and all outputs of the invoked board are passed as output ports.

> [!TIP]
> Note how "Name" and "Location" input ports, as well as the "Greeting" output ports pop up in the Visual Editor when the "Board" input port is populated. This is the key property of the "[run as component](/breadboard/docs/reference/runtime-semantics/#run-as-component-mode)" mode: the board API is declarative and can be statically described.

### Implementation

- [invoke.ts]({{src_url}}invoke.ts)

## The `map` component

{{ "/breadboard/static/boards/kits/core-map.bgl.json" | board }}

Given a list items and a board, runs the board in "[run as component](/breadboard/docs/reference/runtime-semantics/#run-as-component-mode)" mode for each item in the list. Similar in to JavaScript [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) function, except boards run in parallel.

When running the board, the `map` component will supply three inputs with these ids:

- `item` -- the item from the list
- `index` -- the index of the item in the list
- `list` -- the entire list.

This very is similar to the arguments of the JavaScript [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) function.

### Input ports

The component has two statically defined input ports:

- **Board** (id: `board`) -- required, a board to run. The board can be specified as a URL to the [BGL file](/breadboard/docs/concepts/#breadboard-graph-language-bgl), or as BGL directly.

- **List** (id: `list`) -- optional, an array of items to supply to the board as inputs.

### Output ports

The component has one statically defined output port:

- **List** (id: `list`) -- optional, an array of results from each board's run.

### Example

Given this board that creates a simple greeting given a name and location:

{{ "/breadboard/static/boards/kits/example-simple-greeting.bgl.json" | board }}

We can use the `map` component to print out a set of greetings for a bunch of people.

{{ "/breadboard/static/boards/kits/core-map.bgl.json" | board }}

> [!TIP]
> The [`curry`](#the-curry-component) component and `map` component often go hand in hand, just like in the example above. Currying provides a convenient way to pass unchanging arguments to the board that is being invoked multiple times via `map`.

### Implementation

- [map.ts]({{src_url}}map.ts)

## The `passthrough` component

{{ "/breadboard/static/boards/kits/core-passthrough.bgl.json" | board }}

This is a no-op component. It takes the input port values and passes them along as output port values, unmodified. Just like any [no-op statement](<https://en.wikipedia.org/wiki/NOP_(code)>) in programming, this component comes in handy in various situations, like when the board needs an entry point, but the rest of the board forms a cycle.

### Input ports

- any ports that are wired in.

### Output ports

- the mirror of the ports wired in.

### Implementation

- [passthrough.ts]({{src_url}}passthrough.ts)

## The `reduce` component

{{ "/breadboard/static/boards/kits/core-reduce.bgl.json" | board }}

Given a list, an initial accumulator value, and a board, invokes a board in ["run as component"](https://breadboard-ai.github.io/breadboard/docs/reference/runtime-semantics/#run-as-component-mode) mode for each item and accumulator in the list, returning the final accumulator value. Loosely, same logic as the [`Array.prototype.reduce`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) function in JavaScript.

When running the board, the `reduce` component will supply input values with the following ids:

- `accumulator` -- the current accumulated result
- `item` -- the item in the list

In the outputs, it will look for the output values with the following ids:

- `accumulator` -- the new accumulated result.

### Input ports

The `reduce` component has three static input ports:

- **Accumulator** (id: `accumulator`) -- optional, the initial value of the accumulator that will be supplied along with the first item in the list.

- **Board** (id: `board`) -- required, a board to run. The board can be specified as a URL to the [BGL file](/breadboard/docs/concepts/#breadboard-graph-language-bgl), or as BGL directly.

- **List** (id: `list`) -- optional, a list to reduce over.

### Output ports

The component has one static output port:

- **Accumulator** (id: `accumulator`) -- the final accumulated value.

### Example

Let's suppose we want to research a few topics on Wikipedia, and get a bunch of links for each topic. First, we'll build a board that fits the shape required by the `reduce` component. This board will query Wikipedia for one topic.

{{ "/breadboard/static/boards/kits/example-search-wikipedia.bgl.json" | board }}

Then, we can use another board that makes it run over a list of topics using the `reduce` component.

{{ "/breadboard/static/boards/kits/core-reduce.bgl.json" | board }}

### Implementation

- [reduce.ts]({{src_url}}reduce.ts)

## The `runJavascript` component

{{ "/breadboard/static/boards/kits/core-run-javascript.bgl.json" | board }}

Use this component to execute JavaScript code. It is particularly useful for manipulating data between other components or adding other kinds of logic to your boards.

> [!NOTE]
> The code is executed in a new V8 context in component or a Web Worker in the browser, which means that it cannot access any variables or functions from outside the context in which it is run.

The key input port is **Code**, which contains the code to execute. The code must be a JS function. When the component is run, the function is called with a single argument, which is an object with each key holding a value of the ports that are wired in:

```ts
type PortName = string;
// Each key in this object is an input port name that is wired in,
// and the value is the value that was passed into this port.
type InputValues = Record<PortName, JsonSerializable>;
```

The name of the function is specified by the **Function Name** port and is `run` by default.

> [!TIP]
> Unless there's a specific need to do so, leave **Function Name** port value as default.

Depending on the value of the **Raw Output** port, the return value of the called function is interpreted in two different ways:

- When **Raw Output** value is `false` (default), the result of function is passed as the **Result** output port of the `runJavascript` component. This is the most common scenario, where one or more inputs into the component are transformed into a single output port. The output value must be JSON-serializable, since it is shuttled across the Web Worker (or V8 context) boundary:

```ts
function run(inputs: InputValues): JsonSerializable {
  return "This will be a `Result` port value";
}
```

- When **Raw Output** value is `true`, the result of the function is treated as an object where each key represents an output port for the `runJavascript` component. The value that corresponds to that key will be passed as port's value out of the component.

```ts
// Each key is an output port name that is wired out,
// and the value is a JSON-serializable value that is
// passed out of this port.
type OutputValues = Record<PortName, JsonSerializable>;

function run(inputs: InputValues): OutputValues | Promise<OutputValues> {
  return {
    yes: "This will be a value of the `yes` port",
    no: "This will be a value of the `no` port",
  };
}
```

To aid with specifying the input and output ports, there are two additional configuration ports: **Input Schema** and **Output Schema**, respectively.

### Input ports

The component has the following static input ports:

- **Code** (id: `code`) -- required, contains the function to call.
- **Function Name** (id: `name`) -- optional, the name of the function to call (default: `run`)
- **Raw Output** (id: `raw`) -- optional, whether (`true`) or not (`false`) to treat the result of the function call as an object with port values (default: `false`).
- **Input Schema** (id: `inputSchema`) -- optional, defines additional input ports wired into this component instance
- **Output Schema** (id: `outputSchema`) -- optional, defines additional output ports wired out of this component instance. Only relevant when **Raw Output** is set to `true`.

The component may have zero or more dynamically wired ports, each passed as part of the function argument.

### Output ports

The component has either a single or no static output ports:

- **Result** (id: `result`) - the return value of the function call, when the **Raw Output** is `false`.

When the **Raw Output** is `true`, the output ports are all dynamic and are defined as keys of object, returned by the called function.

### Example

The board above is a very simple string splitter. The body of the function is:

```js
function run({ topics }) {
  return topics.trim().split("\n");
}
```

The component uses the default **Raw Output** = `false` value, and so the return value of the function becomes the **Result** port value.

Let's consider a bit more elaborate example. Suppose we want to create a router: a way to choose which path to take within a board. This is a very common pattern in Breadboard, because such routing enables a board to perform different actions depending on the inputs it receives.

In this example, we check to see if the list of topics we supplied has only one item, and if so, we print out an output message stating that. Otherwise, we print the list of topics.

{{ "/breadboard/static/boards/kits/example-simple-router.bgl.json" | board }}

The **Raw Output** port is set to `true` and the body of the function is:

```js
function run({ topics }) {
  const list = topics.trim().split("\n");
  if (list.length < 2) {
    return {
      message: "Please supply more than one topic.",
    };
  }
  return { list };
}
```

Instead of returning just a value, we return an object with ports as keys and port values.

### Implementation

- [run-javascript.ts]({{src_url}}run-javascript.ts)

## The `secrets` component

{{ "/breadboard/static/boards/kits/core-secrets.bgl.json" | board }}

Use this component to access sensitive data, such as API keys or other valuable bits of information that you might not want to store in the board. The component takes in an array of strings as input port **Keys**, looks for these keys in its store and, if found, returns them as outputs.

> [!NOTE]
> Different implementations of Breadboard will use their own strategies for retrieving secrets. The Visual Editor opts to ask the user whenever it runs into a need for a secret, and then stores these secrets in browser local storage.

### The input ports

- **Keys** (id: `keys`) - required, must contain an array of strings that represent the keys to look up in the environment. If not supplied, an empty output is returned.

### The output ports

- one output port for each key that was found.

### Example

The board above makes a Gemini API call to [list models](https://ai.google.dev/api/models#method:-models.list). To do this, it first retrieves a `GEMINI_KEY` secret and then uses the [`fetch` component](#the-fetch-component) to get the results.

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
