# Boards

This directory contains boards for Breadboard. Each board is a demonstration of what how you can use Breadboard to solve a particular problem. Many of these boards can be included directly inside boards.

## Running a Board

Note: If you have not already installed the breadboard CLI, you can do so by running the following command:

```bash
npm install -g @breadboard/breadboard-cli
```

or, if you are running from the monorepo:

```bash
npm i
npm run build
npm i
```

You need to install all the deps, then build the CLI, then install the deps again to install the command. If you plan to run from the mono repo, prepend `npx` to the commands below.

To run a board, run the following command from the root of the repository:

```bash
breadboard run boards/<board-name>
```

To run from the UI:

```bash
breadboard debug boards/<board-name>
```

## Creating a new Board

To create a new board, create a new directory in this directory. The name of the directory should be the name of the board and should contain a `README.md` file that describes the board and a TypeScript file that contains the code for the board.

TODO: Add more details here.

## List of Boards

### Use Cases

A use case board is something that can be directly integrated into a Breadboard to solve a particular problem. These boards are designed to be used as-is and have no dependencies on other boards.

- [Fetch RSS Feed](./use-case/fetch-rss/README.md)
- [Fetch ATOM Feed](./use-case/fetch-atom/README.md)
- [Search Google](./use-case/search-google/README.md)
- [Generate Embedding](./use-case/generate-embedding/README.md)
- [Generate Text](./use-case/generate-text/README.md)
- [Convert String to JSON](./use-case/convert-string-to-json/README.md)

### Concepts

A concept board is something that demonstrates a particular concept in Breadboard, it might not be something that can be used directly in an application, but it is a good starting point.

- [Accumulating Context](./concept/accumulating-context/README.md)
- [Few-Shot Learning](./concept/few-shot/README.md)
- [RAG Query](./concept/rag-query/README.md)
