/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

/**
 * An example of a board that uses the `react-witih-slot.ts` board.
 * It fills the empty slot with tools.
 */

// A URL to a repository containing the saved `react-with-slot` board,
// as well as all the tool boards.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs";

/**
 * Creates a breadboard that wires up a bunch of useful tools for ReAct recipe
 * to use.
 * @returns a `tools` breadboard
 */
const tools = () => {
  const tools = new Board();
  tools.addKit(Starter);

  // Include a a `search-summarize` breadboard from a URL.
  // The `$id` and `description` are important, because they help ReAct recipe
  // figure out the purpose of each tool.
  const search = tools.include(`${REPO_URL}/search-summarize.json`, {
    $id: "search",
    description:
      "Useful for when you need to find facts. Input should be a search query.",
  });

  // Include `math` breadboard from a URL.
  const math = tools.include(`${REPO_URL}/math.json`, {
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
    .wire("graph", tools.reflect().wire("graph", tools.output()))
    .wire("math->text", math.wire("text", tools.output()))
    .wire("search->text", search.wire("text", tools.output()));

  // The `tools` board is ready to go!
  return tools;
};

// This is the main board that controls the rest of the board.
const board = new Board();
board.addKit(Starter);

// Include the `react-with-slot` board from a URL, wiring input to it.
// Slot the `tools` board into the `tools` slot.
// This is how the ReAct recipe will consume the `tools` board we created
// above.
board.input("Ask ReAct").wire(
  "text",
  board
    .include(`./graphs/react-with-slot.json`, {
      slotted: { tools: tools() },
    })
    .wire("text", board.output())
);

export default board;
