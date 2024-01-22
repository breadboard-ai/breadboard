# Breadboard Developer Happy Path

Not a tutorial, but more like a step-by-step onboarding guide with best practices baked in.

Intended for someone to start making recipes as quickly as possible.

## Getting started

Two ways: fork a Replit project or install locally.

### Fork a Replit project

Go to Breadboard Replit Project (TOOD: URL) and click "Fork". This will create roughly the setup that you'll have if you install Breadboard locally.

### Install locally

1. Install Node.js and npm. You can use [nvm](https://github.com/nvm-sh/nvm) to get the right version. (TODO: instructions)

2. Initialize a new npm project. (TODO: instructions)

3. Run `npm init @google-labs/breadboard` to set up the project. (TODO: any further instructions)

### Set up the developer environment

[Developer cycle](https://glazkov.com/2024/01/19/the-breadboard-developer-cycle/)

TODO: extract the relevant bits from the blog post and put them here

## Building a recipe

TODO: intro

### Blank board

Start with a blank board

TODO: should be automatically created during setup

```ts
import { recipe } from "@google-labs/breadboard";

export default await recipe(({ text }) => {
  return { text };
}).serialize({
  title: "Blank board",
  description: "A blank board. Use it to start a new board",
  version: "0.0.1",
});
```

TODO: briefly explain the code

Arguments of the `recipe` function serve as inputs.

The return object contains the outputs.

Inputs and outputs will kind of be a recurring pattern in itself.

### Add inputs and outputs

TODO: Add another input and output to the board, demonstrate how they appear in debugger.

TODO: Show how to describe outputs using this pattern (adapt examples to the flow of this guide):

```ts
// declare inputs in the recipe function
export default await recipe(({ text, generator, context, stopSequences }) => {
  // describe inputs like so:
  text.title("Text").examples(`example goes here`).format("multiline");
  generator.title("Generator").examples("gemini-generator.json");
  context.title("Context").isArray().examples("[]");
  stopSequences.title("Stop Sequences").isArray().optional().default("[]");
  // rest of the board goes here
  // ...
```

TODO: Show how to describe outputs using this pattern:

```ts
// ...
// at the end of the board, describe outputs ...
result
  .title("Context")
  .isObject()
  .description("Agent context after generation");
output.title("Output").isString().description("Agent's output");

// ... and return them
return { result, output };
```

TODO: Throughout this chapter, show how input and output descriptions are reflected in the debugger.

### Make it do something useful

TODO: Introduce the `code` function. Lead with that, rather than nodes. Make a simple board that uses `code` to generate a random number or reverse a string.

Use [code as nodes](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/grammar/4-code-as-nodes.md) to build out this chapter.

At the end of this chapter, we should have a running board that reverses a string.

Victory dance.

### Use kits

TODO: Introduce kits. Show how to import a kit and use it in a board.

TODO: Introduce the concept of a node as a thing that's part of a kit.

Use [nodes and recipes](https://github.com/breadboard-ai/breadboard/blob/main/packages/breadboard/docs/grammar/2-nodes-and-recipes.md) to build out this chapter.

TODO: Brief overview of useful kits and nodes:

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

TODO: Guide the reader to build a board that uses promptTemplate to embed reversed string into a template.

Important pattern: treat inputs and outputs as property bags.
Explain destructuring and spread of properties.

```ts
// ...

const { prompt } = starter.promptTemplate({
  template: "Hello, {{name}}!",
  name: reversed,
});
```

TODO: Encourage using `$id` that describes the purpose of the node.

### Reuse boards

TODO: Use `gemini` board that is included (TODO: gemini board is added automatically to the initial setup) in the recipe.

## Remix boards

TODO: Copy a board in the workspace and see how it immediately appears in the debugger. Make changes to it, then invoke it from the other board.

## Publish boards

TODO: Publish a board JSON to a gist and use it in another board.
Discussion of versioning, all the standard release practices, etc.
