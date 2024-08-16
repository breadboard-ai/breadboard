---
layout: docs.liquid
title: Build API
tags:
  - api
  - wip
---

The Breadboard Build API is an npm package that allows you to design and compose
boards with TypeScript.

It is an alternative to the [Visual Editor](../visual-editor/), designed for
users who prefer a code-first approach to working with Breadboard.

Boards that you create with the Build API can easily be serialized to
[BGL](../too-long/#the-common-format) (_Breadboard Graph Language_). BGL files
can be executed directly, or imported into the Visual Editor.

## Install

```sh
npm i @breadboard-ai/build
```

## Inputs

All boards begin with the declaration of one or more inputs. The `input`
function declares one input port. Inputs are configured by passing an object
with the following fields:

- `type`: A [Breadboard Type Expression](../type-expressions/) that constrains
  the schema of this port. By default, inputs have type `string`.
- `description`: A text description for documentation purposes.
- `default`: The value this input will have if none is provided.
- `optional`: Allows the input to have no value. (Note that an input cannot be
  `optional` if it has a `default`.)
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

const prompt = input({
  description: "Instructions for the language model.",
  examples: ["Write a poem"],
});

const temperature = input({
  type: "number",
  description: "The degree of randomness in token selection.",
  default: 0.7,
});
```

## Components

Boards do all of their useful things by calling _components_.

When using the Build API, components are imported from npm packages or local
JavaScript modules, and are instantiated by calling them as a function. The
inputs to a component are passed as the first argument of the function, and the
values can come from inputs, or from the outputs of other components.

In addition, some packages include _helper functions_ which provide a more
convenient or more strongly-typed way to instantiate a component.

See the _Kit Documentation_ section on the left-hand side of this guide for a
full catalog of the components you can import and use in your boards.

## Common Components

Examples of some of the most commonly used components are shown here, so that
you can see how they work with the Build API.

### Code

Use the `code` helper to instantiate a `runJavascript` component:

```ts
import { input } from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";

const str = input();

const capitalizer = code(
  // Inputs
  { str },
  // Outputs
  { uppercase: "string" },
  // Implementation
  ({ str }) => {
    return { uppercase: str.toUpperCase() };
  }
);

const capitalized = capitalizer.outputs.uppercase;
```

### Template

Use the `prompt` helper to to instantiate a `promptTemplate` component using a
convenient [JavaScript tagged template
literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals)
syntax:

```ts
import { input } from "@breadboard-ai/build";
import { prompt } from "@google-labs/template-kit";

const poemTopic = input();
const poemPrompt = prompt`Write a poem about ${poemTopic}.`;
```

## Boards & Outputs

<!-- TODO(aomarks) -->

## Serialization

The `serialize` function takes a `BoardDefinition` (the result of calling the
[`board`](#board) function), and generates a JSON-serializable object in
[BGL](../too-long/#the-common-format) format.

```ts
import { serialize } from "@breadboard-ai/build";
import { myBoard } from "./my-board.js";

const bgl = serialize(myBoard);
console.log(JSON.stringify(bgl, null, 2));
```
