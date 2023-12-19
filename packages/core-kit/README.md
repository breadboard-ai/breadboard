# Breadboard Core Kit

![Milestone](https://img.shields.io/badge/milestone-M3-red) ![Stability](https://img.shields.io/badge/stability-wip-green)

A [Breadboard](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/) Kit containing nodes that enable composition and reuse of boards.

## Node Reference

This kit contains the following nodes:

## The `append` node

Use this node to accumulate local state, like context in a prompt.

The node looks for property called `accumulator` in its input. All other properties are appended to this property, and returned as `accumulator` output property.

The way the properties are appended depends on the type of the `accumulator` input property.

If the `accumulator` property is "string-ey" (that is, it's a `string`, `number`, `boolean`, `bigint`, `null` or `undefined`), the properties will be appended as strings, formatted as `{{property_name}}: {{proprety_value}}` and joined with "`\n`".

If the `accumulator` property is an array, the properties will be appended as array items, formatted as `{{property_name}}: {{proprety_value}}`,

Otherwise, the `accumulator` property will be treated as an object and the properties will be added as properties on this object.

### Example

If we send the `append` node an input of `Question` with the value of `How old is planet Earth?` and the `accumulator` value of `\n`:

```json
{
  "accumulator": "\n",
  "Question": "How old is planet Earth?"
}
```

We will see the following output:

```json
{
  "accumulator": "\n\nQuestion: How old is planet Earth?"
}
```

If we send the node an input of `Question` with the value of `How old is planet Earth?` and the `accumulator` value of `[]`:

```json
{
  "accumulator": [],
  "Question": "How old is planet Earth?"
}
```

We will get the output:

```json
{
  "accumulator": ["Question: How old is planet Earth?"]
}
```

If we send the node an input of `Question` with the value of `How old is planet Earth?` and the `accumulator` value of `{}`:

```json
{
  "accumulator": {},
  "Question": "How old is planet Earth?"
}
```

We'll get the output of:

```json
{
  "accumulator": {
    "Question": "How old is planet Earth?"
  }
}
```

#### Implementation:

- [src/nodes/append.ts](src/nodes/append.ts)

## The `passthrough` node

This is a no-op node. It takes the input property bag and passes it along as output, unmodified. This node can be useful when the board needs an entry point, but the rest of the board forms a cycle.

### Example:

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

See [Chapter 9: Let's build a chatbot](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-9-lets-build-a-chat-bot) of Breadboard tutorial to see another example of usage.

### Inputs

- any properties

### Outputs

- the properties that were passed as inputs

## The `invoke` node

Use this node to invoke another board from this board.

It recognizes `path`, `graph`, and `board` properties that specify, respectively, a file path or URL to the serialized board, directly the serialized-as-JSON board, and a `BoardCapability` (returned by `lambda` or `import`).

The rest of the inputs in the property bag are passed along to the invoked board as its inputs. If other inputs were bound to the board via wires into the `lambda` or `import` node, then those have precedence over inputs passed here.

The outputs of the invoked board will be passed along as outputs of the `invoke` node.

### Inputs

- `path`, which specifes the file path or URL to the serialized board to be included.
- `graph`, which is a serialized board
- `board`, a `BoardCapability` representing a board, created by `lambda` or `import`.
- any other properties are passed as inputs for the invoked board.

### Outputs

- the outputs of the invoked board

## The `import` node

Creates a lambda board from a pre-existing board, either loaded from `path` or passed as JSON via `graph`. All other inputs are bound to the board, which is returned as `board`.

### Inputs

- `path`, which specifes the file path or URL to the serialized board to be included.
- `graph`, which is a serialized board
- all other inputs are bound to the board

### Outputs

- `board`, a `BoardCapability`, which can be passed to `invoke` and other nodes that can invoke boards.

## The `include` node (DEPRECATED)

DEPRECATED: Use `invoke` instead

Use this node to include other board into the current board. It recognizes `path` or `$ref` properties that specify, respectively, file path or URL to the serialized-as-JSON board to be included. It also accepts the `slotted` property that must contain the serialized-as-JSON boards that will be slotted into the included board.

The rest of the inputs in the property bag are passed along to the included board as its inputs. The outputs of the included board will be passed along as outputs of the `include` node.

This enables treating the included board as a kind of a node: it takes inputs and provides outputs.

### Example

For an example of how to use the `include` property, see [Chapter 5: Including other boards](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-5-including-other-boards) of Breadboard tutorial.

### Inputs

- `path`, which specifes the file path to the serialized board to be included. Either this or `$ref` property is required.
- `$ref`, which specifes the URL of the serialized board to be included. Ether this or `path` property is required.
- `slotted`, which specifies slotted boards that will be used to populate `slot` nodes in the included board. This property is optional.
- any other properties are passed as inputs for the included board.

### Outputs

- the outputs of the included board

## The `slot` node (DEPRECATED)

DEPRECATED. Instead pass boards either as URLs or as Boards from `lambda` and `invoke` them.

Use this node to make a slot in a board. Adding a `slot` node turns a board into a sort of a template: each slot represents a placeholder that must be filled in when the node is included into another board.

The node takes a `slot` property, which specifies the name of the slot, and passes the rest of arguments to the slotted board. The value of the `slot` property is used to match the slot with one of the slotted board that is passed to the `include` node.

### Example

For an example of how to use the `slot` node, see [Chapter 6: Boards with slots](https://github.com/breadboard-ai/breadboard/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of Breadboard tutorial.

### Inputs

- `slot` - the name of the slot
- any other properties are passed as inputs for the slotted board

### Outputs

- the outputs of the included board

## The `reflect` node

This node is used to reflect the board itself. It has no required inputs and provides a JSON representation of the board as a `graph` output property. This node can be used for getting information that might be stored in the structure of the board.

### Example

```js
import { Board } from "@google-labs/breadboard";

const board = new Board();

board.input().wire("", board.reflect().wire("graph->", board.output()));

const result = await board.runOnce({});
console.log("result", result);
```

will print:

```sh
result {
  graph: {
    edges: [ [Object], [Object] ],
    nodes: [ [Object], [Object], [Object] ],
    kits: []
  }
}
```

### Inputs

- ignored

### Outputs

- `graph` -- JSON representation of the board
