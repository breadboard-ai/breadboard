# Kits - bundles of boards

BIG TODO: The kit stuff isn’t implemented yet, this is just to explore the
syntax:

You can also package these up in a kit:

```ts
import { board, makeKit } from "breadboard-ai";

const reverse = board(...);
const mirror = board(...);
const hello = board(...)

const myExamples = makeKit({ name: "myExamples" }, { reverse, mirror, hello });

await writeFile("myExamples.json", await makeKit.serialize());
```

and you can use them in another file:

```ts
import { loadKit } from "breadboard-ai";

const myExamples = await loadKit("myExamples.json");

const reverseHello = myExamples.hello({
  name: myExamples.reverse({ name: "reverse me" }),
});
const { completion } = await reverseHello;
```

Serializing `reverseHello` now adds a reference to this kit as a requirement.
(TODO: show JSON excerpt)

To make the paths work when the two files aren’t next to each other, one can
either

- add a URL to the kit, e.g. `makeKit({ name: “myExample”, url: “https://…”},
{...})`
- add a destination path, e.g. `await reverseHello.serialize({ baseURI:
boards/” })`

(TODO: should we also add `serializeAndWriteFile` that automatically figures out
the paths?)

Sadly, though, building kits in this way won’t retain type information, so you
won’t get those nice hints in TypeScript, e.g. &lt;insert screenshot> or
&lt;another screenshot> won’t work anymore. To fix this, we can add explicit
type information to boards:

And use a CLI tool to create a module for each kit

(show CLI tool)

(more metadata for both boards and kits, e.g. title, description, version,
etc.)
