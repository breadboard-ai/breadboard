---
layout: docs.njk
title: Inspector API
tags:
  - general
  - wip
hide_toc: true
date: 2012-01-01 # Done to place the index atop the list.
---

The Inspector API provides a way to inspect a graph to make sense of it. Because a serialized graph representation (also known as the [BGL document](../concepts/#breadboard-graph-language-bgl)) is basically just JSON containing arrays of nodes and edges, a the actual semantics of the graph need to be added separately. This is what the Inspector API does. Think of it as the DOM API for the graph.

> [!NOTE]
> The full list of types of Inspector API can be found in [/packages/breadboard/src/inspector/types.ts](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/src/inspector/types.ts)

## Graph

The entry point for the Inspector API is the `inspect` method. It expects a `GraphDescriptor` as its first argument (the `GraphDescriptor` is the TypeScript type representing the BGL document):

```ts
import { inspect } from "@google-labs/breadboard";

// Returns an instance of `InspectableGraph`.
const graph = inspect(bgl);
```

Once we have an instance of `InspectableGraph`, we can use it to query the graph:

```ts
// Get a node by id.
// Returns an instance of `InspectableNode`.
const node = graph.nodeById("input-1");

// Get all nodes of type.
// Returns an array of `InspectableNode`.
const outputs = graph.nodesByType("output");

// Get all nodes in the graph/
// Returns an array of `InspectableNode`.
const all = graph.nodes();

// Get all entry nodes for the graph.
// Entry nodes are those that don't have incoming edges.
// Returns an array of 'InspectableNode`.
const entries = graph.entries();
```

## Nodes

The result of querying the graph is typically an instance of `InspectableNode` or an array of them. The `InspectableNode` enables examining a node in the graph:

```ts
// Get a list of incoming edges for this node.
// The incoming edges are those that are directed toward the node.
// (also known as "heads" for graph math folks)
// Returns an array of `InspectableEdge`;
const incoming = node.incoming();

// Get a list of outgoing edges for this node.
// The outgoing edges are those that originate from the node.
// (also known as "tails" for graph math folks)
// Returns an array of `InspectableEdge`;
const outgoing = node.outgoing();

// See if the node is an entry node (no incoming edges)
// Returns true or false.
const isEntry = node.isEntry();

// See if the node is an exit node (no outgoing edges)
// Returns true or false.
const isExit = node.isExit();
```

## Edges

In addition to `InspectableNode`, the API may return `InspectableEdge`, which
represents the edge in a graph. For example, the `InspectableGraph.edges` method returns a list of all edges within a graph:

```ts
// Returns an array of `InspectableEdge`.
const edges = graph.edges();
```

The `InspectableEdges` provides access to two instances of `InspectableNode` that the underlying edge is connecting as well as the names of the ports:

```ts
// The outgoing node of the edge (aka the "tail")
// Returns an instance of `InspectableNode`.
const from = edge.from;

// The name of the port of the outgoing edge.
// Returns string.
const out = edge.out;

// The incoming node of the edge (aka the "head")
// Returns an instance of `InspectableNode`.
const to = edge.from;

// The name of the port of the incoming edge.
// Returns string.
const inPort = edge.in;
```

## Kits

At runtime, graphs invoke the nodes during traversal. The actual functions that are being invoked are stored in kits (collections of nodes). We can optionally supply kits to the inspector so that we can examine their contents. The second, optional `InspectableGraphOptions` argument to `inspect` has a member `kits` that gives us a way to specify the kits for the graph:

```ts
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";

const graph = inspect(bgl, { kits: [asRuntime(Core), asRunTime(JSONKit)] });
```

Once the kits are supplied, we can inspect them using the `kits` method, which returns a list of inspectable kits:

```ts
// Returns an array of `InspectableKit`.
const kits = graph.kits();
```

Each item in the list of kits has properties to inspect the kit it represents, such as the data structure that contains the kit metadata (title, version, url, description) and the list of node types that the kit contains:

```ts
for (const kit of kits) {
  const { title } = kit.descriptor;
  // Prints the kit title.
  console.log(`Kit: ${title}`);
  for (const nodeType of kit.nodeTypes) {
    // Do something with node types...
  }
}
```

The `nodeTypes` of the `InspectableKit` contains a list of items each representing a node type contined within a kit. An item has two methods: one to get the type of the node, and the other is an asynchronous method to query the ports that will be available on the node of this type when it has no edges.

```ts
// Returns string.
const type = nodeType.type();
// Async, returns `Promise<InspectablePorts>`.
const ports = await nodeType.ports();
```

For a discussion on ports and how to use them, see the section below.

## Ports

Each node has a set of ports that it expects as inputs and a set of ports it expect as outputs.

The Inspector API provides a way to examine the expected ports of any node within a graph with the `InspectableNode.ports` method. Calling this method will give two lists of ports for a node:

```ts
// Async, returns Promise<InspectableNodePorts>.
const ports = await node.ports();
```

This method also takes an optional `InputValues` argument that can be useful for some types of nodes that change their input/output port configuration based on the inputs.

```ts
// Given this argument, the `promptTemplate` node will parse the template,
// see that it needs a `name` value to correctly fill in the template,
// and change its shape to expect `name` as an additional input port
const promptTemplatePorts = await promptTemplate.ports({
  template: "Hello {% raw %}{{name}}{% endraw %}!",
});
```

For convenience, the method will supply a node's configured values as inputs by default. This means that if the `template` in example above is part of node's configuration, we don't have supply it again as argument.

The resulting of `InspectableNodePorts` provides access to two members, `inputs` and `outputs`. Both are the instances of `InspectablePortList`:

```ts
const ports = await node.ports();

// Returns `InspectablePortList`
const inputs = ports.inputs;

// Returns `InspectablePortList`
const outputs = ports.outputs;
```

The `InspectablePortList` instance has gives us access to an array of `InspectablePort` via the `ports` property, representing the input or output ports of the node as well as the `fixed` property.

```ts
// Returns an array of `InspectablePort`.
const inputPorts = inputs.ports;

// Returns `true` or `false`.
const areInputsFixed = inputs.fixed;
```

The `fixed` property teturns `true` if the list of ports is fixed and `false` if the node expects a dynamic number of ports.

For example, the value will be `true` for the `json.validateJson` input ports, since it has two fixed input ports: `json` and `schema`.

```ts
const validateJsonPorts = await validateJson.ports();
// Prints `true`.
console.log(validateJsonPorts.inputs.fixed);
```

Conversely, the `core.invoke` node will have dynamic number of ports, because it passes its inputs to the invoked graph as arguments.

```ts
const invokePorts = await invoke.ports();
// Prints `false`.
console.log(invokePorts.inputs.fixed);
```

The `InspectablePort` instance gives us a sense of the state of the port of a node within a graph. The `ports` method computes this state based on the incoming and outgoing edges for the node, what the node expects as its inputs and outputs, as well as its configured values.

```ts
const inputPorts = (await node.ports()).inputs.ports;
const firstInputPort = inputPorts[0];
```

We can get the name of the port:

```ts
// Returns string.
const name = firstInputPort.name;
```

For input ports, we can see if the port's value was specified in node's configuration (`true`) or if it is specified by the incoming edge (`false`). The value is
always `false` for the output ports.

```ts
// Returns `true` if the port was specified in the node's configuration
const configured = firstInputPort.configured;
```

We can get the [JSON schema](https://json-schema.org/) of the port:

```ts
// Returns `Schema`.
const schema = firstInputPort.schema;
```

We can check if this is the "star port".

```ts
// Returns boolean
const star = firstInputPort.star;
```

Every node will have a single star port as part of its input and output port lists. The star port is a port that is only used to connect the "star edge": the one that is represented by the `*` port name.

> [!NOTE]
> The star edge is special in that it communicates that all output port values of one node will be supplied as input port values of another node. Since it is not always possible to know what those values are without actually running the graph, using star edges means that we might not be able to determine whether or not the input ports are specified as expected.

Most importantly, we can get the status of the port:

```ts
// Returns a `PortStatus` instance.
const status = firstInputPort.status;
```

The port status can be one of the following values:

- `PortStatus.Connected` -- the port is correctly connected to another node or specified using node's configuration, according to this node's schema.

- `PortStatus.Ready` -- the port is not connected to another node, and it is expected, but not required by the node's schema.

- `PortStatus.Missing` -- the port is not connected to another node, but it is required by the node's schema. It is similar to "Ready", except that not having this port connected is an error.

- `PortStatus.Dangling` -- the port is connected to this node, but it is not expected by the node's schema. This is another error state.

- `PortStatus.Indeterminate` -- the port status impossible to determine. This only happens when the node has an incoming star edge and the port is not connected.

> [!NOTE]
> If the `kits` option isn't supplied, the `ports` method will presume that the node does not have any expectations for its inputs or outputs. All ports will have the `PortStatus.Connected` state.

## Subgraphs

Some nodes may represent entire subgraphs. For instance, `core.invoke` node takes a `board` as its argument, and invokes that graph, passing its own inputs to this subgaph and returning its results as own outputs.

> [!TIP]
> Make sure that when calling `inspect`, the BGL document argument has the `url` property set to
> a valid URL that represents the current location of this graph. It will enable nodes that do loading as part of describing themselves (such as `core.invoke`) to correctly resolve any relative paths that might be given as their inputs.
>
> This value will be automatically set when loading a BGL file using the `BoardRunner.load` method.

It is the responsibility of the respective nodes to provide an accurate description of their input and output ports.

For instance, when `core.invoke` is asked to describe itself -- and provided it has all the necessary information, and the BGL document has a valid `url` property, -- it will show the invoked graph's inputs and outputs as its own ports.
