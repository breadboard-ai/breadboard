# [](https://www.npmjs.com/package/@google-labs/breadboard#breadboard)Breadboard

[![Milestone](https://camo.githubusercontent.com/be3b7f4f41ae3718fcf8ea07682a052ad751377a3e1684de0833426e08a3428a/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6d696c6573746f6e652d4d342d726564)](https://camo.githubusercontent.com/be3b7f4f41ae3718fcf8ea07682a052ad751377a3e1684de0833426e08a3428a/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6d696c6573746f6e652d4d342d726564) [![Stability](https://camo.githubusercontent.com/d4d33b1521ccf68c37ac06099329a6d770e4ae60aa31b8770cfd80f0797a66c3/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f73746162696c6974792d7769702d677265656e)](https://camo.githubusercontent.com/d4d33b1521ccf68c37ac06099329a6d770e4ae60aa31b8770cfd80f0797a66c3/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f73746162696c6974792d7769702d677265656e) [![Discord](https://camo.githubusercontent.com/3789d541c135cbaec0a85a907aebed3d0d97296a6bad088aba54d783a563ec22/68747470733a2f2f696d672e736869656c64732e696f2f646973636f72642f313133383534363939393837323939393535363f6c6f676f3d646973636f7264)](https://discord.gg/breadboard)

A library for prototyping generative AI applications.

This library was inspired by the hardware maker community and their boundless creativity. They make amazing things with off-the-shelf parts and a [breadboard](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all), just wiring things together and trying this and that until it works.

Breadboard is an attempt to bring the same spirit of creativity and simplicity to making generative AI applications.

This library's design emphasizes two key properties:

:one: **Ease and flexibility of wiring**. Make wiring prototypes easy and fun.

:two: **Modularity and composability**. Easily share, remix, reuse, and compose prototypes.
- [Breadboard](https://www.npmjs.com/package/@google-labs/breadboard#breadboard)
	- [Installation](https://www.npmjs.com/package/@google-labs/breadboard#installation)
	- [Usage](https://www.npmjs.com/package/@google-labs/breadboard#usage)
	- ...
## [](https://www.npmjs.com/package/@google-labs/breadboard#installation) Installation
Breadboard requires [Node.js](https://nodejs.org/) version 19 or higher. Before installing, [download and install Node.js](https://nodejs.org/en/download/).

Check what version of node you're running with `node -v`.

In your workspace, make sure to create a `package.json` first with the [`npm init` command](https://docs.npmjs.com/creating-a-package-json-file).

To install Breadboard with [npm](https://www.npmjs.com/), then run:
```shell
npm install @google-labs/breadboard
```
##### Useful packages (optional)

| Name                                                                                            | Description                                                                                                                                    | Install                                   |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [Breadboard Core Kit](https://www.npmjs.com/package/@google-labs/core-kit)                      | Breadboard kit for foundational board operations like `map` and `invoke`. This contains operations that enable composition and reuse of boards | `npm install @google-labs/core-kit`       |
| [Breadboard CLI](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard-cli) | Command-line tool for generating, running, and debugging boards. This lets you run and build breadboards directly from the command-line.      | `npm install @google-labs/breadboard-cli` |

You can find many other helpful [Breadboard packages](https://github.com/breadboard-ai/breadboard/blob/main/README.md#packages) available.
## [](https://www.npmjs.com/package/@google-labs/breadboard#usage) Usage
### Making your first board
```typescript
import { board } from "@google-labs/breadboard";

const echo = board<{ say: string; }>(({ say }, { output }) => {
	return output({ hear: say })
});

console.log(await echo({ say: "Hello Breadboard!" })); // { hear: 'Hello Breadboard!' }
```

This simple example demonstrates a board with an input port named `say` that gets passed to an output port named `output` . When running the board, `"Hello Breadboard!"` is passed to `say` which then passes it to the output as a property called `hear`. 

Similarly, this can be achieved through chaining the nodes.
```typescript
const echo = board<{ say: string; }>(({ say }, { output }) => {
	return say.as("hear").to(output());
});
```

In this example, `say` is renamed to `hear` using `.as(...)`, which is then sent to the output using `.to(...)`.

Alternatively, we can use `base` to create input and output nodes.
```typescript
import { base, board } from "@google-labs/breadboard";

const echo = board(() => {
	const input = base.input();
	const output = base.output();
	input.say.as("hear").to(output);
	return output;
});

console.log(await echo({ say: "Hello Breadboard!" })); // { hear: 'Hello Breadboard!' }
```
### Using the `code` node
```typescript
import { base, board, code } from "@google-labs/breadboard";
  
const calculator = board(() => {
	const input = base.input();
	const output = base.output();
	const calculate = code(({ x, y }) => {
		if (typeof x !== "number" || typeof y !== "number") return {}
		
		const sum = x + y;
		const diff = x - y;
		const prod = x * y;
		const quo = x / y;
		
		return { results: { sum, diff, prod, quo } } 
	})();
	
	input.to(calculate);
	calculate.results.to(output);
	
	return output;
});

console.log(await calculator({ x: 1, y: 2 })); // { results: { sum: 3, diff: -1, prod: 2, quo: 0.5 } }
```
### Creating kits [TBD]
### Serialization [TBD]
### Running boards [TBD]
## [](https://www.npmjs.com/package/@google-labs/breadboard#concepts) Concepts [TBD]
...
## For more information

To learn more about Breadboard, here are a couple of resources:

- [Breadboard Tutorial](https://breadboard-ai.github.io/breadboard/docs/happy-path/) -- learn how to use breadboard step-by-step, from easy to more complex.
<!-- - [Node Types Reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/nodes.md) - learn about the nodes that come built-in with Breadboard.
- [Wiring spec](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/wires.md) -- all the different ways to wire nodes. -->
- Sample boards, helpfully visualized with [Mermaid](https://mermaid.js.org/) (click on the the link next to "Original:" heading to see the board code):
  - [Simple text completion](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/simplest.md)
  - [Google Search summary](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/search-summarize.md)
  - [Google News summary](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/google-news.md)
  - [Math problem solver](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/math.md)
  - [Endless debate between Albert and Friedrich](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/endless-debate-with-voice.md)
  - [ReAct](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/react.md)
  - [ReAct with slot](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/react-with-slot.md)
  - [Example of calling "ReAct with slot"](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/call-react-with-slot.md)
  - [Semantic retrieval](https://github.com/breadboard-ai/breadboard/blob/main/packages/graph-playground/docs/graphs/find-file-by-similarity.md)
