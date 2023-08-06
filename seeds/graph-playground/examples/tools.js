/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { writeFile } from "fs/promises";

// A URL to a repository containing various saved breadboard layouts.
const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs";

const tools = new Board();

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
// Now, let's save it to a file...
await writeFile("examples/tools.json", JSON.stringify(tools, null, 2));

// .. and turn it into a diagram.
await writeFile(
  "examples/tools.md",
  `# Tools Diagram\n\n\`\`\`mermaid\n${tools.mermaid()}\n\`\`\``
);
