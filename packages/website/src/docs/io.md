---
layout: docs.njk
title: Inputs and Outputs
tags:
  - general
  - wip
---

Every node has inputs and outputs. A node consumes its inputs and produces outputs.

The inputs and outputs of a node are each represented by a concept that we call `Ports`. These Ports are one of the fundamental building blocks of Breadboard, they define the expectations a node has of what it needs to accept to be able to run (see [Port expectations](#port-expectations)), and the shape of the data it produces.

## Ports

Each port has a name and a value that it consumes or produces. If a port consumes a value, it's an input port. If a port produces a value, it's an output port.

Each port may have type information attached to it (via the node's configuration), which is a JSON Schema and describes the shape of the value that it consumes or produces.

## Wiring ports

In Breadboard, boards are formed by wiring output ports to input ports. The values flow from the outputs to inputs.

```ts
// Here, the node named "schema" is has two input ports connected:
const createSchema = schema({
  // The "title" port, which comes from the "text" output port of the
  // "otherNode" node.
  title: otherNode.text,
  // The "context" port, which comes from the "context" output port of the
  // "inputs" node.
  context: inputs.context,
});
```

## Configuring ports

A node may have the value for their input ports specified via configuration. When an input port is configured in such a way, it acts as if it has a wire coming into it with a value that remains constant.

```ts
const template = templates.promptTemplate({
  // This port is configured: its value is specified directly as a string.
  template: "Hello, {% raw %}{{{% endraw %}person{% raw %}}}{% endraw %}!",
  // This port is wired, coming from the "inputs" node.
  person: inputs.name,
});
```

## Port expectations

Typically, a node expects some of its ports to be wired in (or configured) and wired out. Nodes may require some (or all) of their inputs ports to be wired in order to produce outputs.

Each port can be _required_ or _optional_. A required port must be wired in order for the node to produce outputs. An optional port may be wired, but it's not required.

Based on these expectations, any given port can be in one of the four states:

_Valid states:_

- **Connected** -- the port is correctly connected to another port or specified via configuration in accordance to node's expectations.

- **Ready** -- the node has defined a port that is optional and it's not currently connected.

_Error states:_

- **Missing** -- the node has defined a port is _required_ by the node _and_ is currently unconnected.

- **Dangling** -- the port is connected to this node, but it is not expected by the node. This is another error state.

For example, the `validateJson` node expects a required `json` input port, which supplies the value to validate as JSON, and an optional `schema` input port, which supplies the schema to validate against.

If we don't wire anything into this node, the port status will be as follows:

```ts
const validate = json.validateJson({
  // `json` -- Missing
  // `schema` -- Ready
});
```

If we wire in the inputs properly:

```ts
const validate = json.validateJson({
  // Connected
  json: someNode.json,
  // Connected
  schema: someSchema,
});
```

If we add another wire, we will have a dangling situation:

```ts
const validate = json.validateJson({
  // Connected
  json: someNode.json,
  // Connected
  schema: someSchema,
  // Dangling -- not expected by the node.
  bar: anotherNode.foo,
});
```

## Fixed (or not) number of input ports

A node may expect a fixed or not fixed number of input ports. In the example above, the `validateJson` has a fixed number of ports. Wiring any additional input ports will result in "Dangling" error state.

Some nodes are perfectly okay with any number of ports being wired into them. For these nodes, there isn't a fixed list of input ports. Instead, this list may shrink or grow depending on what we wire into them.

For instance, the `runJavascript` node has this quality. It accepts three optional input ports:

- `code` -- the JS code to run,

- `name` -- the name of the function to call to start running `code`, and

- `raw` -- whether or not to [spread](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax) the output of the function (poorly named, I know 🤦)

All additional input ports will be forwarded as arguments to the function specified in `name`.

```ts
const chooseMethod = core.runJavascript({
  name: "chooseMethodFunction",
  code: chooseMethodFunction.toString(),
  raw: true,
  // Extra port and perfectly okay.
  useStreaming: parameters,
});
```

## Shape-shifting nodes

The number of the input ports that a node expects can be thought of as the "shape" of a node. While many nodes have a fixed shape with a well defined set of inputs, some nodes can change their inputs at runtime based on the value that comes in to other input ports.

A good example of such a shape-shifting node is `promptTemplate`. It has one required input port named `template`. The value that comes into this port is expected to contain a string with simple handlebar-style placeholders. For each placeholder in this string, a required input is added to the expected input ports.

```ts
// No placeholders, single port expected.
const emptyTemplate = templates.promptTemplate({
  // Connected
  prompt: "Hello, person!",
});

// One placeholder, one port is missing.
const missingPortTemplate = templates.promptTemplate({
  // Connected
  prompt: "Hello, {% raw %}{{{% endraw %}person{% raw %}}}{% endraw %}!",
  // `person` -- Missing
});

// One placeholder, two ports connected
const happyTemplate = templates.promptTemplate({
  // Connected
  prompt: "Hello, {% raw %}{{{% endraw %}person{% raw %}}}{% endraw %}!",
  // Connected
  person: inputs.name,
});
```

The `input` node also does the same thing: the `schema` input port defines what other ports it may expect (and whether or not they are required).

## Star ports

There is a special pair of port that exists for every node: the star input and output ports. These ports are different from others, because they are:

- always available for connection regardless of node expectations

- can only be wired to other star ports.

## Error-handling output port

Every node has an `$error` port, which outputs a value when the node throws an error. This is a very useful way to catch errors and have your board to continue running.

```ts
const methodThatErrors = core.runJavascript({
  name: "methodThatErrors",
  code: `function methodThatErrors({ text }) {
    console.log(text);
    throw new Error("This is an error");
  }`,
  text,
});

return methodThatErrors.$error.to(base.output({ $id: "error" }));
```

## Specifying node schema

Node expectations are expressed with [JSON Schema](https://json-schema.org/).

TODO

## Input Bubbling

TODO
