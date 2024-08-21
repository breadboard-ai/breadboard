# Breadboard Build

[![Published on npm](https://img.shields.io/npm/v/@breadboard-ai/build.svg?logo=npm)](https://www.npmjs.com/package/@breadboard-ai/build)

The Breadboard Build API allows you to design and compose boards with
[TypeScript](https://www.typescriptlang.org/).

It is an alternative to the Visual Editor, designed for users who prefer a
code-first approach to working with Breadboard.

Boards that you create with the Build API can be serialized to BGL (Breadboard
Graph Language), which can then be executed directly, or imported into the
Visual Editor.

## Install

```sh
npm i @breadboard-ai/build
```

## Documentation

Please refer to the [Build
API](https://breadboard-ai.github.io/breadboard/docs/build/) section of the
Breadboard Documentation site for full documentation.

## Example

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
