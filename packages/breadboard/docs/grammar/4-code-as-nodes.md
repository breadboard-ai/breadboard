# Code as nodes

We saw one way to create boards that can be used as nodes. Another is plain
code! Just use `code` instead of `board`:

```ts
const mirror = board((inputs) => {
  const reverse = code((inputs) => {
    for (let key in inputs)
      inputs[key] = inputs[key].value.split("").reverse().join("");
    return inputs;
  });

  return starter
    .promptTemplate({
      template: "Mirror, mirror, my name is {{name}}, who is ",
      ...reverse(inputs),
    })
    .to(palm.generateText());
});

const { completion } = await mirror({ name: "Queen Grimhilde" });
```

They work just like the other nodes created via `board`!

(Sidebar: `...reverse(inputs)` means that `reverse` gets all the inputs from
`inputs` and that all it's outputs go to `promptTemplate`. You can even write
`reverse({ …inputs, …anotherNode, foo: someOther, bar: anOther.baz })`, which
gets you all of `inputs` and `anotherNode` as well as (implied) `bar` from
`someOther` and `baz` as `bar` from `anOther`).

(Sidebar: Note how the code board isn’t `async`? If it was, the parameter
becomes a promise, so it would have to be `async (inputsPromise) => { const
inputs = await inputsPromise }`. This is so you can use `inputs` to build a
graph, as the outer `board` call does. &lt;link to more more complex nodes like
`map` for more on this)

It all serializes in one go, including the code:

```ts
await writeFile("mirror.json", await hello.serialize());
```

(TODO: Show how this looks as graph in the web UI)

As you create several of these, it’s useful to bundle them in a Kit:

Next: [Kits](5-kits.md)
