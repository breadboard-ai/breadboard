# Breadboard

![Milestone](https://img.shields.io/badge/milestone-M4-red) ![Stability](https://img.shields.io/badge/stability-wip-green) [![Discord](https://img.shields.io/discord/1138546999872999556?logo=discord)](https://discord.gg/breadboard)

A library for prototyping generative AI applications.

> [!NOTE]
> Breadboard supports authoring in JavaScript/TypeScript, Python, and with Breadboard Visual Editor.

This library was inspired by the hardware maker community and their boundless creativity. They make amazing things with off-the-shelf parts and a [breadboard](https://learn.sparkfun.com/tutorials/how-to-use-a-breadboard/all), just wiring things together and trying this and that until it works.

Breadboard is an attempt to bring the same spirit of creativity and simplicity to the creation of generative AI applications.

This library's design emphasizes two key properties:

1. **Ease and flexibility of wiring**. Make wiring prototypes easy and fun.
2. **Modularity and composability**. Easily share, remix, reuse, and compose prototypes.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Installation](#installation)
  - [Useful packages (optional)](#useful-packages-optional)
- [Usage](#usage)
  - [Making your first board](#making-your-first-board)
  - [Wiring directions](#wiring-directions)
  - [Creating `code` nodes](#creating-code-nodes)
  - [Kits](#kits)
    - [Using kits](#using-kits)
    - [Creating custom kits](#creating-custom-kits)
  - [Serializing boards](#serializing-boards)
    - [Serialization](#serialization)
    - [Deserialization](#deserialization)
  - [Running boards](#running-boards)
  - [Using a board within a board](#using-a-board-within-a-board)
- [Breadboard Board Schema](#breadboard-board-schema)
- [Breadboard Web](#breadboard-web)
  - [1. Running Breadboard Web Locally](#1-running-breadboard-web-locally)
  - [2. Using Breadboard Web hosted by Google](#2-using-breadboard-web-hosted-by-google)
  - [Using Breadboard Web](#using-breadboard-web)
- [Concepts](#concepts)
- [Additional Info](#additional-info)

## Installation

Breadboard requires [Node.js](https://nodejs.org/) version 20.14.0 or higher. Before installing, [download and install Node.js](https://nodejs.org/en/download/).

- Check what version of Node.js you're running with `node -v`.
- In your workspace, make sure to create a `package.json` first with the [`npm init` command](https://docs.npmjs.com/creating-a-package-json-file).

To install Breadboard with [npm](https://www.npmjs.com/), run:

```shell
npm install @google-labs/breadboard
```

If you want to use [TypeScript](https://www.typescriptlang.org/), you will need to [install the package](https://www.npmjs.com/package/typescript).

- You can use npm to download TypeScript into your project using `npm install typescript --save-dev`.
- You can then initialize the TypeScript project and create a `tsconfig.json` file using `npx tsc --init`.

> **For Windows Users**: For compatability, [Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers) are recommended for ease of use.

### Useful packages (optional)

| Name                                                                                            | Description                                                                                                                                    | Install                                   |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [Breadboard Core Kit](https://www.npmjs.com/package/@google-labs/core-kit)                      | Breadboard kit for foundational board operations like `map` and `invoke`. This contains operations that enable composition and reuse of boards | `npm install @google-labs/core-kit`       |
| [Breadboard CLI](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard-cli) | Command-line tool for generating, running, and debugging boards. This lets you run and build breadboards directly from the command-line.       | `npm install @google-labs/breadboard-cli` |

You can find many other helpful [Breadboard packages](https://github.com/breadboard-ai/breadboard/blob/main/README.md#packages) available.

## Usage

### Making your first board

```typescript
import { board } from "@google-labs/breadboard";

const echo = board<{ say: string }>(({ say }, { output }) => {
  return output({ hear: say });
});

console.log(await echo({ say: "Hello Breadboard!" })); // { hear: 'Hello Breadboard!' }
```

This simple example demonstrates a board with an input port named `say` that gets passed to an output port named `output`. When running the board, `"Hello Breadboard!"` is passed to `say` which then passes it to the output as a property called `hear`.

```typescript
const echo = board<{
  say: string; // Input string to be echoed
}>(
  (
    {
      say, // Input port for string
    },
    {
      output, // Output port for result
    }
  ) => {
    return output({ hear: say }); // Echo the input string as 'hear' property
  }
);
```

Similarly, this can be achieved through chaining the nodes.

```typescript
const echo = board<{ say: string }>(({ say }, { output }) => {
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

### Wiring direction

Attributes can be passed between nodes by wiring them together.

Using `to`, attributes can be wired from left-to-right.

```typescript
board<{ message: string }>(({ message }, { output }) => {
  return message.as("response").to(output());
});
```

Alternatively, `in` can be used to pass attributes from right-to-left.

```typescript
board<{ message: string }>(({ message }, { output }) => {
  return output().in(message.as("response"));
});
```

### Creating `code` nodes

The `code` function helps us create a new type of node, of type `code`. The result of calling `code` is a special function -- let's call it a "node factory". A node factory can be used to create many instances of the node.

```typescript
import { base, board, code } from "@google-labs/breadboard";

const calculator = board(() => {
  const input = base.input();
  const output = base.output();

  const calculate = code(({ x, y }) => {
    if (typeof x !== "number" || typeof y !== "number") return {};

    const sum = x + y;
    const diff = x - y;
    const prod = x * y;
    const quo = x / y;

    return { results: { sum, diff, prod, quo } };
  })();

  input.to(calculate);
  calculate.results.to(output);

  return output;
});

console.log(await calculator({ x: 1, y: 2 })); // { results: { sum: 3, diff: -1, prod: 2, quo: 0.5 } }
```

In this example, the `code` node takes two properties, `x` and `y`, checks that they are numbers before performing arithmetic operations, and then returns each of the calculations as properties of `results`. If either input is not of the `number` type, then an empty object is returned.

These nodes can be created inside or outside the board. They can also be used when creating custom kits.

> [!NOTE]
> The `code` uses nodes from the [Core Kit](https://www.npmjs.com/package/@google-labs/core-kit). If a board using `code` is serialized, then a runtime instance of the Core Kit must be passed into the board.

### Kits

Kits are collections of ready-made node factory functions for all types of nodes.

#### Using kits

Kits are an easy way to add functionality to your board without writing it yourself. You can think of them as purpose-built third-party libraries you'd add to your web application.

For example, there's a [template kit](https://github.com/breadboard-ai/breadboard/tree/main/packages/template-kit), which contains node types that help with templating: `promptTemplate` and `urlTemplate`. The npm package, which contains the kit, must be installed before they can be imported.

```typescript
import { addKit, board } from "@google-labs/breadboard";
import TemplateKit from "@google-labs/template-kit";

const templateKit = addKit(TemplateKit);

const myBoard = board<{ template: string; name: string }>(
  ({ template, name }, { output }) => {
    const promptTemplate = templateKit.promptTemplate({
      template: template,
      name: name,
    });

    return output({ prompt: promptTemplate.prompt });
  }
);

console.log(
  await myBoard({ template: "Hi, my name is {{name}}!", name: "Bob" })
); // { prompt: 'Hi, my name is Bob!' }
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
    result: Object.values(inputs).join(" "),
  }),
  splitter: async (inputs) => ({
    result: Object.entries(inputs).map(([key, value]) => ({
      [key]: value?.toString().split(""),
    })),
  }),
});
```

This kit has two different nodes: `joiner`, which joins together all the values from the `inputs` object into a single string separated by spaces, and `splitter`, which also takes `inputs` as an argument and converts each value into a character array that is paired with their respective keys.

The `code` node can also be used when creating custom kits: let's move the logic for `joiner` into a `code` node and use it when building the kit.

```typescript
const joiner = code((inputs) => {
  const output = Object.values(inputs).join(" ");
  return { output };
});

const stringManipulationKit = new KitBuilder({
  url: ".",
}).build({
  joiner: async (inputs) => ({
    result: await joiner(inputs),
  }),
  splitter: async (inputs) => ({
    result: Object.entries(inputs).map(([key, value]) => ({
      [key]: value?.toString().split(""),
    })),
  }),
});
```

> **Important**: All kits used in a board must be passed in, as runtime kits, when running a board that has been serialized/deserialized.

### Serializing boards

Boards can be serialized into Breadboard Graph Language (BGL). BGL is the common format that Breadboard uses to represent boards. BGL is useful to have a unified language, so you can have boards that call into other boards.

#### Serialization

```typescript
export default await board(({ say }, { output }) => {
  return output({ hear: say });
}).serialize({
  url: ".",
  title: "Echo board",
  description: "Say something to the board and it'll echo back!",
  version: "0.0.1",
});
```

The `serialize` function is called on the result of the board invocation, which is serialized as [JavaScript Object Notation (JSON)](https://www.json.org/json-en.html).

```json
{
  "url": ".",
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

The `serialize` function also takes a single argument: a metadata object that describes the board.

| Name          | Type     | Description                                                               |
| ------------- | -------- | ------------------------------------------------------------------------- |
| `description` | `string` | The description of the graph.                                             |
| `title`       | `string` | The title of the graph.                                                   |
| `url`         | `string` | The URL pointing to the location of the graph.                            |
| `version`     | `string` | Version of the graph. [semver](https://semver.org/) format is encouraged. |

#### Deserialization

To get a runnable board instance, we can pass our serialized board into the `BoardRunner` with `fromGraphDescriptor`.

```typescript
import { BoardRunner } from "@google-labs/breadboard";
import Serialized from "./board/board.js";

const runner = await BoardRunner.fromGraphDescriptor(Serialized);
console.log(await runner.runOnce({ say: "Hello World!" })); // { hear: 'Hello World!' }
```

> **Important**: Any kits used by the board will need to be passed in when running a board that's been serialized.
>
> The `code` node requires the `invoke` node from the `core-kit`.

When running a serialized board that uses kits or `code`, all the kits it uses must be passed in as runtime kits. The `code` function uses nodes from the [Core Kit](https://www.npmjs.com/package/@google-labs/core-kit), which also needs to be passed in.

Each of the kits must be wrapped with `asRuntimeKit` and passed in together in an array.

```typescript
import {
  addKit,
  asRuntimeKit,
  board,
  BoardRunner,
  code,
} from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import TemplateKit from "@google-labs/template-kit";

const templateKit = addKit(TemplateKit);
const helloWorld = await board(({ name }, { output }) => {
  const template = code(() => {
    return { greeting: "Hello {{name}}!" };
  })();

  return output({
    response: templateKit.promptTemplate({ template: template.greeting, name })
      .text,
  }); // Output `response` object containing `text` property from `promptTemplate`
}).serialize();
const runner = await BoardRunner.fromGraphDescriptor(helloWorld);
const result = await runner.runOnce(
  { name: "World" },
  { kits: [asRuntimeKit(Core), asRuntimeKit(TemplateKit)] } // Array of `asRuntimeKit` wrapped kits
);
console.log(result); // { response: 'Hello World!' }
```

This board simply takes a `name` property and inserts the value into a template using the `promptTemplate` node from the `TemplateKit`, which returns the value of `text` as `response` in the object returned to the output.

### Running boards

Boards are programs that can be executed by Breadboard runtimes, and they can have multiple input and output nodes which can be visited more than once. In most real-world scenarios, boards will need to run continuously, sometimes stopping to receive inputs or provide outputs, but a simple board might just run once and return a single output.

For the following examples, we will use a simple board that just takes a property called `say` from the input object and passes it, as a property called `hear`, to the output node.

```typescript
import { base, board } from "@google-labs/breadboard";

export default board(({ say }) => {
  return say.as("hear").to(base.output());
});
```

`board` instances can be invoked, which initiates a single run (equivalent to the `BoardRunner` using `runOnce(...)`).

```typescript
import myBoard from "./board/board.js";

console.log(await myBoard({ say: "Hello Breadboard!" })); // { hear: 'Hello Breadboard!' }
```

Whereas `BoardRunner` can create runnable boards from serialized graphs: it can run boards continuously or initiate a single run. `BoardRunner` has two ways of running a board:

- `runOnce(...)`: A simplified version of `run` that runs the board until the board provides an output, and returns that output.

```typescript
console.log(await runner.runOnce({ say: "Hello Breadboard!" })); // { hear: 'Hello Breadboard!' }
```

- `run(...)`: Runs the board continuously. This method is an [async generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator) that yields the results of each stage of the run.

```typescript
for await (const stop of runner.run()) {
  if (stop.type === "input") {
    stop.inputs = { say: "Hello Breadboard!" };
  } else if (stop.type === "output") {
    console.log(stop.outputs); // { hear: 'Hello Breadboard!' }
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

This board takes the `say` property and passes it to the two different output nodes, which can be identified as `outputOne` and `outputTwo` using the `$id` property, as properties named `firstHear` and `secondHear` respectively. For better clarity, we will change the runner outputs to be logged to the console separately, using the IDs we added to the output nodes against the ID of the currently iterated node in the runner.

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

### Using a board within a board

Using the [Breadboard Core Kit](https://www.npmjs.com/package/@google-labs/core-kit), boards can be invoked with `core` by passing its graph to the `invoke` function. **Important:** `invoke` runs as `runOnce`, so only the first output of an invoked board will be returned.

```typescript
import { asRuntimeKit, board, BoardRunner } from "@google-labs/breadboard";
import { core, Core } from "@google-labs/core-kit";
import JoinerBoard from "./board/index.js";

const myBoard = await board((inputs, { output }) => {
  const invokedBoard = core.invoke({ graph: JoinerBoard });

  inputs.to(invokedBoard);

  return { response: output(invokedBoard) };
}).serialize();

const runner = await BoardRunner.fromGraphDescriptor(myBoard);
const result = await runner.runOnce(
  { greeting: "Hello", subject: "World" },
  { kits: [asRuntimeKit(Core)] }
);
console.log(result); // { joined: 'Hello World' }
```

This example imports the `JoinerBoard` which is then invoked within `myBoard`. The result is passed to the output node and can be executed using `BoardRunner`.

```typescript
import { board, code } from "@google-labs/breadboard";

export default await board((inputs, { output }) => {
  const message = inputs.to(
    code((values) => {
      const joined = Object.values(values).join(" ");
      return { joined };
    })()
  );

  return { response: output(message) };
}).serialize({
  title: "Simple Joiner Board",
  description: "Joins object values and separates with a space.",
});
```

## Breadboard Board Schema

Schemas are used to attach metadata to a board. This metadata provides useful information that can assist in a board's usage. Schemas can be used to define, describe, and provide default values for a board's inputs. In the next section, we will see schemas in action when running a board on Breadboard Web.

The following is an example of a board which concatenates two strings together and has a schema.

```typescript
import { base, board, code } from "@google-labs/breadboard";
const concatStrings = code<{ greeting: string; subject: string }>((inputs) => {
  const { greeting, subject } = inputs;
  const concat = greeting.concat(subject);

  return { concat };
});

// Metadata for an input
const greetingSchema = {
  type: "string",
  title: "My Greeting",
  default: "Hello",
  description: "The greeting",
};

const subjectSchema = {
  type: "string",
  title: "Subject",
  default: "World",
  description: "The subject we are greeting",
};

export default await board(() => {
  // Attach schema properties to base input
  const inputs = base.input({
    $id: "String concatenation Inputs",
    schema: {
      title: "Inputs for string concatenation",
      properties: {
        greeting: greetingSchema,
        subject: subjectSchema,
      },
      // Used to indicate on Breadboard Web if an input is optional
      required: ["greeting", "subject"],
    },
  });

  const result = concatStrings({
    greeting: inputs.greeting.isString(),
    subject: inputs.subject.isString(),
  });

  const output = base.output({ $id: "main" });

  result.to(output);

  return { output };
}).serialize({
  title: "String Concatenation",
  description: "Board which concatenates two strings together",
});
```

The schema has two inputs, `greeting` and `subject`, both of type string. Inputs can be assigned a `default` value, which will be used if a user does not provide one. `Description` is the text that will appear in the input field on the Breadboard Web UI. `Title` is the text that will be labeled above the input field. `$id` will be the node's name as seen on the Breadboard Web.

The properties can then be accessed similarly to object properties. For example, `inputs.greeting` will access the `greeting` property of the input, which in our example is the greeting string. Inputs can then be provided as inputs to code nodes.

We can also add metadata to input nodes without using the `base` input.

```typescript
export default await board<{ greeting: string; subject: string }>(
  ({ greeting, subject }, { output }) => {
    const greetNode = greeting
      .title("My Greeting")
      .default("Hello")
      .description("The greeting")
      .isString();

    const subjectNode = subject
      .title("Subject")
      .default("World")
      .description("The subject we are greeting")
      .isString();
    const result = concatStrings({
      greeting: greetNode,
      subject: subjectNode,
    });
    return result.to(output({ $id: "main" }));
  }
);
```

## Breadboard Web

Breadboard Web is a package that enables running Breadboard applications in a web browser.

There are two ways to run a board using Breadboard Web:

### 1. Running Breadboard Web Locally

You can run a local instance of Breadboard Web from the [`./packages/breadboard-web`](https://github.com/breadboard-ai/breadboard/tree/main/packages/breadboard-web) directory in the Breadboard monorepo. New TypeScript boards can be added to the `src/boards` directory, and they will be automatically built and picked up by Breadboard Web.

In this example, we will use the board in the Breadboard Schema Section.

```typescript
import { base, board, code } from "@google-labs/breadboard";
const concatStrings = code<{ greeting: string; subject: string }>((inputs) => {
  const { greeting, subject } = inputs;
  const concat = greeting.concat(subject);

  return { concat };
});

const greetingSchema = {
  type: "string",
  title: "My Greeting",
  default: "Hello",
  description: "The greeting",
};

const subjectSchema = {
  type: "string",
  title: "Subject",
  default: "World",
  description: "The subject we are greeting",
};

export default await board(() => {
  const inputs = base.input({
    $id: "String concatenation Inputs",
    schema: {
      title: "Inputs for string concatenation",
      properties: {
        greeting: greetingSchema,
        subject: subjectSchema,
      },
    },
    type: "string",
  });

  const result = concatStrings({
    greeting: inputs.greeting as unknown as string,
    subject: inputs.subject as unknown as string,
  });

  const output = base.output({ $id: "main" });

  result.to(output);

  return { output };
}).serialize({
  title: "String Concatenation",
  description: "Board which concatenates two strings together",
});
```

You can then run `npm run dev` in the `boards` directory. This deploys an instance of Breadboard Web accessible athttp://localhost:5173/. Breadboard Web will automatically pick up this graph and allow the board to be selectable in the UI menu.

Running Breadboard Web locally also features hot reloading, which is handy if you are constantly changing your board. Save the file, and it will automatically rebuild and deploy Breadboard Web.

### 2. Using Breadboard Web hosted by Google

We have already demonstrated how to serialize a board into a graph representation. We can store this graph representation as a JSON file.

```typescript
const serialized = await board(() => {
  // board code
  return { output };
}).serialize({
  title: "Serialize Example",
  description: "Serialize Example",
});

// save as JSON file
fs.writeFileSync(
  path.join(".", "board.json"),
  JSON.stringify(serialized, null, "\t")
);
```

The graph representation can then be stored as a file on the internet. This works well with GitHub Gists or repositories. The URL of the file can then be provided as the board in the request parameter and loaded into Breadboard Web (https://breadboard-ai.web.app/?board={raw_github_link_to_file}).

There are several boards available to use on Breadboard Web; below is a board that performs JSON validation.

```
https://breadboard-ai.web.app/?board=%2Fgraphs%2Fjson-validator.json
```

It is also possible to load a remote URL directly into Breadboard Web, for example from a Git repo or a Gist.

```
https://breadboard-ai.web.app/?board=https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/breadboard-web/public/graphs/json-validator.json
```

Local instances of Breadboard Web can also load boards via a JSON file and the board request parameter. Option 2 is great if you want to showcase your boards to other people!

### Using Breadboard Web

Now that we have described how to run a board on Breadboard Web, let's discuss how to use it.

When viewing the board on Breadboard Web, we can see all the nodes it comprises.

Clicking `run` on the UI will prompt the user to provide inputs to the board. One of the great features of Breadboard Web is its interactivity. By clicking on the input node, we can see more information about these inputs. As we can see, we have provided information about what the inputs are for. This is metadata attached to the board by using a board schema. This is also where schema defaults come in handy. We can use these defaults if the user does not want to provide their own, as well as providing guidance on what kind of inputs are accepted.

After the board has finished executing, we can see its output. And just like that, we were able to quickly load a board and run it in a web environment.

## Concepts

| Concept                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board                           | A board is a kind of executable program, expressed declaratively as a graph.                                                                                                                                                                                                                                                                                                                                                                   |
| Nodes                           | A node is a step in a board that performs some action. This might be calling an external API or executing some local computation. Nodes are similar to functions in traditional programs.                                                                                                                                                                                                                                                      |
| Ports                           | A port is a named input or output of a node. Nodes can have any number of ports. Ports can be source ports (data flows out) or destination ports (data flows in). Source ports are analogous to the parameters of a function. Destination ports are analogous to the results returned by a function.                                                                                                                                           |
| Edges                           | An edge is a connection between two ports through which data flows. Edges can be constant or optional. **Constants**: Edges can be optional, which means that the execution of a node will not wait for data to be present before proceeding with execution. **Optional**: Edges can be constant, which means the most recent object that flowed through the edge will remain available indefinitely, instead of being destructively consumed. |
| Kits                            | A kit is a library that provides graphs.                                                                                                                                                                                                                                                                                                                                                                                                       |
| Breadboard Graph Language (BGL) | Breadboard Graph Language (BGL) is a graph serialization format described by [this JSON schema](https://github.com/breadboard-ai/breadboard/blob/main/packages/schema/breadboard.schema.json).                                                                                                                                                                                                                                                 |
| Runtimes                        | A runtime is a system that executes boards. Current runtimes include Node and Web.                                                                                                                                                                                                                                                                                                                                                             |
| Frontends                       | A frontend is a system that generates boards. Current frontends include the `@google-labs/breadboard` API for Node, a Python library (coming soon!), and the Breadboard Visual Playground. Boards can also be written by hand directly as JSON, but using a frontend is typically easier. **Note that frontends are never coupled to a specific runtime.** Boards generated by the Node API can be executed by any runtime.                    |

## Additional Info

To learn more about Breadboard, go to [Breadboard docs site](https://breadboard-ai.github.io/breadboard/).
