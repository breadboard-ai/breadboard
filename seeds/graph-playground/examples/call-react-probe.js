/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
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

  // Wire the breadboard:
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

  // The `tools` breadboard is ready to go!
  return tools;
};

// This is the main breadboard that controls the rest of the breadboards.
const main = new Board();
main.addKit(Starter);

// Include the `react-with-slot` breadboard from a URL, wiring input to it.
// Slot the `tools` breadboard into the `tools` slot.
// This is how the ReAct recipe will consume the `tools` breadboard we created
// above.
main.input("Ask ReAct").wire(
  "text",
  main
    .include(`${REPO_URL}/react-with-slot.json`, {
      slotted: { tools: getTools() },
    })
    .wire("text", main.output())
);

// We can save the resulting breadboard
await writeFile(
  "examples/call-react-with-slot.json",
  JSON.stringify(main, null, 2)
);

// .. or turn it into a diagram.
await writeFile(
  "examples/call-react-with-slot.md",
  `# Call React With Slot Diagram\n\n\`\`\`mermaid\n${main.mermaid()}\n\`\`\``
);

// Let's create a probe to help us see what's going on.
// A probe is just an `EventTarget` instance. You can use the
// `EventTarget` class itself or implement the `EventTarget` interface.
const probe = new EventTarget();

// We'll have a simple event handler for the probe:
// just print things to console.
const eventHandler = (e) => {
  console.log(e.type, e.detail);
};
// Listen to ALL THE EVENTS.
probe.addEventListener("input", eventHandler);
probe.addEventListener("skip", eventHandler);
probe.addEventListener("node", eventHandler);
probe.addEventListener("output", eventHandler);

// Alternatively, we can use a `LogProbe` that does the same thing.

// Run the breadboard, supplying our probe as an extra argument.
const output = await main.runOnce(
  {
    text: "What's the square root of the number of holes on a typical breadboard?",
  },
  probe
);
console.log("output", output.text);
