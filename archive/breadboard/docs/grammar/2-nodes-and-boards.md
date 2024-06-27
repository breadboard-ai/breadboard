# From nodes to boards

The core building block is a node. For convenience they come bundled in kits.

Here’s one:

```ts
import { palm } from "breadboard-ai/kits/palm";

const { completion } = await palm.generateText({
  prompt: "The meaning of life is ",
});
```

(Sidebar: For it to run, add your `PALM_KEY` to your local environment…)

Each node gets a set of labeled inputs and produces a set of labeled outputs.

Here’s another:

```ts
import { starter } from "breadboard-ai/kits/starter";

const { prompt } = await starter.promptTemplate({
  template: "Hello {{name}}, please ",
  name: "World",
});
```

We can call one after the other:

```ts
const { prompt } = await starter.promptTemplate({
  template: "Hello {{name}}, please ",
  name: "World",
});
const { completion } = await palm.generateText({ prompt });
```

or we can chain them, by leaving off the `await`:

```ts
const { prompt } = starter.promptTemplate({
  template: "Hello {{name}}, please ",
  name: "World",
});
const { completion } = palm.generateText({ prompt });
const result = await completion; // awaits the result of the entire chain
```

(Sidebar: See how you can `await` the entire result or just individual fields.
Either works.)

We’ve just created the first board composed of two nodes!

This also works as one expression:

```ts
const hello = palm.generateText({
  prompt: starter.promptTemplate({
    template: "Hello {{name}}, please ",
    name: "World",
  }),
});
const { completion } = await hello;
```

but for longer chains, this alternative is more readable:

```ts
const hello = starter
  .promptTemplate({ template: "Hello {{name}}, please ", name: "World" })
  .to(palm.generateText());
const { completion } = await hello;
```

All the last three behave the same way: Under the hood you are building a graph
of two nodes, then executing it. Later we’ll look at more complex graphs.

What does it mean for it to be a graph? For one, it can be serialized and then
executed in other environments. Let’s see:

```ts
import { writeFile } from "fs/promises";

const serialized = await hello.serialize();
await writeFile("hello.json", serialized);
```

which you can now load in the web-interface that you can start like this:
(TODO: Whatever we'll settle on)

```sh
npm install breadboard…

npx …
```

(TODO: Shortest path to web ui + screen shot of the graph we created).

And of course, you can use them in new places:

```ts
import { board } from "breadboard-ai";

const hello = board("hello.json");
const { completion } = await hello();
```

So this is how you create reusable building blocks! Any board can be used as a
node!

But this would be more useful if I can pass parameters. We’ll look at that next:

Next: [Boards with inputs](3-boards-with-inputs.md)
