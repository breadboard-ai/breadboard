# Code as nodes

We saw one way to create recipes that can be used as nodes. Another is plain
code:

```ts
const mirror = recipe(async (inputs) {
  const reverse = recipe((inputs) => {
    for (let key in inputs)
      inputs[key] = inputs[key].value.split("").reverse().join("");
    return inputs;
  });

  return starter.promptTemplate({
     template: "Mirror, mirror, my name is {{name}}, who is ",
     name: reverse(inputs) })
  .to(palm.generateText());
});

const { completion} = await mirror({ name: "Queen Grimhilde" });
```

They work just like the other nodes created via `recipe`.

(Sidebar: See `reverse(inputs)` means that `reverse` gets all the inputs from
`inputs`. You can even write `reverse({ …inputs, …anotherNode, foo: someOther,
bar: anOther.baz })`, which gets you all of `inputs` and `anotherNode` as well
as (implied) `bar` from `someOther` and `baz` as `bar` from `anOther`).

(Sidebar: Note how the code recipe isn’t `async`? If it was the parameter
becomes a promise, so it would have to be `async (inputsPromise) => { const
inputs = await inputsPromise }`. This is so you can use `inputs` to build a
graph, as the outer `recipe` call does. &lt;link to more more complex nodes like
`map` for more on this>)

Because we nested it within mirror, it all serializes in one go:

```ts
await writeFile("mirror.json", await hello.serialize());
```

(TODO: Show how this looks as graph in the web UI)

As you create several of these, it’s useful to bundle them in a Kit:

Next: [Kits](5-kits.md)
