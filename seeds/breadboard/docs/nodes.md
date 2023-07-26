## Built-in Nodes

Here are some node handlers that are seen as core to the process of graph traversal.

### `input`

Use this node to ask for input from inside the graph. The application that asked to run the board needs to supply it.

The node takes a property bag as its input and passes it along to the next node, unmodified.

#### Example:

```js
board.input().wire("say->", board.output());

board.runOnce({
  say: "Hello, world!",
});

console.log("result", result);
```

Will produce this output:

```sh
result { say: 'Hello, world!' }
```

### `output`

Use this node to get data out of the graph. takes a property bag and sends it back to the applciation that ran the board, unmodified.

See above for the example.

### `passthrough`

This is a no-op node. It takes the input property bag and passes it along as output, unmodified. This node can be useful when the graph needs an entry point, but the rest of the graph forms a cycle.

### `include`

Use this node to include other graphs into the current graph. It recognizes two properties in the input property bag:

- `path`, which specifes the file path to the graph to be included. This property is required.
- `slotted`, which specifies slotted graphs that will be used to populate `slot` nodes in the included graph. This property is optional.

The rest of the inputs in the property bag are passed along to the included graph as its inputs. The outputs of the included graph will be passed along as outputs of the `include` node.

This enables treating the included graph as a kind of a node: it takes inputs (aside from `path` and `slotted` properties) and provides outputs.

### `slot`

Use this node to specify a slot in a graph. Adding a `slot` node turns a graph into a template: each slot represents a placeholder that must be filled in when the node is included into another graph.

The node takes a `slot` property, which specifies the name of the slot, and passes the rest of arguments to the slotted graph. The value of the `slot` property is used to match the slot with one of the slotted graphs that is passed to the `include` node.

### `reflect`

This node is used to reflect the graph itself. It has no required inputs and provides a JSON representation of the graph as a `graph` output property. This can be used for building nodes to study the graph and its structure.
