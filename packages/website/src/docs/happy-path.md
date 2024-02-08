---
layout: docs.njk
title: Breadboard Developer Happy Path
tags:
  - general
  - wip
---

If you're eager to start making boards with Breadboard as quickly as possible, here's a yellow brick road that will take you there. It's not quite a tutorial, but more like a step-by-step onboarding guide with some of the best practices baked in.

## Getting started

There are two ways to get started with Breadboard: fork a Replit project or install Breadboard locally.

### Fork a Replit project

Go to the [Breadboard Starter Project](https://replit.com/@dglazkov/Breadboard-Starter-Project) and click "Fork". This will create roughly the setup that you'll have if you install Breadboard locally.

### Install locally

1. Install [Node.js >=v19](https://nodejs.org/en). If you already have an earlier version of Node installed, you can use [nvm](https://github.com/nvm-sh/nvm) to get to the version that Breadboard needs.

2. Run `npm init @google-labs/breadboard ./breadboard-starter` to set up the project. This will create it in a new directory called `breadboard-starter`, but feel free to choose a different name.

This will create a simple starter project that contains most of the bits you need to build AI boards.

### Set up the environment

Breadboard relies on the "hot reload" developer experience pattern to ease rapid iteration and learning-by-playing. The best experience with "hot reload" is when we position our code editor window side-by-side with the Breadboard debugger window:

![Breadboard debugger and editor side-by-side](/breadboard/static/images/happy-path.jpg)

When we save our board file in the code editor, the debugger will automatically reload and let us interact with the board.

We recommend [VSCode](https://code.visualstudio.com/) for the code editor, but any code editor should work with "hot reload".

To start the debugger, run:

```bash
npm run dev
```

This will start the Breadboard debugger and give you a link to open it in the browser.

(TODO: screenshot of the debugger tile view)

![Debugger overview](/breadboard/static/images/debugger-overview.jpg)

### Debugger Overview

The debugger has four main panels:

1. **A visualizer.** This shows you a graphical representation of your board. This allows you to see which nodes are connected to each other, and what the [ports](/docs/concepts/#ports) (inputs and outputs) of each [node](/docs/concepts/#nodes) are called.
1. **Event timeline.** This gives you a quick overview of what is being called and on which board. (Sometimes you might have boards that call into other boards.) This timeline is also draggable, so if you want to step back to a certain point in history, you can. The other panels will update to match that point in the board's history, too, allowing you to see what the state of the board was at any given point.
1. **Inputs & Outputs.** There are two panels dedicated to the inputs & outputs of the board. Inputs is where you will be prompted for any values the board need to continue, and outputs will show you what the board has generated.
1. **Run log.** This gives you much more detail about each node in the board. Here you can click on an entry and see the precise input and output values for each node.

## Building a board

Every board has a bit of a boilerplate, and the project we just set up contains a blank board that's basically just that. We'll use it as our starting point.

Open `src/boards/blank.ts` in your editor window and navigate to the "Blank board" board in the debugger.

The blank board will look something like this:

```ts
import { board } from "@google-labs/breadboard";

export default await board(({ text }) => {
  return { text };
}).serialize({
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
});
```

(TODO: point at the visualizer in the debugger -- it shows input and output)

> [!NOTE]
>
> **What's going on here?**
>
> It might be worth going over this code to orient ourselves a little bit:
>
> - The `board` call is how we tell Breadboard to create a new board. It takes a function as an argument. This function (let's call it a "board function") is where we describe the board.
>
> - The board function itself takes a single argument (let's call it "inputs") and returns a single argument, which we'll call "outputs". These arguments are the objects that describe the inputs and outputs of our new board.
>
> - Both input and output are of the same shape: they are property bags that contain named properties. Each property is a "port" -- one value that the board takes in as input or passes as output. For example, the blank board has a single input port called `text` and a single output port called `text` -- and that input port is passed right through to the output port.
>
> - The `serialize` function is then called on the result of the `board` invocation. This will serialize the board into Breadboard Graph Language (BGL). BGL is the [common format](./hourglass.md) that Breadboard uses to represent boards.
>
> - The `serialize` function also takes a single argument: some metadata that describes the board. This is where we can set the title, description, and version of the board. Since we'll be making many boards in the future, it's a good practice to give meaningful values to these properties.
>
> - Behind the scenes, debugger scans for all the files in `src/boards`, looks for the `default` export in each file, serializes it as BGL, and then renders the BGL in the debugger. This is why we see the "Blank" board in the debugger window.

In the debugger window, we can see that the board asks for the `text` input. If we enter something there, and hit "Run", we'll see that what we entered gets passed through to the output.

(TODO: screenshot of the finished run)

> [!TIP]
> This "bags of named input and output ports" pattern is very common in Breadboard. Within a board, passing data means connecting output ports to input ports.

> [!TIP]
> If the `({ text })` stuff looks a little weird to you, it's a fairly recent feature of Javascript/Typescript called "[destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment)". The `({text})` expression can also be written in this more familiar way:
>
> ```ts
> export default await board((inputs) => {
>   const text = inputs.text;
>   return { text: text };
> }
> ```

### Making a new board

To get a better sense of how debugger and code editor interact, let's play with the board a little bit to get a feel for it.

First, we'll make a copy of a blank board to create a clean slate. Make a copy of the file named `src/boards/blank.ts` and give it a name that feels right to you, like `src/boards/fun.ts`.

In debugger, when we navigate back to the list of boards, we will see two "Blank board" tiles.

(TODO: screenshot of the debugger with two blank boards)

To distinguish between the two, we can use the metadata passed to
the `serialize` function. In our new board file, change the title and description to your liking:

```diff
}).serialize({
-  title: "Blank board",
+  title: "My first board",
-  description: "A blank board. Use it to start a new board",
+  description: "I am learning how to use Breadboard here",
  version: "0.0.1",
});
```

When we save the file in the code editor, the tile representing our new board will change to reflect our edits. Now, click on that tile to open the board in debuggger.

(TODO: screenshot of new board open in debugger)

### Adding inputs and outputs

Next, let's add another input port to the board by appending a property named `number` to the arguments of the `board` function:

```diff
- export default await board(({ text }) => {
+ export default await board(({ text, number }) => {
```

When we save the file, we'll see that the debugger automatically reloads... yet there's no `number` input in the debugger. What gives?

The reason is that this input, though it exists in the code, is not connected to anything. As a result, it gets optimized out during the serialization.

Let's connect it to the output by appending a property named `number` to the `outputs` object:

```diff
- return { text };
+ return { text, number };
```

Now, saving the file pops up a new input field! And when we enter the values, the result appears in the output. Wahoo!

(TODO: Point out that visualizer also shows text and number)

> [!TIP]
> Please treat the immediacy of "hot reload" in the debugger as an invitation to play and experiment with the board. Change things, see what happens. It's easy to hit "undo" in the editor and get back to the previous state.

### Describing inputs

Let's try one more thing: give our inputs nice names and descriptions. We can do that by adding a `title` and `description` property to each input and output:

```diff
export default await board(({ text, number }) => {
+ text.title("Text").description("A description of the text");
+ number.title("Number").description("A description of the number");
```

When we save the file, we'll see that the debugger now shows our titles and descriptions for the input fields.

(TODO: screenshot of the inputs with titles/descriptions)

A handy trick is to use the `examples` method to provide an example value for the input. This is especially useful for quick debugging of boards, since it fills in the input fields. No need to type, just hit "run".

```diff
- text.title("Text").description("A description of the text");
+ text
+   .title("Text")
+   .description("A description of the text")
+   .examples("Hello, world!");
+ number
+   .title("Number")
+   .description("A description of the number")
+   .examples("4");
```

> [!TIP]
> The `title`, `description`, and `example` methods are just a few ways to describe inputs and outputs. We'll see more of them later. The thing to know now is that when serialized to BGL, these descriptions are preserved as [JSON Schema](https://json-schema.org/).

### Adding nodes

We have a working board, but it isn't exactly useful. Let's see if we can add a node to it and make our board actually _do_ something.

> [!NOTE]
> "Nodes" are the key concept in Breadboard. Each node has a set of input and output ports, and it uses the input ports to produce the ouput ports. Typically, a node encapsulates a unit of functionality. In turn, a board is composed of one or more nodes, connecting input and output ports of these nodes to orchestrate whatever a board wants to do.

Both boards and nodes follow the same inputs/outputs pattern. A good way to think of is as more atomic, indivisible units of functionality compared to boards.

To make this more concrete, let's add this bit of code just before the `board` invocation:

```diff
+const reverse = code(({ text }) => {
+  const reversed = (text as string).split("").reverse().join("");
+  return { reversed };
+});

export default await board(({ text, number }) => {
```

We will also need to update TypeScript imports in this file to include the `code` function:

```diff
-import { board } from "@google-labs/breadboard";
+import { code, board } from "@google-labs/breadboard";
```

> [!NOTE]
>
> **What's going on here?**
>
> Just like before, we will go over this bit of code to orient ourselves:
>
> - the `code` function is how we ask Breadboard to create a new type of node.
>
> - just like the `board` function, it takes a single input: the "node function" that describes what the node will do.
>
> - The node function takes in the inputs bag of ports and returns the output ports. In our node, there's one input port named `text` and one output port named `reversed`.
>
> - the one-liner that actually does the work reverses the value of the `text` port. Note that we need to typecast it as `string`. By default, the type ports are unknown.
>
> - finally, we return the `reversed` value as part of the outputs.

It looks like creating new node types is pretty straightforward. Let's see if we can add it to the board.

To do so, we will change our board to add the newly minted type of node. But how?

The result of calling `code` is a special function -- let's call it a "node factory". A node factory can be used to create many instances of the node. We have this function assigned to the `reverse` constant. All we need to do is call it from inside of the board, passing it the right ports as inputs and grabbing the output ports.

Like this:

```diff
export default await board(({ text, number }) => {
  text
    .title("Text")
    .description("A description of the text")
    .examples("Hello, world!");
  number
    .title("Number")
    .description("A description of the number")
    .examples("4");
+ const { reversed } = reverse({ text });
- return { text, number };
+ return { reversed, number };
```

Now, let's run this board.

(TODO: Screenshot of a debugger with results of a reversed string)

Voila! We have a board that reverses a string.

(TODO: Point out that the debugger shows a new node.)

As an additional exercise, we'll create another node type: a repeater. A repeater takes in a `text` port and a `number` port and returns the value of the `text` port repeated the numbers of times specified in the `number` port.

Try writing it yourself. Or just copy it from here:

```ts
const repeat = code(({ text, number }) => {
  const repeated = (text as string).repeat(number as number);
  return { repeated };
});
```

To add an instance of the repeater node, call the node factory and connect it to the ports.

Also, we will remove the `number` from outputs, since we now actually consume and use it by the `repeat` node instance.

```diff
  const { reversed } = reverse({ text });
+  const { repeated } = repeat({ text: reversed, number });
-  return { reversed, number  };
+  return { repeated };
```

Just to add a bit of flourish, we can also decorate the output with a title, just like we did with the output:

```diff
- return { repeated }
+ return { text: repeated.title("Reversed and repeated text") };
```

Now, when we run the board in the debugger, we will see the output titled "Reveresed and repeated text", which contains our input reversed and repeated.

(TODO: screenshot of the debugger showing reveresed and repeated text)

(TODO: Point out that the visualizer shows repeat and reverse nodes)

For completeness, here's the full code of our board so far:

```ts
import { code, board } from "@google-labs/breadboard";

const reverse = code(({ text }) => {
  const reversed = (text as string).split("").reverse().join("");
  return { reversed };
});

const repeat = code(({ text, number }) => {
  const repeated = (text as string).repeat(number as number);
  return { repeated };
});

export default await board(({ text, number }) => {
  text
    .title("Text")
    .description("A description of the text")
    .examples("Hello, world!");
  number
    .title("Number")
    .description("A description of the number")
    .examples("4");
  const { reversed } = reverse({ text });
  const { repeated } = repeat({ text: reversed, number });
  return { text: repeated.title("Reversed and repeated text") };
}).serialize({
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
});
```

(TODO: talk about isolation and inability to reference to other variables outside of `code`.)

### Using kits

So far, we've been rolling nodes by hand. It's fun, but it's not the only way to add nodes in Breadboard. The other way is to use kits.

Kits are collections of ready-made node factory functions for all types of nodes. Typically, kits are organized by purpose.

For example, there's a [template kit](https://github.com/breadboard-ai/breadboard/tree/main/packages/template-kit), which contains node types that help with templating: `promptTemplate` and `urlTemplate`.

To import a kit, install the npm package that contains it and import it into your board:

```ts
import { templates } from "@google-labs/template-kit";
```

Then, use the various node factory functions in your board:

```ts
const { prompt } = templates.promptTemplate({
  template: "Hello {{text}}!",
  text,
});
```

Each node type expects its own set of inputs and produces various outptus to serve its purpose. The `promptTemplate` above helps manipulating strings using a simple handlebar-style syntax.

A required input port is `template`, which is expected to be a string that contains zero or more placeholders to be replaced with values from other input ports. Specify placeholders as `{{inputName}}` in the template. The placeholders in the template must match the input ports connceted to node. The node will replace all placeholders with values from the inputs and pass the result along as the `prompt` output property port.

Here's a whistlestop tour of the kits and node types they provide:

(TODO: Add descriptions for each node in the list)

- `core` kit
  - `invoke` node
  - `map` node
  - `fetch` node
  - `secrets` node
- `starter` kit
  - `promptTemplate` node
  - `urlTemplate` node
- `json` kit
  - `schemish` node
  - `validateJson` node
  - `jsonata` node
  - `xmlToJson` node

(TODO: Guide the reader to build a board that uses promptTemplate to embed reversed string into a template.)

```ts
// ...

const { prompt } = starter.promptTemplate({
  template: "Hello, {{name}}!",
  name: reversed,
});
```

(TODO: Encourage using `$id` that describes the purpose of the nod).

### Reuse boards

TODO: Use `gemini` board that is included (TODO: gemini board is added automatically to the initial setup) in the board.

## Remix boards

TODO: Copy a board in the workspace and see how it immediately appears in the debugger. Make changes to it, then invoke it from the other board.

## Publish boards

TODO: Publish a board JSON to a gist and use it in another board.
Discussion of versioning, all the standard release practices, etc.
