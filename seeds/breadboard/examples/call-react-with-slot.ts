/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Breadboard, Starter } from "@google-labs/breadboard";
import { toMermaid } from "@google-labs/graph-runner";
import { writeFile } from "fs/promises";

import { config } from "dotenv";

config();

const REPO_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/";

const getTools = () => {
  const tools = new Breadboard();
  const kit = new Starter(tools);

  const search = kit.include(`${REPO_URL}/search-summarize.json`, {
    $id: "search",
    description:
      "Useful for when you need to find facts. Input should be a search query.",
  });
  const math = kit.include(`${REPO_URL}/math.json`, {
    $id: "math",
    description:
      "Useful for when you need to solve math problems. Input should be a math problem to be solved.",
  });

  kit
    .input()
    .wire("graph", kit.reflect().wire("graph", kit.output()))
    .wire("math->text", math.wire("text", kit.output()))
    .wire("search->text", search.wire("text", kit.output()));
  return tools;
};

const main = new Breadboard();
const kit = new Starter(main);

kit.input("Ask ReAct").wire(
  "text",
  kit
    .include(`${REPO_URL}/react-with-slot.json`, {
      slotted: { tools: getTools() },
    })
    .wire("text", kit.output())
);

// Save breadboard
await writeFile(
  "examples/call-react-with-slot.json",
  JSON.stringify(main, null, 2)
);

// Make it into a diagram
await writeFile(
  "examples/call-react-with-slot.md",
  `# Google News Diagram\n\n\`\`\`mermaid\n${toMermaid(main)}\n\`\`\``
);

// Run breadboard
main.addInputs({
  text: "What's the square root of the number of holes on a typical breadboard?",
});

main.on("output", (event) => {
  const { detail } = event as CustomEvent;
  console.log(detail.text);
});

await main.run();
