# [](https://www.npmjs.com/package/@google-labs/breadboard#breadboard)Breadboard

[![Milestone](https://camo.githubusercontent.com/be3b7f4f41ae3718fcf8ea07682a052ad751377a3e1684de0833426e08a3428a/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6d696c6573746f6e652d4d342d726564)](https://camo.githubusercontent.com/be3b7f4f41ae3718fcf8ea07682a052ad751377a3e1684de0833426e08a3428a/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f6d696c6573746f6e652d4d342d726564) [![Stability](https://camo.githubusercontent.com/d4d33b1521ccf68c37ac06099329a6d770e4ae60aa31b8770cfd80f0797a66c3/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f73746162696c6974792d7769702d677265656e)](https://camo.githubusercontent.com/d4d33b1521ccf68c37ac06099329a6d770e4ae60aa31b8770cfd80f0797a66c3/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f73746162696c6974792d7769702d677265656e) [![Discord](https://camo.githubusercontent.com/3789d541c135cbaec0a85a907aebed3d0d97296a6bad088aba54d783a563ec22/68747470733a2f2f696d672e736869656c64732e696f2f646973636f72642f313133383534363939393837323939393535363f6c6f676f3d646973636f7264)](https://discord.gg/breadboard)

A library for prototyping generative AI applications.

> Breadboard supports authoring in JavaScript/TypeScript and Python (coming soon).

This library was inspired by the hardware maker community and their boundless creativity. They make amazing things with off-the-shelf parts and a [breadboard](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all), just wiring things together and trying this and that until it works.

Breadboard is an attempt to bring the same spirit of creativity and simplicity to making generative AI applications.

This library's design emphasizes two key properties:

:one: **Ease and flexibility of wiring**. Make wiring prototypes easy and fun.

:two: **Modularity and composability**. Easily share, remix, reuse, and compose prototypes.
## [](https://www.npmjs.com/package/@google-labs/breadboard#table-of-contents) Table of Contents
- <a href="#breadboard">Breadboard</a>
	- <a href="#installation">Installation</a>
	- <a href="#usage">Usage</a>
	- <a href="#concepts">Concepts</a>
	- <a href="#additional-info">Additional Info</a>

<h2 id="installation">Installation</h2>

Breadboard requires [Node.js](https://nodejs.org/) version 19 or higher. Before installing, [download and install Node.js](https://nodejs.org/en/download/).
- Check what version of node you're running with `node -v`.
- In your workspace, make sure to create a `package.json` first with the [`npm init` command](https://docs.npmjs.com/creating-a-package-json-file).

To install Breadboard with [npm](https://www.npmjs.com/), then run:
```shell
npm install @google-labs/breadboard
```

If you want to use [TypeScript](https://www.typescriptlang.org/), you will need to [install the package](https://www.npmjs.com/package/typescript). 
- You can use npm to download TypeScript into your project using `npm install typescript --save-dev`. 
- You can then initialize the Typescript project and create a `tsconfig.json` file using `npx tsc --init`.

### Useful packages (optional)

| Name                                                                                            | Description                                                                                                                                    | Install                                   |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [Breadboard Core Kit](https://www.npmjs.com/package/@google-labs/core-kit)                      | Breadboard kit for foundational board operations like `map` and `invoke`. This contains operations that enable composition and reuse of boards | `npm install @google-labs/core-kit`       |
| [Breadboard CLI](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard-cli) | Command-line tool for generating, running, and debugging boards. This lets you run and build breadboards directly from the command-line.       | `npm install @google-labs/breadboard-cli` |

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

This simple example demonstrates a board with an input port named `say` that gets passed to an output port named `output`. When running the board, `"Hello Breadboard!"` is passed to `say` which then passes it to the output as a property called `hear`.

```typescript
const echo = board<{
	 say: string; // Input string to be echoed
	}>(({ 
		say // Input port for string
	}, { 
		output // Output port for result
	}) => {
	return output({ hear: say }) // Echo the input string as 'hear' property
});
```

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
In this example, the `code` simply takes two properties, `x` and `y`, and checks that they are numbers before performing arithmetic operations using the values, and then returning each of the calculations as properties of `results`. If either input is not of the `number` type, then an empty object gets returned.

These nodes can be created inside or outside the board. They can also be used when creating custom kits.

> **Important**: `code` uses nodes from the [Core Kit](https://www.npmjs.com/package/@google-labs/core-kit).
> 
> If a board using `code` is serialized, then a runtime instance of the Core Kit must be passed into the board.

### Kits
Kits are collections of ready-made node factory functions for all types of nodes.

#### Using kits
Kits are an easy way to add functionality to your board without writing it yourself, and you can think of them as purpose-built third-party libraries you'd add to your web application.

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

console.log(await myBoard({ template: "Hi, my name is {{name}}!", name: "Bob" })); // { prompt: 'Hi, my name is Bob!' }
```
Here, `addKit` creates an instance of the Template Kit, which is used to create a `promptTemplate` node within the board. We pass in `template`, which has a placeholder expecting a property called `name` to be supplied, along with the `name` itself. The `promptTemplate` node populates the placeholder in our template with the corresponding inputted value. The value of `prompt`, and a key with the same name, gets passed as an object to the output.

There's a variety of pre-made kits readily available: you can find [a non-exhaustive list of kits here](https://github.com/breadboard-ai/breadboard/blob/main/README.md#packages).

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

> **Important**: All kits used in a board must be passed in, as runtime kits, when running a board that has been serialized/de-serialized.

### Serializing boards
Boards can be serialized into Breadboard Graph Language (BGL). BGL is the common format that Breadboard uses to represent boards. BGL is useful to have a unified language, so you can have boards that call into other boards.

#### Serialization
```typescript
const echo = await board<{ say: string; }>(({ say }, { output }) => {
	return output({ hear: say })
}).serialize({
    url: ".",
    title: "Echo board",
    description: "Say something to the board and it'll echo back!",
    version: "0.0.1"
});
```
The `serialize` function is called on the result of the board invocation, which is serialized as [JavaScript Object Notation (JSON)](https://www.json.org/json-en.html).
```json
{
  "url":".",
  "title": "Echo board",
  "description": "Say something to the board and it'll echo back!",
  "version": "0.0.1",
  "edges": [
    ...
  ],
  "nodes": [
	...
  ],
  "graphs": {}
}
```
The `serialize` function is also takes a single argument: a metadata object that describes the board.
<table style='font-family:"Courier New", Courier, monospace; font-size:80%;'>
	<td><b>Name</b></td>
    <td><b>Type</b></td>
    <td><b>Description</b></td>
  <tr>
    <td><code>description?</code></td>
    <td><code>string</code></td>
    <td>The description of the graph.</td>
  </tr>
  <tr>
    <td><code>title?</code></td>
    <td><code>string</code></td>
    <td>The title of the graph.</td>
  </tr>
    <tr>
    <td><code>url?</code></td>
    <td><code>string</code></td>
    <td>The URL pointing to the location of the graph. This URL is used to resolve relative paths in the graph. If not specified, the paths are assumed to be relative to the current working directory.</td>
  </tr>
    <tr>
    <td><code>version?</code></td>
    <td><code>string</code></td>
    <td>Version of the graph. <a href="https://semver.org/">semver</a> format is encouraged.</td>
  </tr>
</table>

#### Deserialization
To get a runnable board instance, we can pass our serialized board into the `BoardRunner` with `fromGraphDescriptor`.

```typescript
import { BoardRunner } from "@google-labs/breadboard";
import Serialized from "./board/board.js"

const runner = await BoardRunner.fromGraphDescriptor(Serialized);
console.log(await runner.runOnce({ say: "Hello World!" })); // { hear: 'Hello World!' }
```

> **Important**: Any kits used by the board will need to be passed in when running a board that's been serialized.
> 
> The `code` node requires the `invoke` node from the `core-kit`.

When running a serialized board that uses kits or `code`, then all the kits it uses must be passed in as runtime kits. The `code` function uses nodes from the [Core Kit](https://www.npmjs.com/package/@google-labs/core-kit), which would also need to be passed in.

Each of the kits must be wrapped with `asRuntimeKit` and passed in together in an array. 

```typescript
import { addKit, asRuntimeKit, board, BoardRunner, code } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import TemplateKit from "@google-labs/template-kit";

const templateKit = addKit(TemplateKit);
const helloWorld = await board(({ name }, { output }) => {
	const template = code(() => {
		return { greeting: "Hello {{name}}!" };
	})();

	return output({
		response: templateKit.promptTemplate({ template: template.greeting, name }).text,
	}); // Output `response` object containing `text` property from `promptTemplate`
}).serialize();
const runner = await BoardRunner.fromGraphDescriptor(helloWorld);
const result = await runner.runOnce(
	{ name: "World" },
	{ kits: [asRuntimeKit(Core), asRuntimeKit(TemplateKit)] } // Array of `asRuntimeKit` wrapped kits
);
console.log(result); // { response: 'Hello World!' }
```
This board simply takes a `name` property and inserts the value into a template using the `promptTemplate` node, from the `TemplateKit`, which returns the value of `text` as `response` in the object returned to the output.

### Running boards
Boards are programs which can be executed by Breadboard runtimes, and they can have multiple input and output nodes which can visited more than once.
In most real-world scenarios, boards will need to run continuously, sometimes stopping to receive inputs or provide outputs, but a simple board might just run once and return a single output.

We will use this simple board for the following examples.
```typescript
import { base, board } from "@google-labs/breadboard";

export default board(({ say }) => {
    return say.as("hear").to(base.output());
});
```
This board simply takes a property called `say` from the input object and passes it, as a property called `hear`, to an output node.

`board` instances can be invoked, which initiates a single run (equivalent to the `BoardRunner` using `runOnce(...)`).
```typescript
import myBoard from "./board/board.js";

console.log(await myBoard({ say: "Hello Breadboard!" })); // { hear: 'Hello Breadboard!' }
```
Whereas `BoardRunner` can create runnable boards from serialized graphs: they can run boards continuously or initiate a single run. 

We can serialize our board and use `fromGraphDescriptor` to get the runner.
```typescript
import myBoard from "./board/board.js";
import { BoardRunner } from "@google-labs/breadboard";

const serialized = await myBoard.serialize(); // serialize the board invocation result into a graph
const runner = await BoardRunner.fromGraphDescriptor(serialized); // Get runner from graph
```

Then, `BoardRunner` has two ways of running a board:
- `runOnce(...)`: A simplified version of `run` that runs the board until the board provides an output, and returns that output.
	```typescript
	console.log(await runner.runOnce({ say: "Hello Breadboard!" })); // { hear: 'Hello Breadboard!' }
	```
- `run(...)`: Runs the board continuously. This method is an [async generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator) that yields the results of each stage of the run.
	```typescript
	...
	for await (const stop of runner.run()) {
		if (stop.type === "input") {
			stop.inputs = { say: "Hello Breadboard!" };
		} else if (stop.type === "output") {
        	console.log(stop.outputs) // { hear: 'Hello Breadboard!' }
		}
	}
	```
So far, our board only has outputs that are visited once, and we could simply invoke the `board` or use `runOnce` to run it entirely. Let's change our board to return from two different outputs instead of one.
```typescript
import { base, board } from "@google-labs/breadboard";

export default board(({ say }) => {
    say.as("firstHear").to(base.output({ $id: "outputOne" }));
    return say.as("secondHear").to(base.output({ $id: "outputTwo" }));
});
```
This board takes the `say` property and passes it to the two different output nodes, which can be identified as `outputOne` and `outputTwo` using the `$id` property, as properties named `firstHear` and `secondHear` respectively. For beter clarity, we will change the runner outputs to be logged to the console separately, using the ids we added to the output nodes against the id of the currently iterated node in the runner.
```typescript
else if (stop.type === "output") {
	if (stop.node.id === "outputOne") {
		console.log("outputOne", stop.outputs); // outputOne { firstHear: 'Hello Breadboard!' }
	} else if (stop.node.id === "outputTwo") {
		console.log("outputTwo", stop.outputs); // outputTwo { secondHear: 'Hello Breadboard!' }
	}
}
```

If we were to use `runOnce`, or invoke the board, then we would only receive one output before the board stops running.

### Using a board within a board [TBD]
### Slots [TBD]
### Adding metadata (titles, descriptions, schemas, etc,...) [TBD]

<h2 id="concepts">Concepts</h2>

| Concept                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board                           | A board is a kind of executable program, expressed declaratively as a graph.                                                                                                                                                                                                                                                                                                                                                                   |
| Nodes                           | A node is a step in a board that performs some action. This might be calling an external API, or executing some local computation. Nodes are similar to functions in traditional programs.                                                                                                                                                                                                                                                     |
| Ports                           | A port is a named input or output of a node. Nodes can have any number of ports. Ports can be source ports (data flows out), or destination ports (data flows in). Source ports are analogous to the parameters of a function. Destination ports are analogous to the results returned by a function.                                                                                                                                          |
| Edges                           | An edge is a connection between two ports through which data flows. Edges can be constant or optional. **Constants**: Edges can be optional, which means that the execution of a node will not wait for data to be present before proceeding with execution. **Optional**: Edges can be constant, which means the most recent object that flowed through the edge will remain available indefinitely, instead of being destructively consumed. |
| Kits                            | A kit is a library that provides graphs.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Slots                           | Boards can have slots, which is Breadboard's way of expressing inversion of control. When a board exposes a slot, it means that users of that board are expected to provide an implementation for some portion of the graph themselves.                                                                                                                                                                                                        |
| Breadboard Graph Language (BGL) | Breadboard Graph Language (BGL) is a graph serialization format described by [this JSON schema](https://github.com/breadboard-ai/breadboard/blob/main/packages/schema/breadboard.schema.json).                                                                                                                                                                                                                                                 |
| Runtimes                        | A runtime is a system that executes boards. Current runtimes include: Node and Web.                                                                                                                                                                                                                                                                                                                                                            |
| Frontends                       | A frontend is a system that generates boards. Current frontends include the `@google-labs/breadboard` API for Node, a Python library (coming soon!), and the Breadboard Visual Playground. Boards can also be written by hand directly as JSON, but using a frontend is typically easier. **Note that frontends are never coupled to a specific runtime.** Boards generated by the Node API can be executed by any runtime.                    |

<h2 id="additional-info">Additional Info</h2>
To learn more about Breadboard, here are a couple of resources:

- [Breadboard Tutorial](https://breadboard-ai.github.io/breadboard/docs/happy-path/) -- learn how to use breadboard step-by-step, from easy to more complex.
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

# Breadboard Web

Breadboard web is a package that can run Breadboard applications on a web browser.

There are two ways to run a board using Breadboard Web:

1. Using Breadboard Web hosted by Google.

We have already demonstrated how to serialize a board into a graph representation. We can store this graph representation as a json file. 

```Typescript
const serialized = await board(() => {
	// board code
    return { output }
}).serialize({
    title: "Serialize Example",
    description: "Serialize Example"
});

// save as JSON file
fs.writeFileSync(
    path.join(".", "board.json"),
    JSON.stringify(serialized, null, "\t")
);

```

This can then be stored as file on the internet, in this example we are using a github repository. The file can then be provided as the board in the request parameter and loaded into Breadboard Web (https://breadboard-ai.web.app):

(TODO add a breadboard web link using a simple board)

https://breadboard-ai.web.app/?mode=build&board=https%3A%2F%2Fraw.githubusercontent.com%2FExaDev%2Fbreadboard-examples%2FHugging-Face-Clean-History%2Fsrc%2Fexamples%2Ffill-mask%2Fboard.json

2. Running Breadboard Web locally.

We can also run our own instance of Breadboard Web. This requires us to work in the Breadboard Monorepo. We can add our board into `packages/breadboard-web/src/boards`.

Instead of saving the file as a JSON, we can export the graph representation of a board. We can then run `npm run dev` while in the boards directory. This deploys an instance of Breadboard Web accessible on http://localhost:5173/. Breadboard Web will automatically pick up this graph and allow the board to be selectable on the UI.

```Typescript

export default board(() => {
	// board code
    return { output }
}).serialize({
    title: "Locally Running Breadboard Web",
    description: "Locally running breadboard web"
});
```

Running Breadboard Web locally also features hot reloading which is handy if we are constantly making changes to our board. Local instances of Breadboard Web can also load boards via json file and the board request parameter. Option 1 is great if you would like to show off your boards to other people!

## Using breadboard web
Now we have described how to run a board on Breadboard Web, let's discuss how to use it.

When looking at the board on Breadboard Web we can see all the nodes this board is composed of.
(Show screenshot of the breadboard web ui)

Clicking `run` on the UI will prompt the user to provide inputs to the board. One of the great features of Breadboard Web is that it is interactive, by clicking on the input node we can see more information about these inputs. As we can see, we have provided information about what the inputs are for. This is metadata that was attatched to the board by using a board schema. This is also where schema defaults come in handy. We can use these defaults if the user does not want to provide their own, as well as providing guidance on what kind of inputs are accepted. We'll discuss schemas in greater detail in the next section.

Once we have provided inputs and run the board, let's see what happens! 
(add screenshot of board output)

After the board has finished executing we can see its output. And just like that, we were able to quickly create a board and run it in a web environment.
# Breadboard Board Schema

As we saw in the previous section, we can add metadata to boards which assist in their usage. One one way doing this is through the use of schemas. Schemas can be used to define and describe inputs as well as providing their default values. 

```Typescript

const numberSchema = {
    type: "number",
    title: "myNumber",
    default: "1",
    description: "The number I want to print out"
};

TODO add board + code node which makes use of schema

```