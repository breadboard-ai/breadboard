/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Breadboard, Starter } from "@google-labs/breadboard";

const getTools = () => {
  const tools = new Breadboard();
  const kit = new Starter(tools);

  const search = kit.include({
    $ref: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/search-summarize.json",
    description:
      "Useful for when you need to find facts. Input should be a search query.",
  });
  const math = kit.include({
    $ref: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/math.json",
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

kit.input({ message: "Ask ReAct" }).wire(
  "text",
  kit
    .include({
      $ref: "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/graph-playground/graphs/react-with-slot.json",
      slotted: { tools: getTools() },
    })
    .wire("text", kit.output())
);
