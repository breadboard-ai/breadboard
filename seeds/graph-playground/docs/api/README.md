@google-labs/graph-playground / [Exports](modules.md)

# Playing with graphs

This is a prototyping ground for experimenting with representing generative AI applications as composable graphs.

## Getting started

:zero: Follow instructions on the [DEVELOPING.md](../../DEVELOPING.md) to set up the repo for work.

:one: Open [graphs.code-workspace](../../graphs.code-workspace) in VSCode. This workspace brings all the relevant packages in the monorepo into one place, so you can easily navigate between them and not worry about other bits that aren't relevant to graphs.

There are five packages in this workspace:

1. `seeds/graph-runner` -- an implementation of the graph traversal machine.
2. `seeds/breadboard` -- a nascent helper library for making graphs.
3. `seeds/llm-starter` -- the nascent LLM Starter Kit, a collection of nodes that are useful for making generative AI apps.
4. `seeds/graph-playground` -- this package, which a collection of sample code for how to use `seeds/breadboard` and `seeds/llm-starter` to make graphs.

:two: In `seeds/graph-playground`, create `.env` file with the following content:

```bash
PALM_KEY="your GCP API key"
GOOGLE_CSE_ID="your Google custom search engine id"
```

The `API` key must have the following services allowed (and enabled in the corresponding GCP project):

- Generative Language API
- Custom Search API

The `GOOGLE_CSE_ID` is the Programmable Search Engine ID. You can create one [here](https://programmablesearchengine.google.com/). When configuring the search engine, make sure to enable the `Search the entire Web` option.

:three: start playing.

Here's a quick lay of the land:

- This package's entry point, `index.ts` is basically a simple CLI that takes a path to a graph file and runs it. The graph is defined in a JSON format which is not yet fully baked. The CLI app uses [`@clack/prompts`](https://github.com/natemoo-re/clack/tree/main/packages/prompts#readme) to make CLI a bit prettier. To invoke the CLI, use `npm run dev` command. It will build the package and run the CLI with the given graph file.

- There are a few sample boards in the [`boards`](./src/boards/) dir. These boards are used to generate graphs. To generate graphs from these boards, use `npm run prepare-graphs` command. It will generate JSON files in the [`graphs`](./graphs/) dir and Markdown files with [Mermaid](https://mermaid-js.github.io/mermaid/#/) diagrams in [`docs/graphs`](./docs/graphs/) dir.

Here are some examples:

```bash

# Just [input] -> [completion] -> [output]
npm run dev graphs/simplest.json

# Adds a template:
# [input] -> [template] -> [completion] -> [output]
npm run dev graphs/simple-prompt.json

# Uses config to run without asking for input
npm run dev graphs/auto-simple-prompt.json

# An LLM-powered math solver
npm run dev graphs/math.json

# An LLM-powered search summarizer
npm run dev graphs/search-summarize.json

# A zero-shot ReAct loop implemenation
# that includes both `math.json` and `search-summarize.json`
npm run dev graphs/react-with-include.json

```

For a more detailed explanation of how graph traversal machine works, see [README.md](../graph-runner/README.md) in the `graph-runner` package.

For documentation on the Breadboard library, see [README.md](../breadboard/README.md) in the `seeds/breadboard` package.

For documentation on the LLM Starter Kit, see [README.md](../llm-starter/README.md) in the `seeds/llm-starter` package.
