---
layout: docs.njk
title: Inputs and Outputs
tags:
  - general
  - wip
hide_toc: true
date: 2023-02-20 # Done to place the index atop the list.
---

Every node has inputs and outputs. A node consumes its inputs and produces outputs.

## Ports

The inputs and outputs of a node represented by ports. The inputs of a node is a set of ports, and the outputs of a node is a set of ports.

Each port has a name and a value that it consumes or produces. If a port consumes a value, it's an input port. If a port produces a value, it's an output port.

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
  name: inputs.name,
});
```

## Port expectations

Typically, a node expects some of its ports to be wired in (or configured) and wired out. Nodes may require some (or all) of their inputs ports to be wired in order to produce outputs.

Based on these expectations, any given port can be in one of the four states:

- **Connected** -- the port is correctly connected to another port or specified via configuration in accordance to node's expectations.

- **Ready** -- the port is not connected to another node, and it is expected, but not required by the node.

- **Missing** -- the port is not connected to another node, but it is required by the node. It is similar to "Ready", except that not having this port connected is an error.

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

The number of the input ports that a node expects can be thought of as a "shape" of a node. While many nodes have a fixed shape, some may change their mind about the input ports it expects based on the input ports that are wired into them.

A good example of such a shape-shifting node is `promptTemplate`. It has one required input port named `template`. The value that comes into this port is expected to contain a string with simple handlebar-style placeholders.

For each placeholder in this string, a required input is added to the expected input ports.

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

Speaking of special ports... every node has an `$error` port, which outputs a value when the node throws an error. This is a very useful way to catch errors.

## Specifying node schema

Node expectations are expressed with [JSON Schema](https://json-schema.org/).

TODO
