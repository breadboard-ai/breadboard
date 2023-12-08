/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import Starter from "@google-labs/llm-starter";

const board = new Board({
  title: "Board Caller",
  description:
    "Takes a tool-calling-capable generator and a lsit of board URLs, and helps generator call these boards as tools",
  version: "0.0.1",
});

const starter = board.addKit(Starter);
const core = board.addKit(Core);

const output = board.output({
  $id: "output",
  // TODO: Add schema
});

const parameters = board.input({
  $id: "parameters",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to use with tool calling",
        default: "What is the square root of e?",
      },
      generator: {
        type: "string",
        title: "Generator",
        description: "The URL of the generator to call",
        default: "/graphs/openai-gpt-35-turbo.json",
      },
      boards: {
        type: "array",
        title: "Tools",
        description: "URLs of boards to use as tools",
        items: {
          type: "string",
        },
        default:
          '[ "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/math.json", "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/search-summarize.json" ]',
      },
    },
  },
});

/**
 * Formats a list of boards as function declarations that can be supplied
 * to a generator.
 */
const formatFunctionDeclarations = core.invoke((board, input, output) => {
  const core = board.addKit(Core);

  const turnBoardsToFunctions = core.map((_, input, output) => {
    // for each URL, invoke board-as-function.
    input.wire(
      "item->boardURL",
      core
        .invoke({
          $id: "boardToFunction",
          path: "/graphs/board-as-function.json",
        })
        .wire("function->", output)
    );
  });

  input.wire(
    "boards->list",
    turnBoardsToFunctions.wire(
      "list->json",
      starter
        .jsonata({
          $id: "formatAsTools",
          expression: `[function]`,
        })
        .wire("result->tools", output)
    )
  );
});

const generate = core
  .invoke({ $id: "generate" })
  .wire(
    "<-useStreaming",
    core.passthrough({ $id: "noStreaming", useStreaming: false })
  );

parameters
  .wire("text->", generate)
  .wire("boards->", formatFunctionDeclarations.wire("tools->", generate))
  .wire("generator->path", generate.wire("tool_calls->", output));

export default board;
