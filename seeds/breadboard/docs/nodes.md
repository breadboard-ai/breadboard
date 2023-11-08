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
