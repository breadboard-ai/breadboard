# Breadboard's built-in nodes

To make boards run, we'll need to place nodes on them and then wire them together.

We can load various kits (like the [LLM Starter Kit](https://github.com/google/labs-prototypes/tree/main/seeds/llm-starter)) to get interesting node types. However, some node types are available without loading any kits.

These nodes make boards usable and easy to work with.

## The `input` node

Use this node to ask for input. The program that asked to run the board needs to supply it.

The node takes a property bag as its input and passes it along to the next node, unmodified.

### Example:

```js
board.input().wire("say->", board.output());

const result = await board.runOnce({
  say: "Hello, world!",
});

console.log("result", result);
```

Will produce this output:

```sh
result { say: 'Hello, world!' }
```

### Inputs:

- none

### Outputs:

- properties that are supplied by the program that runs the board.

## The `output` node

Use this node to get data out of the board. takes a property bag and sends it back to the applciation that ran the board, unmodified.

### Example:

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

### Inputs:

- any properties that the board wants to present to the program that runs the board.

### Outputs:

- none.

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

See [Chapter 9: Let's build a chatbot](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-9-lets-build-a-chat-bot) of Breadboard tutorial to see another example of usage.

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

## The `lambda` node

Use this node to create a lambda board that can be passed around and eventually invoked by e.g. the `invoke` node.

Any inputs other than `board` are bound to the lambda board and will be inputs to the board once it is invoked. This is useful to bind configurations to the lambda board, so that those are not needed whereever it is eventually invoked.

The `board` input is technically a `BoardCapability`, but in practice you'll either pass a `Breadboard` instance (which will be converted to a `BoardCapability` under the hood) or inline define functions:

This node accepts as parameter a JS function of type `LambdaFunction` that gets three parameters: `board` (the board created under the hood), `input` and `output` (respectively the corresponding nodes already placed on the board). This allows an easy way to create nested boards, mimicking the typical closure syntax of JS lambdas.

The real power is that you can wire data directly into this function, and that this data is then bound to the lambda and available wherever the baord is invoked!

Examples:

```js
const kit = board.addKit(Starter);
const template = board.passthrough({ template: "{{foo}}: {{bar}}"});

const lambda = board.lambda((board, input, output) => {
  const prompt = kit.promptTemplate();
  input.wire("foo->", prompt);
  input.wire("bar->", prompt);
  template.wire("template->.", prompt);
  prompt.wire("prompt->", output);
});
// ...
board.invoke({ board: lambda })
  .wire("foo<-", fooSource);
  .wire("bar->", barSource);
  .wire("prompt->text", llm);
```

wbich behaves like this (note that we now pass a `Board` to `lambda` and that `template` is passed as input to that board via wires into the `lambda` node instead of being directly wired).

```js
const template = board.passthrough({ template: "{{foo}}: {{bar}}"});

const lambdaBoard = new Board();
{
  const kit = lambdaBoard.addKit(Starter);

  const input = lambdaBoard.input();
  const prompt = kit.promptTemplate();
  input.wire("foo->", prompt);
  input.wire("bar->", prompt);
  input.wire("template->.", prompt);
  prompt.wire("prompt->", lambdaBoard.output());
}

const lambda = board.lambda(lambdaBoard).wire("template<-", template);
// ...
board.invoke({ board: lambda })
  .wire("foo<-", fooSource);
  .wire("bar->", barSource);
  .wire("prompt->text", llm);
```

### Inputs

- `board`, a `BoardCapability`, which is typically created via the synctactic sugar described above.

### Outputs

- `board`, a `BoardCapability`, which can be passed to `invoke` and other nodes that can invoke boards.

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

For an example of how to use the `include` property, see [Chapter 5: Including other boards](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-5-including-other-boards) of Breadboard tutorial.

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

For an example of how to use the `slot` node, see [Chapter 6: Boards with slots](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-6-boards-with-slots) of Breadboard tutorial.

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
