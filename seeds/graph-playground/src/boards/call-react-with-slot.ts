/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, type NodeValue } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";

/**
 * An example of a board that uses the `react-witih-slot.ts` board.
 * It fills the empty slot with tools.
 */

/**
 * Creates a breadboard that wires up a bunch of useful tools for ReAct recipe
 * to use.
 * @returns a `tools` breadboard
 */
const tools = () => {
  const tools = new Board();
  const core = tools.addKit(Core);

  // Include a a `search-summarize` breadboard from a URL.
  // The `$id` and `description` are important, because they help ReAct recipe
  // figure out the purpose of each tool.
  const search = core.include({
    path: "search-summarize.json",
    $id: "search",
    description:
      "Useful for when you need to find facts. Input should be a search query.",
  });

  // Include `math` breadboard from a URL.
  const math = core.include({
    path: "math.json",
    $id: "math",
    description:
      "Useful for when you need to solve math problems. Input should be a math problem to be solved.",
  });

  // Wire the board:
  // - Wire input to the `search` and `math` include nodes.
  // - Additionally, wire input to `reflect` node, which allows the ReAct recipe
  // to introspect the graph (and get access to `description` and `$id`
  // properties above)
  // - Finally, wire the all of the nodes to outputs.
  tools
    .input()
    .wire("graph", core.reflect().wire("graph", tools.output()))
    .wire("math->text", math.wire("text", tools.output()))
    .wire("search->text", search.wire("text", tools.output()));

  // The `tools` board is ready to go!
  return tools;
};

// This is the main board that controls the rest of the board.
const board = new Board({
  title: "Calling ReAct with slots",
  description:
    "An implementation of the [ReAct](https://react-lm.github.io/) AI pattern that relies on Breadboard [slots](https://github.com/google/labs-prototypes/blob/main/seeds/breadboard/docs/nodes.md#the-slot-node) to supply tools to ReAct. The slots are currently populated by two boards: `search-summarize` and `math`.",
  version: "0.0.1",
});
const core = board.addKit(Core);

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
      .include({
        path: "react-with-slot.json",
        slotted: { tools: tools() as unknown as NodeValue },
      })
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
