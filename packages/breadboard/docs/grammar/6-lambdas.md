# Lambdas - Passing boards around

Boards - like functions in functional programming languages - are first order
concepts and can be passed to other boards:

Let's use a slightly modified version of the reverse example from the [codes and
nodes](4-code-as-nodes.md):

```ts
const reverse = code((inputs) => {
  for (let key in inputs)
    if (typeof inputs[key] === "string")
      inputs[key] = inputs[key].value.split("").reverse().join("");
  return inputs;
});
```

This can be passed to another board:

```ts
const generateWithPreProcessing = board(({ preProcess, name }) => {
  return starter
    .promptTemplate({
      template: "Mirror, mirror, my name is {{name}}, who is ",
      name: preProcess({ name }),
    })
    .to(palm.generateText());
});

const { completion } = generateWithPreProcessing({
  preProcess: reverse,
  name: "Queen Grimhilde",
});
```

You can also bind inputs to a board, analogous to currying a function (that is
creating a new function with some parameters already defined):

```ts
const promptGenerator = board(
  starter.promptTemplate({
    template: "{{reflector}}, {{reflector}}, my name is {{name}}, who is ",
  })
);
inputs.reflector.to(promptGenerator);

const generateWithTwoStagePreProcessing = board(async (inputs) => {
  return inputs.processTwo(inputs.processOne(inputs)).to(palm.generateText());
});

const { completion } = generateWithTwoStagePreProcessing({
  preProcess1: reverse,
  preProcess2: promptGenerator,
  name: inputs.name,
});
```

(Sidebar: Here a single node with a configuration was passed in. For single
nodes, you can skip the wrapper function. All inputs to the board will be
passed to the this node, and its output is the output of the board)

Here, we take a template and already bind a variable to it (the reflector coming
from an input), and then pass it to the next function. This function now doesn't
have to know anything about the existence of `reflector`.

TODO: Maybe we should go with a more real example right away, even if longer.

You can even wire nodes from parent boards to child boards:

```ts
const reflector = core.passthrough(inputs.reflector);

const promptGenerator = board(() =>
  starter.promptTemplate({
    template: "{{reflector}}, {{reflector}}, my name is {{name}}, who is ",
    reflector
  }));

...
```

Does the same as above: Note how there is now a connection from `reflector` in
the parent context to the `promptTemplate` node inside the lambda board.

(Sidebar: Writing `inputs.reflector` in the board would have worked as well,
actually. But this is confusing to read as it would be the outer inputs, only
because we haven't wrapped promptTemplate in a function (or such a function
would have named its inputs parameter differently). This is not recommended)

A tricky bit to note: These pre-bound inputs are computed when the lambda board
is being defined, not every time it is invoked. This is so that lambdas can be
returned and even serialized and shipped as e.g. a kit. It also prevents random
inconsistencies if e.g. upstream data changes, but a downstream flow hasn't
completed yet. Please send us feedback if this is causing problems.

TODO: Show how the board above would look serialized, e.g. where the hardcoded values (the template here) would end up.

TODO: Show full example of where that is useful, and end-to-end how a kit is
produced this way. Example, taking a general RAG boards and creating a board
tied to a specific database.
