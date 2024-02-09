---
layout: docs.njk
title: Getting Started
tags:
  - general
  - wip
---

Breadboard supports authoring in JavaScript/TypeScript and Python (coming soon).

## Set up

Ensure you have [Node.js](https://nodejs.org/) version 18 or higher:

```sh
node -v
v21.2.0
```

Create a new workspace:

```sh
mkdir my-breadboard
cd my-breadboard
git init # Optional
npm init
```

Install the following packages from npm:

```sh
npm i @google-labs/breadboard @google-labs/core-kit @google-labs/breadboard-cli
```

`@google-labs/breadboard` is the main library used for building and running
boards. `@google-labs/core-kit` contains operations that almost every board
needs. `@google-labs/breadboard-cli` lets you run and build breadboards
directly from the command-line.

## Run your first board

Make a new file called `hello.json`:

```json
{
  "nodes": [
    {
      "id": "input-1",
      "type": "input"
    },
    {
      "id": "output-1",
      "type": "output"
    }
  ],
  "edges": [
    {
      "from": "input-1",
      "out": "say",
      "to": "output-1",
      "in": "hear"
    }
  ]
}
```

Run it with the Breadboard CLI:

```sh
npx breadboard run hello.json --input '{"say":"Hello World!"}'
```

You should see this printed to your terminal:

```json
{ "hear": "Hello World!" }
```

### What's going on?

The JSON file you created above is an example of a _board_. Boards are programs
which can be executed by Breadboard _runtimes_. The `breadboard run` command
uses the Breadboard JavaScript runtime to execute the board.

This example is a trivial board that just takes some text input and displays it.
We do this by creating an _input node_, an _output node_, and wiring the two
together with an _edge_.

### What's a node? What's an edge?

_Nodes_ are the basic building blocks of a board. Nodes are the logical "steps"
of the program. Nodes perform work, like calling an API, doing some computation,
receiving some user input, or displaying some output. They are similar to
functions in other programming environments.

Nodes have _types_ which determine how they behave. Breadboard comes with some
basic node types (like `input` and `output`). You can easily make your own node
types, and you can import them from libraries called _kits_ (explained later).

_Edges_ are the connections between nodes along which data can flow. However,
because nodes often take multiple inputs and produce multiple outputs, edges are
more precisely connections between node _ports_.

_Ports_ are the named inputs and outputs of a node. When data flows _into_ a
node, the port is called a _destination_ port, and is similar to the parameters
of a function. When data flows _out_ of a node, the port is called a _source_
port, and is similar to function return values. Some nodes have predefined
ports, others (like `input` and `output`), create their ports automatically when
an edge is created.

## Generating boards with JavaScript

Typically you won't be writing boards directly as JSON by hand like we did
above, you'll instead write a program in JavaScript, TypeScript, or Python
(coming soon!) which _generates_ the board. This gives you access to APIs which
are much easier to work with than writing JSON by hand.

Here's how to generate an equivalent board using the Breadboard JavaScript API:

```js
import { base, board } from "@google-labs/breadboard";

export default await board(() => {
  const input = base.input({});
  const output = base.output({});
  input.say.to(output.hear);
  return output;
}).serialize();
```

This JavaScript file can be compiled with the Breadboard CLI, producing a very
similar JSON file to what we wrote above:

```sh
npx breadboard make hello.js
```

Or you can just run it directly:

```sh
npx breadboard run hello.js --input '{"say":"Hello World!"}'
```

### What's going on?

We call `board` to declare a new board:

```js
board(() => {
  // ...
});
```

These lines create two nodes within that board:

```js
const input = base.input({});
const output = base.output({});
```

This line creates an edge that connects the `input` node's `say` source port to
the `output` node's `hear` destination port:

```js
// +----------------------- input node
// |   +------------------- source port
// |   |       +----------- output node
// |   |       |     +----- destination port
// |   |       |     |
input.say.to(output.hear);
```

Finally, this line converts the board to the common JSON format and exports it
from the JavaScript module, as expected by the Breadboard CLI:

```js
await board(() => { ... }).serialize();
```
