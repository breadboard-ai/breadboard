/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Core } from "@google-labs/core-kit";

/**
 * An example of a board that uses the `react-witih-lambdas.ts` board.
 * It passes the board a list of tools.
 */

// This is the main board that controls the rest of the board.
const board = new Board({
  title: "Calling ReAct with lambdas",
  description:
    "An implementation of the [ReAct](https://react-lm.github.io/) AI pattern that relies on Breadboard [lambdas](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#the-lambda-node) to supply tools to ReAct. They are currently populated by two boards: `search-summarize` and `math`.",
  version: "0.0.1",
});
const kit = board.addKit(Starter);
const core = board.addKit(Core);

const tools = kit
  .jsonata(
    `
  [
    {
      "tool": "search",
      "description":
        "Useful for when you need to find facts. Input should be a search query.",
      "board": search
    },
    {
      "tool": "math",
      "description":
        "Useful for when you need to solve math problems. Input should be a math problem to be solved",
      "board": math
    }
  ]`
  )
  .wire("search<-board", core.import({ path: "search-summarize.json" }))
  .wire("math<-board", core.import({ path: "math.json" }));

// Include the `react-with-slot` board from a URL, wiring input to it.
// Slot the `tools` board into the `tools` slot.
// This is how the ReAct recipe will consume the `tools` board we created
// above.
board
  .input({
    $id: "userRequest",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Problem",
          description: "A problem to be solved",
        },
      },
      required: ["text"],
    },
  })
  .wire(
    "text",
    core
      .invoke({ path: `react-with-lambdas.json` })
      .wire("tools<-result", tools)
      .wire(
        "text",
        board.output({
          $id: "reactResponse",
          schema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                title: "ReAct",
                description: "ReAct's response to the user's problem",
              },
            },
            required: ["text"],
          },
        })
      )
  );

export default board;
