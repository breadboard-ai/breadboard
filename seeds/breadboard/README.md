# Breadboard

A library for prototyping generative AI applications.

This library was inspired by the hardware maker community and their boundless creativity. They make amazing things with off-the-shelf parts and a [breadboard](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all), just wiring things together and trying this and that until it works.

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

## Using breadboard

Just like for hardware makers, the `Board` class is where wiring of a prototype happens.

```js
import { Board } from "@google-labs/breadboard";

const board = new Board();
```

A prototype consists of nodes and wires. Nodes do useful things, and wires flow control and data between them.

Placing things on the board is exceedingly simple. Here's a line that places an `input` node on the board:

```js
const input = board.input();
const output = board.output();
```

Wiring things is also pretty easy:

```js
input.wire("say->hear", output);
```

The statement above says: "take the `say` output of the `input` node and wire it to the `hear` input of the `output` node".

The `wire` method is chainable, so you can wire multiple wires at once. Wiring can also happen in both directions, allowing for more expressivity and flexibility.

Here's an example: a board that uses [PaLM API](https://developers.generativeai.google/) to generate text:

```js
const output = board.output();
board
  .input()
  .wire("say->", output)
  .wire(
    "say->text",
    kit
      .textCompletion()
      .wire("completion->hear", output)
      .wire("<-API_KEY", kit.secrets(["API_KEY"]))
  );
```

You can run boards using `runOnce` and `run` methods. The `runOnce` is the simplest. It just takes inputs and produces a set of outputs:

```js
const result = await board.runOnce({
  say: "Hi, how are you?",
});
console.log("result", result);
```

When run like that, the output of the sample board above will look something like this:

And get the output like:

```sh
result { say: 'Hi, how are you?', hear: 'Doing alright.' }
```

## Links to WIP docs

- [Breadboard Tutorial](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/tutorial/README.md)
- [Node Types Reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md)
- [Wiring spec](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/wires.md)
