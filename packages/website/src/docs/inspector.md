---
layout: docs.njk
title: Inspector API
tags:
  - general
  - wip
hide_toc: true
date: 2012-01-01 # Done to place the index atop the list.
---

The Inspector API provides a way to inspect a graph to make sense of it. Because a serialized graph representation (also known as the BGL document) is basically just JSON containing arrays of nodes and edges, a the actual semantics of the graph need to be added separately. This is what the Inspector API does. Think of it as the DOM API for the graph.

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

## Ports

At runtime, graphs invoke the nodes during traversal. Each node has a set of ports that it expects as inputs and a set of ports it expect as outputs.

The Inspector API provides a way to examine the expected ports of any node within a graph. In order to do that, the API needs to know all Kits (collections of nodes) that will are used by supply the nodes for the graph. The second, optional `InspectableGraphOptions` argument to `inspect` has a member `kits` that gives us a way to specify the kits for the graph:

```ts
import Core from "@google-labs/core-kit";
import JSONKit from "@google-labs/json-kit";

const kits = [asRuntime(Core), asRunTime(JSONKit)];
const graph = inspect(bgl, { kits });
```

Once the kits are supplied, calling `InspectableNode.ports` will give two lists of ports for a node:

```ts
// Async, returns Promise<InspectableNodePorts>.
const ports = await node.ports();
```

This method also takes an optional `InputValues` argument that can be useful for some types of nodes that change their input/output port configuration based on the inputs.

```ts
const promptTemplatePorts = await promptTemplate.ports({
  // prettier-ignore
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

We can get the JSON schema of the port:

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

> [!WARNING]
> This part of the API is still in flux. Even more than the stuff above.

Some nodes may represent entire subgraphs. For instance, `core.invoke` node takes a `board` as its argument, and invokes that graph, passing its own inputs to this subgaph and returning its results as own outputs.

To find out if a node represents a subgraph, use the `containsGraph` method of the `InspectableNode` instance:

```ts
// Returns boolean.
const containsGraph = node.containsGraph();
```

We can then load the subgraph using the `InspectableNode.subgraph` method. The loading logic is intentionally not part of the Inspector API. Instead, we must supply an loader function with the signature, specified by `InspectableGraphLoader`.

For convenience, there's a `loadToInspect` helper function that creates a basic loader for just that purpose. This helper function takes a single argument of the base URL that will be used to resolve relative paths while loading:

```ts
import { inspect, loadToInspect } from "@google-labs/breadboard";

// .. somewhere down in the code

// Returns an `InspectableGraph` instance.
const subgraph = await node.subgraph(loadToInspect(new URL(base)));
```

To help with understanding the expected inputs and outputs of a graph, the `InspectableGraph` has a `describe` method. It returns an object with two members: `inputSchema` and `outputSchema`. These objects represent what the graph expects as its inputs and its outputs.

```ts
// async, returns Promise<NodeDescriberResult>
const { inputSchema, outputSchema } = await graph.describe();
```
