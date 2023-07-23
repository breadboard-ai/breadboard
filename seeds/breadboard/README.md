# Breadboard

A library for prototyping generative AI applications.

This library was inspired by the hardware maker community and their boundless creativity, how makers just wire stuff together and make amazing things with off-the-shelf parts and a [breadboard](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all).

This library is an attempt to bring the same spirit of creativity and simplicity to making generative AI applications.

## Installing the library

To install the library, run:

```sh
npm install @google-labs/breadboard
```

You will also likely need the LLM Starter Kit:

```sh
npm install @google-labs/llm-starter
```

## A quick start

At the heart of the library is the concept of a `Board`. Just like for hardware makers, the `Board` is the place where wiring of a prototype happens.

To create a board:

```js
import { Board } from "@google-labs/breadboard";

const board = new Board();
```

Now that you have a board, you can place nodes on it. Think of nodes as the spiritual equivalent of hardware components that a maker might buy at the RadioShack. They are the building blocks of your application.

Let's place a node on the board:

```js
const input = board.input();
```

An `input` node is a node that asks for input from the user. It's a good place to start. Now let's place another node:

```js
const output = board.output();
```

Now we have two nodes on the board. Let's wire them together:

```js
input.wire("say->hear", output);
```

The statement above says: "take the `say` output of the `input` node and wire it to the `hear` input of the `output` node".

Every node has the `wire` method. It always takes two parameters:

- the first parameter describes what to wire, and
- the second parameter is the node that is being wired with the current node.

Now that we've wired our nodes, we can ask our breadboard to run:

```js
const result = await board.runOnce({
  say: "Hello, world?",
});
console.log("result", result);
```

When run, our tiny program will produce the following output:

```sh
result { hear: 'Hello, world?' }
```

> [!NOTE] What happened here? The outcome should be fairly intuitive, but let's go through the process step by step:
>
> 1. The `runOnce` method of the board takes a property bag (a JS object) as its argument.
> 2. This bag of properties is then handed to the `input` node.
> 3. The `input` node is very simple-minded: it just passes the property bag along to the next node.
> 4. This is where the wiring comes in. When we described our single wire as `text->text`, we basically said:
>    1. reach into the property bag,
>    2. fish out the `text` property, then
>    3. pass it along to the next node as `text` property.
> 5. Since the next node is the `output` node, that's the node that receives the `text` property.
> 6. The `output` node is also pretty simple. It takes the property bag it received and returns it as the of the `runOnce` method.

You can see the source of this program [here](./examples/quick-start-1.js).

## Wiring another node

This is definitely a fun little program, but it's not very useful. Let's add another node to the board. This time, we need to reach for a kit: a collection of nodes that are bundled together for a specific purpose.

Because we're here to make generative AI applications, we'll reach for the LLM Starter Kit:

```js
import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const board = new Board();
// add kit to the board
const kit = board.addKit(Starter);
```

The last line of the code snippet above is signficant: it adds the kit to the board. Calling the `addKit` method creates a new instance of the kit that is connected to our board.

Now that we have the kit on the board, we can use it to add nodes to the board:

```js
const input = board.input();
const output = board.output();
const completion = kit.textCompletion();

input.wire("ask->text", completion);
completion.wire("completion->receive", output);
```

The `textCompletion` node that we've added is a node that uses the [PaLM API]() to generate text. It takes a `text` property and returns a `completion` property.

... to be continued.

## Built-in Nodes

Here are some node handlers that are seen as core to the process of graph traversal.

### `input`

Use this node to ask for input from inside the graph. The input is supplied by an implementation of `GraphTraversalContext` that is being used for graph traversal, which is a fancy way of saying that it is up to the application that asked to traverse the graph to supply the input.

### `output`

Use this node to get data out of the graph. The output is sent to an impelmentation of `GraphTraversalContext` that is being used for graph traversal. Just like `input`, it takes a property bag and sends it off to the context, unmodified.

### `passthrough`

This is a no-op node. It takes the input property bag and passes it along as output, unmodified. This node can be useful when the graph needs an entry point, but the rest of the graph forms a cycle.

### `include`

Use this node to include other graphs into the current graph. It recognizes two properties in the input property bag:

- `path`, which specifes the file path to the graph to be included. This property is required.
- `slotted`, which specifies slotted graphs that will be used to populate `slot` nodes in the included graph. This property is optional.

The rest of the inputs in the property bag are passed along to the included graph as its inputs. The included graph will be traversed in its own context, an instance of `IncludeContext`. This context will collect all outputs of the graph and pass them along as outputs of the `include` node.

This enables treating the included graph as a kind of a node: it takes inputs (aside from `path` and `slotted` properties) and provides outputs.

### `slot`

Use this node to specify a slot in a graph. Adding a `slot` node turns a graph into a template: each slot represents a placeholder that must be filled in when the node is included into another graph.

The node takes a `slot` property, which specifies the name of the slot, and passes the rest of arguments to the slotted graph. The value of the `slot` property is used to match the slot with one of the slotted graphs that is passed to the `include` node.

### `reflect`

This node is used to reflect the graph itself. It has no required inputs and provides a JSON representation of the graph as a `graph` output property. This can be used for building nodes to study the graph and its structure.

```

```
