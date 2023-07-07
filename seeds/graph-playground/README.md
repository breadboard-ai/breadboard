# Playing with graphs

This is a prototyping ground for experimenting with representing generative AI applications as composable graphs.

## Getting started

:zero: Follow instructions on the [DEVELOPING.md](../../DEVELOPING.md) to set up the repo for work.

:one: Open [graphs.code-workspace](../../graphs.code-workspace) in VSCode. This workspace brings all the relevant packages in the monorepo into one place, so you can easily navigate between them and not worry about other bits that aren't relevant to graphs.

There are three packages in this workspace:

1. `seeds/graph-runner` -- a very basic implementation of a graph traversal engine
2. `seeds/graph-playground` -- this package, which is a kind of sample code for how to use `seeds/graph-runner`. Depends on `seeds/graph-runner`.
3. `seeds/breadboard` -- a nascent helper library for making graphs. Depends on `seeds/graph-runner` and is mostly non-functional at the moment.

:two: In `seeds/graph-playground`, create `.env` file with the following content:

```bash
API_KEY="your GCP API key"
GOOGLE_CSE_ID="your Google custom search engine id"
```

The `API` key must have the following services allowed (and enabled in the corresponding GCP project):

- Generative Language API
- Custom Search API

The `GOOGLE_CSE_ID` is the Programmable Search Engine ID. You can create one [here](https://programmablesearchengine.google.com/). When configuring the search engine, make sure to enable the `Search the entire Web` option.

:three: start playing.

Here's a quick lay of the land:

- This package's entry point, `index.ts` is basically a simple CLI that takes a path to a graph file and runs it. The graph is defined in a primordial JSON format which is most definitely going to change.

- The meat of the implementation is the `console-context.ts`, which is a CLI-oriented implementation of the `GraphTraversalContext` interface. It's super-simple and is as close to "echo" as it gets. It uses [`@clack/prompts`](https://github.com/natemoo-re/clack/tree/main/packages/prompts#readme) to make CLI a bit prettier, but that's about it.

- The `console-context.ts` outputs logs into `./experiment.log`, which git-ignored. Graph traversal is very chatting currently, and the log file can get quite large. Use it to examine what the heck is going on and debug the graph.

- There are a few sample graphs in the [`graphs`](./graphs/) folder. For convenience, use `npm run dev` command. It will build the package and run the CLI with the given graph file. Add your own graphs there.

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

- To visualize graphs, there's is a `scripts/mermaidize.js` script that converts a graph file into a [Mermaid](https://mermaid-js.github.io/mermaid/#/) diagram, embedded into a Markdown file. For convenience, use `npm run merm` to run it. The script will generate files in the [`docs/graphs`](docs/graphs/) dir, one for each file in the `graphs` dir.

For a more detailed explanation of how graphs work, see [README.md](../graph-runner/README.md) in the `graph-runner` package.
