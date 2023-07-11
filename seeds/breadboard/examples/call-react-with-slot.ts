/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Starter } from "@google-labs/breadboard";
import { toMermaid } from "@google-labs/graph-runner";
import { writeFile } from "fs/promises";

import { config } from "dotenv";

config();

// A program can contain multiple breadboards. Here's an example that uses four
// of them.

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs";

/**
 * Creates a breadboard that wires up a bunch of useful tools for ReAct recipe
 * to use.
 * @returns a `tools` breadboard
 */
const getTools = () => {
  const tools = new Board();
  const kit = new Starter(tools);

  // Include a a `search-summarize` breadboard from a URL.
  // The `$id` and `description` are important, because they help ReAct recipe
  // figure out the purpose of each tool.
  const search = kit.include(`${REPO_URL}/search-summarize.json`, {
    $id: "search",
    description:
      "Useful for when you need to find facts. Input should be a search query.",
  });

  // Include `math` breadboard from a URL.
  const math = kit.include(`${REPO_URL}/math.json`, {
    $id: "math",
    description:
      "Useful for when you need to solve math problems. Input should be a math problem to be solved.",
  });

  // Wire the breadboard:
  // - Wire input to the `search` and `math` include nodes.
  // - Additionally, wire input to `reflect` node, which allows the ReAct recipe
  // to introspect the graph (and get access to `description` and `$id`
  // properties above)
  // - Finally, wire the all of the nodes to outputs.
  kit
    .input()
    .wire("graph", kit.reflect().wire("graph", kit.output()))
    .wire("math->text", math.wire("text", kit.output()))
    .wire("search->text", search.wire("text", kit.output()));

  // The `tools` breadboard is ready to go!
  return tools;
};

// This is the main breadboard that controls the rest of the breadboards.
const main = new Board();
const kit = new Starter(main);

// Include the `react-with-slot` breadboard from a URL, wiring input to it.
// Slot the `tools` breadboard into the `tools` slot.
// This is how the ReAct recipe will consume the `tools` breadboard we created
// above.
kit.input("Ask ReAct").wire(
  "text",
  kit
    .include(`${REPO_URL}/react-with-slot.json`, {
      slotted: { tools: getTools() },
    })
    .wire("text", kit.output())
);

// We can save the resulting breadboard
await writeFile(
  "examples/call-react-with-slot.json",
  JSON.stringify(main, null, 2)
);

// .. or turn it into a diagram.
await writeFile(
  "examples/call-react-with-slot.md",
  `# Call React With Slot Diagram\n\n\`\`\`mermaid\n${toMermaid(main)}\n\`\`\``
);

// To run the whole thing:

// Add the inputs.
main.addInputs({
  text: "What's the square root of the number of holes on a typical breadboard?",
});

// Add the output event handler.
main.on("output", (event) => {
  const { detail } = event as CustomEvent;
  console.log(detail.text);
});

// Run the breadboard.
await main.run();
