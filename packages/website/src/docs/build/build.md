---
layout: docs.liquid
title: Build API
tags:
  - api
  - wip
---

The Breadboard Build API is an npm package that allows you to design and compose
boards with [TypeScript](https://www.typescriptlang.org/).

It is an alternative to the [Visual Editor](../visual-editor/), designed for
users who prefer a code-first approach to working with Breadboard.

Boards that you create with the Build API can be serialized to
[BGL](../too-long/#the-common-format) (_Breadboard Graph Language_), which can
then be executed directly, or imported into the Visual Editor.

## Install

```sh
npm i @breadboard-ai/build
```

## Declaring Inputs

All boards begin with the declaration of one or more _inputs_. The `input`
function declares one input port. Inputs are configured by passing an object
with the following fields:

- `type`: A [Breadboard Type Expression](../type-expressions/) that constrains
  the schema of this port. By default, inputs have type `string`.
- `default`: The value this input will have if none is provided.
- `optional`: If `true`, the input is allowed to have no value. (Note that an
  input cannot be `optional` if it has a `default`.)
- `description`: A text description for documentation purposes.
- `examples`: An array of example values for documentation purposes.

> [!NOTE]
>
> In Breadboard, the term _input_ can have a few different meanings depending on
> the context. To be precise, the `input` function from the Build API declares
> one input _port_. This port will be assigned to one or more input _components_
> later on, as the final step in declaring a board, covered in the
> [Boards](#board) section below.

```ts
import { input } from "@breadboard-ai/build";

const topic = input({
  description: "What should the poem be about?",
  examples: ["Coffee in the morning", "The mind of a cat"],
});

const stanzas = input({
  type: "number",
  description: "How many stanzas should the poem have?",
  default: 4,
});
```

## Using Components

Boards perform work by instantiating _components_.

Components are imported from npm packages or local JavaScript modules, and are
instantiated by calling them as a function.

> [!TIP]
>
> See the _Kit Documentation_ section on the left-hand side of this guide for a
> full catalog of the components you can import and use in your boards.

The inputs to a component are passed as the first argument of the function.
Input values can come from `input` ports, from the outputs of other components,
or from literal values.

For example, the `geminiText` component uses the Gemini Large Language Model API
to generate text:

```ts
import { geminiText } from "@google-labs/gemini-kit";

const poemWriter = geminiText({
  text: poemPrompt,
  model: "gemini-1.5-flash-latest",
});
```

The output ports of a component instance in your board are accessed through the
`outputs` property. Output ports can be passed as inputs to other components, or
they can be configured as the final outputs of your board (see
[Declaring outputs](#declaring-outputs)).

```ts
const poemText = poemWriter.outputs.text;
```

### Helper Functions

Some packages additionally vend _helper functions_ alongside their components,
which provide a more convenient or more strongly-typed way to instantiate a
component.

For example, the `prompt` helper instantiates a `promptTemplate` component using
convenient [JavaScript tagged template
literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
syntax:

```ts
import { prompt } from "@google-labs/template-kit";

const poemPrompt = prompt`
  Write a poem about ${topic} with ${stanzas} stanzas.`;
```

## Declaring Outputs

Use the `output` function to declare an output port for your board.

The first argument to `output` is the output port that produces the value you
want to emit on the port. The second argument is optional (but recommmended)
metadata to help users understand the output port, and can have the following
properties:

- `title`: Display name of the output port.
- `description`: Description of the output port.

```ts
import { output } from "@breadboard-ai/build";

const poem = output(poemWriter.outputs.text, {
  title: "Poem",
  description: "The poem that Gemini generated.",
});
```

## Declaring Boards

The final step in creating a board with the Build API is to call the `board`
function. This encapsulates the inputs, outputs, and board metadata into a board
object. This object can then be imported for use by other boards, or it can be
serialized for execution and visualization (see [Serializing
Boards](#serializing-boards)).

The only argument to `board` is an object with the following properties:

- `inputs` (required): The inputs of the board. An object whose keys are input
  port IDs, and whose values are `input` objects.
- `outputs` (required): The outputs of the board. An object whose keys are
  output port IDs, and whose values are `output` objects.
- `id`: An identifier for the board when used as a component. Required if
  bundling into a kit.
- `title`: Display name for the board.
- `description`: Description for the board.
- `version`: Semver version of the board.
- `metadata`: Additional data including `icon` and `tags`.

```ts
import { board } from "@breadboard-ai/build";

export default board({
  id: "poem-writer",
  title: "Poem Writer",
  description: "Write a poem with Gemini.",
  inputs: { topic, stanzas },
  outputs: { poem },
});
```

> [!NOTE]
>
> All inputs and outputs of a board must be passed to the `board` function, or
> else an error is thrown. The reason you are required to specify both inputs
> and outputs (as opposed to the API discovering one from the other
> automatically), is to allow TypeScript to understand the full input/output
> signature of your boards _at compile time_. This ensures that you will see
> schema mismatch errors as soon as possible when calling one component from
> another.

## Full Example

The following example puts together all of the concepts discussed above:

```ts
import { board, input, output } from "@breadboard-ai/build";
import { prompt } from "@google-labs/template-kit";
import { geminiText } from "@google-labs/gemini-kit";

const topic = input({
  description: "What should the poem be about?",
  examples: ["Coffee in the morning", "The mind of a cat"],
});

const stanzas = input({
  type: "number",
  description: "How many stanzas should the poem have?",
  default: 4,
});

const poemPrompt = prompt`
  Write a poem about ${topic} with ${stanzas} stanzas.`;

const poemWriter = geminiText({
  text: poemPrompt,
  model: "gemini-1.5-flash-latest",
});

const poem = output(poemWriter.outputs.text, {
  title: "Poem",
  description: "The poem that Gemini generated.",
});

export default board({
  id: "poem-writer",
  title: "Poem Writer",
  description: "Write a poem with Gemini.",
  inputs: { topic, stanzas },
  outputs: { poem },
});
```

## Serializing Boards

The `serialize` function takes a `BoardDefinition` (the result of calling the
[`board`](#board) function), and generates a JSON-serializable object in
[BGL](../too-long/#the-common-format) format.

```ts
import { serialize } from "@breadboard-ai/build";
import poemWriter from "./poem-writer.js";

const bgl = serialize(poemWriter);
console.log(JSON.stringify(bgl, null, 2));
```

## Advanced Topics

### Loops

The `loopback` function makes it possible to express loops or cycles with the
Build API.

Calling `loopback` gives you an object that acts like a _placeholder_ for a
value that you will resolve later in the program, thereby allowing you to wire
the output of a component back to itself.

The `loopback` function take a single parameter, a [Breadboard Type
Expression](../type-expressions/) that constrains the schema (`"string"` by
default).

Loopbacks are resolved by calling the `resolve` function with an output port. An
error will be thrown if you try to serialize a board that contains a `loopback`
that was never resolved.

```ts
import { loopback } from "@breadboard-ai/build";
import { magicCounter } from "./magic-counter.js";

const count = loopback({ type: "number" });
const counter = magicCounter({ count });
count.resolve(counter.outputs.count);
```

### Convergences

It is occasionally useful to wire two or more different output ports to the same
input port. In the Build API, this is expressed by calling the `converge`
function (named because multiple wires are _converging_ or _meeting_ at the same
point).

The `converge` function takes 2 or more arguments, each an output port or board
`input`. It returns an object which, when passed as an input to a component,
will cause all of the given output ports to be wired to that input port.

One way this can be used is to initialize loops with a starting condition. In
the following example, an initial value is taken from an `input` to start off a
looping counter:

```ts
import { converge } from "@breadboard-ai/build";

const initial = input({ type: "number" });
const updated = loopback({ type: "number" });
const counter = magicCounter({
  count: converge(initial, updated),
});
updated.resolve(counter.outputs.updated);
```

> [!NOTE]
>
> The above example works because of two important behaviors of the Breadboard
> execution model:
>
> 1. When there are two or more wires connected to the same port, only one wire
>    can be active at a time. The first wire that receives a value is the one
>    that activates. In the above example, on the first iteration, only the
>    `initial` wire has a value, so `initial` activates.
> 2. By default, values are _consumed_ as they flow through a wire. In the above
>    example, on subsequent iterations, the `initial` value is undefined.
>    Meanwhile, the `updated` wire receives a value, so `updated` activates
>    instead.

### Constants

By default, values are consumed as they flow through a wire. This behavior can
be undesirable in some situations, such as when the same value needs to be
provided to the same instance of a component multiple times. If a wire is
annotated as _constant_, then it will instead store the most recent value that
passes through it, and re-emit that value on every subsequent activation.

To express constant wires with the Build API, use the `constant` function to
create a constant version of an output port or value. Any wires connected to
that value will be annotated as constant.

Below we have added an `increment` input to the previous example, and annotated
it with `constant` as we pass it to the counter component. If we did not include
the `constant` annotation, then the loop would never reach a second iteration.
This is because the `increment` value would have been consumed on the first
iteration, leaving the component with an unsatisfied input from there on.

```ts
import { constant, input, loopback } from "@breadboard-ai/build";
import { magicCounter } from "./magic-counter.js";

const increment = input({ default: 1 });
const initial = input({ type: "number" });
const updated = loopback({ type: "number" });
const counter = magicCounter({
  increment: constant(increment),
  count: converge(initial, updated),
});
updated.resolve(counter.outputs.updated);
```

### Polymorphism

Some boards are _polymorphic_, meaning their input and/or output signatures can
take multiple forms. In general, polymorphism is achieved in Breadboard by
having more than one input or output component in a board.

The way polymorphism is expressed in the Build API is with the `inputNode` and
`outputNode` functions. These functions let you manually arrange your inputs and
outputs into components, thereby overriding the default behavior which assumes
there is exactly one input component and one output component per board.

The first parameter to `inputNode` and `outputNode` is an object mapping port
ids to inputs and outputs, respectively. The second parameter configures the
metadata of the input or output component, and supports the following fields:

- `id`: ID of the input or output node.
- `title`: Title of the input or output node.
- `description`: Description of the input or output node.

In the example below, we have a board which has 2 input components and 2 output
signatures, meaning there are 2 ways it can be invoked, and 2 ways it can return
its values:

```ts
import { inputNode, outputNode, board } from "@breadboard-ai/build";

export default board({
  id: "my-polymorphic-board",
  description: "A contrived board with polymorphic inputs and outputs",
  inputs: [
    inputNode({ a: inStr1, b: inStr2, c: inNum1 }, { title: "Inputs I" }),
    inputNode({ a: inStr1, c: inStr2 }, { title: "Inputs II" }),
  ],
  outputs: [
    outputNode({ a: inStr1, b: inStr2, c: inNum1 }, { title: "Outputs I" }),
    outputNode({ a: inStr1, c: inStr2 }, { title: "Outputs II" }),
  ],
});
```

> [!NOTE]
>
> There is no statically defined correspondance between input signatures and
> output signatures in Breadboard, meaning it is not possible to know at
> compile-time which output component will activate for a given input signature.
> (Note that the indices of the input and output components in the arrays above
> have no significance). For this reason, the signatures of all output
> components of a board are **merged** into a single signature, where each port
> is typed with the union of all possible types for that port across its forms:
>
> ```ts
> interface {
>   // string in both forms
>   a: string;
>   // string in form I, mising from form II
>   b: string | undefined;
>   // number in form I, string in form II
>   c: number | string;
> }
> ```

## TODO

- Optional
- Kits
- Casting
- Star Inputs
