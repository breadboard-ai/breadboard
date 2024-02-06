# Boards with inputs and output

We can do this by adding an input node:

```ts
import { base } from "breadboard-ai/kits/base";

const hello = base
  .input()
  .name.to(starter.promptTemplate({ template: "Hello {{name}}, please " }))
  .to(palm.generateText());
```

And now we can call it like this:

```ts
const { completion } = await hello({ name: "Universe" });
```

(Sidebar: See how we said `base.input().name.to(...)`? This specifically sent
just the `name` field to the next node. You can also omit `.name` there and then
it’ll send all inputs)

For convenience, we can directly build a board like this:

```ts
const hello = board(({ name }) => {
  return starter
    .promptTemplate({ template: "Hello {{name}}, please ", name })
    .to(palm.generateText());
});

// We can directly use it:
const { completion } = await hello({ name: "Universe" });

// Or save it and load it again:
await writeFile("hello.json", await hello.serialize());
...
const hello = board("hello.json");
const { completion } = await hello();
```

(Sidebar: See how we’re mixing the two ways of connecting nodes here?
`promptTemplate` and `generateText` are connected via `.to()`, `inputs` and
`promptTemplate` are connected by passing it as parameter to `promptTemplate`)

TODO: Insert example of more advanced reuse of hello, maybe make the chain above
more complex.

Next we’ll see how we can create boards that are just regular code:

Next: [Code as Nodes](4-code-as-nodes.md)
