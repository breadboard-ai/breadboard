# [](https://www.npmjs.com/package/@google-labs/breadboard#breadboard)Breadboard

[![Milestone](https://camo.githubusercontent.com/be3b7f4f41ae3718fcf8ea07682a052ad751377a3e1684de0833426e08a3428a/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6d696c6573746f6e652d4d342d726564)](https://camo.githubusercontent.com/be3b7f4f41ae3718fcf8ea07682a052ad751377a3e1684de0833426e08a3428a/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6d696c6573746f6e652d4d342d726564) [![Stability](https://camo.githubusercontent.com/d4d33b1521ccf68c37ac06099329a6d770e4ae60aa31b8770cfd80f0797a66c3/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f73746162696c6974792d7769702d677265656e)](https://camo.githubusercontent.com/d4d33b1521ccf68c37ac06099329a6d770e4ae60aa31b8770cfd80f0797a66c3/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f73746162696c6974792d7769702d677265656e) [![Discord](https://camo.githubusercontent.com/3789d541c135cbaec0a85a907aebed3d0d97296a6bad088aba54d783a563ec22/68747470733a2f2f696d672e736869656c64732e696f2f646973636f72642f313133383534363939393837323939393535363f6c6f676f3d646973636f7264)](https://discord.gg/breadboard)

A library for prototyping generative AI applications.

This library was inspired by the hardware maker community and their boundless creativity. They make amazing things with off-the-shelf parts and a [breadboard](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all), just wiring things together and trying this and that until it works.

Breadboard is an attempt to bring the same spirit of creativity and simplicity to making generative AI applications.

This library's design emphasizes two key properties:

:one: **Ease and flexibility of wiring**. Make wiring prototypes easy and fun.

:two: **Modularity and composability**. Easily share, remix, reuse, and compose prototypes.
## [](https://www.npmjs.com/package/@google-labs/breadboard#table-of-contents) Table of Contents
- [Breadboard](https://www.npmjs.com/package/@google-labs/breadboard#breadboard)
	- [Installation](https://www.npmjs.com/package/@google-labs/breadboard#installation)
	- <a href="#usage">Usage</a>
	- [Concepts](https://www.npmjs.com/package/@google-labs/breadboard#concepts)
	- [Additional Info](https://www.npmjs.com/package/@google-labs/breadboard#additional-info)

## [](https://www.npmjs.com/package/@google-labs/breadboard#installation) Installation
Breadboard requires [Node.js](https://nodejs.org/) version 19 or higher. Before installing, [download and install Node.js](https://nodejs.org/en/download/).

Check what version of node you're running with `node -v`.

In your workspace, make sure to create a `package.json` first with the [`npm init` command](https://docs.npmjs.com/creating-a-package-json-file).

To install Breadboard with [npm](https://www.npmjs.com/), then run:
```shell
npm install @google-labs/breadboard
```
### Useful packages (optional)

| Name | Description | Install |
| ---- | ----------- | ------- |
| [Breadboard Core Kit](https://www.npmjs.com/package/@google-labs/core-kit) | Breadboard kit for foundational board operations like `map` and `invoke`. This contains operations that enable composition and reuse of boards | `npm install @google-labs/core-kit` |
| [Breadboard CLI](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard-cli) | Command-line tool for generating, running, and debugging boards. This lets you run and build breadboards directly from the command-line. | `npm install @google-labs/breadboard-cli` |

You can find many other helpful [Breadboard packages](https://github.com/breadboard-ai/breadboard/blob/main/README.md#packages) available.

<h2 id="usage">Usage</h2>

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

### Creating `code` nodes
The `code` function helps us create a new type of node, of type `code`. The result of calling code is a special function -- let's call it a "node factory". A node factory can be used to create many instances of the node. 
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
In this example, the `code` simply takes two properties, `x` and `y`, and checks that they are numbers before performing arithmetic operations using the values, and then returning each of the calculations as properties of `results`. If either inputs are not of the `number` type, then an empty object gets returned.

These nodes can be created inside or outside the board. They can also be used when creating custom kits.

### Kits
Kits are collections of ready-made node factory functions for all types of nodes.

#### Using pre-made kits
Kits are an easy way to add functionality into your board without writing it yourself, and you can think of them as purpose-built third-party libraries you'd add into your web application.

For example, there's a [template kit](https://github.com/breadboard-ai/breadboard/tree/main/packages/template-kit), which contains node types that help with templating: `promptTemplate` and `urlTemplate`. The npm package, which contains the kit, must be installed before they can be imported. 

```typescript
import { addKit, board } from "@google-labs/breadboard";
import TemplateKit from "@google-labs/template-kit";

const templateKit = addKit(TemplateKit);

const myBoard = board<{ template: string, name: string; }>(({ template, name }, { output }) => {
	const promptTemplate = templateKit.promptTemplate({
		template: template,
		name: name
	});

	return output({ prompt: promptTemplate.prompt });
});

console.log(await myBoard({ template:"Hi, my name is {{name}}!", name: "Bob" })); // { prompt: 'Hi, my name is Bob!' }
```
Here, `addKit` creates an instance of the Template Kit, which is used to create a `promptTemplate` node within the board. We pass in `template`, which has a placeholder expecting a property called `name` to be supplied, along with the `name` itself. The `promptTemplate` node populates the placeholder in our template with the corresponding inputted value. The value of `prompt`, and a key with the same name, gets passed as an object to the output.

There's a variety of pre-made kits readily available: you can find [a non exhaustive list of kits here](https://github.com/breadboard-ai/breadboard/blob/main/README.md#packages).

#### Creating custom kits
Custom kits can be created using the `KitBuilder`.

```typescript
const stringManipulationKit = new KitBuilder({
	url: ".",
}).build({
	joiner: async (inputs) => ({
		result: (Object.values(inputs)).join(" "),
	}),
	splitter: async (inputs) => ({
		result: Object.entries(inputs).map(([key, value]) => ({
			[key]: value?.toString().split("")
		}))
	})
});
```
This kit has two different nodes: `joiner` which joins together all the values from the `inputs` object into a single string separated by spaces, and `splitter` which also takes `inputs` as an argument and converts each value into a character array that is paired with their respective keys.

The `code` node can also be used when creating custom kits: let's move the logic for `joiner` into a `code` node and use it when building the kit.
```typescript
const joiner = code((inputs) => {
	const output = (Object.values(inputs)).join(" ")
	return { output };
});

const stringManipulationKit = new KitBuilder({
	url: ".",
}).build({
	joiner: async (inputs) => ({
		result: await joiner(inputs),
	}),
	...
});
```

### Running boards [TBD]
Passing in kits
### Serialization [TBD]
BGL
### Using a board within a board [TBD]
### Slots [TBD]
### Adding metadata (titles, descriptions, schemas, etc,...) [TBD]

## [](https://www.npmjs.com/package/@google-labs/breadboard#concepts) Concepts
| Concept | Description |
| ------- | ----------- |
| Board | A board is a kind of executable program, expressed declaratively as a graph. |
| Nodes | A node is a step in a board that performs some action. This might be calling an external API, or executing some local computation. Nodes are similar to functions in traditional programs.|
| Ports| A port is a named input or output of a node. Nodes can have any number of ports. Ports can be source ports (data flows out), or destination ports (data flows in). Source ports are analogous to the parameters of a function. Destination ports are analogous to the results returned by a function.|
| Edges | An edge is a connection between two ports through which data flows. Edges can be constant or optional. **Constants**: Edges can be optional, which means that the execution of a node will not wait for data to be present before proceeding with execution. **Optional**: Edges can be constant, which means the most recent object that flowed through the edge will remain available indefinitely, instead of being destructively consumed.|
| Kits| A kit is a library that provides graphs.|
| Slots| Boards can have slots, which is Breadboard's way of expressing inversion of control. When a board exposes a slot, it means that users of that board are expected to provide an implementation for some portion of the graph themselves.|
| Breadboard Graph Language (BGL)| Breadboard Graph Language (BGL) is a graph serialization format described by [this JSON schema](https://github.com/breadboard-ai/breadboard/blob/main/packages/schema/breadboard.schema.json).|
| Runtimes| A runtime is a system that executes boards. Current runtimes include: Node and Web.|
| Frontends| A frontend is a system that generates boards. Current frontends include the `@google-labs/breadboard` API for Node, a Python library (coming soon!), and the Breadboard Visual Playground. Boards can also be written by hand directly as JSON, but using a frontend is typically easier. **Note that frontends are never coupled to a specific runtime.** Boards generated by the Node API can be executed by any runtime.|
### Board
A board is a kind of executable program, expressed declaratively as a graph.
### Nodes
A node is a step in a board that performs some action. This might be calling an external API, or executing some local computation. Nodes are similar to functions in traditional programs.
### Ports
A port is a named input or output of a node. Nodes can have any number of ports. Ports can be source ports (data flows out), or destination ports (data flows in). Source ports are analogous to the parameters of a function. Destination ports are analogous to the results returned by a function.
### Edges
An edge is a connection between two ports through which data flows.
#### Constants
Edges can be optional, which means that the execution of a node will not wait for data to be present before proceeding with execution.
#### Optional
Edges can be constant, which means the most recent object that flowed through the edge will remain available indefinitely, instead of being destructively consumed.
### Kits
A kit is a library that provides graphs.
### Slots
Boards can have slots, which is Breadboard's way of expressing inversion of control. When a board exposes a slot, it means that users of that board are expected to provide an implementation for some portion of the graph themselves.
### Breadboard Graph Language (BGL)
Breadboard Graph Language (BGL) is a graph serialization format described by [this JSON schema](https://github.com/breadboard-ai/breadboard/blob/main/packages/schema/breadboard.schema.json).
### Runtimes
A runtime is a system that executes boards. Current runtimes include: Node and Web.
### Frontends
A frontend is a system that generates boards. Current frontends include the `@google-labs/breadboard` API for Node, a Python library (coming soon!), and the Breadboard Visual Playground. Boards can also be written by hand directly as JSON, but using a frontend is typically easier.

>Note that frontends are never coupled to a specific runtime. Boards generated by the Node API can be executed by any runtime.

## [](https://www.npmjs.com/package/@google-labs/breadboard#additional-info) Additional Info
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
