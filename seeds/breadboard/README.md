# Breadboard

![Milestone](https://img.shields.io/badge/milestone-M1-red) ![Stability](https://img.shields.io/badge/stability-wip-green) [![Discord](https://img.shields.io/discord/1138546999872999556?logo=discord)](https://discord.gg/breadboard)

A library for prototyping generative AI applications.

This library was inspired by the hardware maker community and their boundless creativity. They make amazing things with off-the-shelf parts and a [breadboard](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all), just wiring things together and trying this and that until it works.

Breadboard is an attempt to bring the same spirit of creativity and simplicity to making generative AI applications.

This library's design emphasizes two key properties:

:one: **Ease and flexibility of wiring**. Make wiring prototypes easy and fun.

:two: **Modularity and composability**. Easily share, remix, reuse, and compose prototypes.

## Installing the library

Breadboard requires Node version >=v19.0.0. To install the library, run:

```sh
npm install @google-labs/breadboard
```

You will also need the [LLM Starter Kit](https://github.com/google/labs-prototypes/tree/main/seeds/llm-starter):

```sh
npm install @google-labs/llm-starter
```

The LLM Starter Kit comes with Breadboard nodes helpful for building LLM-based applications including the
[promptTemplate node](https://github.com/google/labs-prototypes/tree/main/seeds/llm-starter#the-prompttemplate-node), [append node](https://github.com/google/labs-prototypes/tree/main/seeds/llm-starter#the-append-node), [generateText node](https://github.com/google/labs-prototypes/tree/main/seeds/llm-starter#the-generatetext-node), and more.

## Using breadboard

Just like for hardware makers, the wiring of a prototype begins with the `Board`.

```js
import { Board } from "@google-labs/breadboard";

const board = new Board();
```

Breadboards are all nodes and wires. Nodes do useful things, and wires flow control and data between them.

Placing things on the board is simple. This example places an `input` and an `output` node on the board:

```js
const input = board.input();
const output = board.output();
```

Wiring things is also simple:

```js
input.wire("say->hear", output);
```

The statement above wires the `say` property of the `input` node to the `hear` property of the `output` node.

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
      .generateText()
      .wire("completion->hear", output)
      .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
  );
```

You can run boards using `runOnce` and `run` methods. The `runOnce` is the simplest; it takes inputs and produces a set of outputs:

```js
const result = await board.runOnce({
  say: "Hi, how are you?",
});
console.log("result", result);
```

When run, the output of the sample board above will look something like this:

```sh
result { say: 'Hi, how are you?', hear: 'Doing alright.' }
```

The `run` method provides a lot more flexibility on how the board run happens, and is described in more detail [Chapter 8: Continuous runs](https://github.com/google/labs-prototypes/tree/main/seeds/breadboard/docs/tutorial#chapter-8-continuous-runs) of Breadboard tutorial.

Breadboard is designed for modularity. You can easily save boards: they nicely serialize as JSON:

```js
const json = JSON.stringify(board, null, 2);
await writeFile("./docs/tutorial/news-summarizer.json", json);
```

You can load this JSON from URLs:

```js
const NEWS_BOARD_URL =
  "https://gist.githubusercontent.com/dglazkov/55db9bb36acd5ba5cfbd82d2901e7ced/raw/google-news-headlines.json";
const board = Board.load(NEWS_BOARD_URL);
```

You can include them into your own boards, similar to JS modules, and then treat them as nodes in your graph:

```js
board
  .input()
  .wire(
    "say->text",
    board.include(NEWS_BOARD_URL).wire("text->hear", board.output())
  );
```

You can even create board templates by leaving "slots" in your board for others to fill in:

```js
const input = board.input();
input.wire(
  "topic->",
  board.slot("news").wire(
    "headlines->",
    template.wire("topic<-", input).wire(
      "prompt->text",
      kit
        .generateText()
        .wire("<-PALM_KEY.", kit.secrets(["PALM_KEY"]))
        .wire("completion->summary", board.output())
    )
  )
);
```

## For more information

To learn more about Breadboard, here are a couple of resources:

- [Breadboard Tutorial](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/tutorial/README.md) -- learn how to use breadboard step-by-step, from easy to more complex.
- [Node Types Reference](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md) - learn about the nodes that come built-in with Breadboard.
- [Wiring spec](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/wires.md) -- all the different ways to wire nodes.
- Sample boards, helpfully visualized with [Mermaid](https://mermaid.js.org/) (click on the the link next to "Original:" heading to see the board code):
  - [Simple text completion](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/simplest.md)
  - [Google Search summary](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/search-summarize.md)
  - [Google News summary](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/google-news.md)
  - [Math problem solver](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/math.md)
  - [Endless debate between Albert and Friedrich](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/endless-debate-with-voice.md)
  - [ReAct](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/react.md)
  - [ReAct with slot](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/react-with-slot.md)
  - [Example of calling "ReAct with slot"](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/call-react-with-slot.md)
  - [Semantic retrieval](https://github.com/google/labs-prototypes/blob/main/seeds/graph-playground/docs/graphs/find-file-by-similarity.md)
