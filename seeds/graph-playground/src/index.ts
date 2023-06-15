/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, outro, text, log, spinner } from "@clack/prompts";
import {
  GenerateTextResponse,
  Text,
  TextCompletion,
  palm,
} from "@google-labs-prototypes/palm-lite";
import { config } from "dotenv";

import { GraphDescriptor, NodeHandlers, follow } from "./graph.js";

config();

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY not set");

const graph: GraphDescriptor = {
  edges: [
    {
      entry: true,
      from: { node: "user-input-1", output: "text" },
      to: { node: "text-completion-1", input: "text" },
    },
    {
      from: { node: "text-completion-1", output: "completion" },
      to: { node: "console-output-1", input: "text" },
    },
  ],
  nodes: [
    { id: "user-input-1", type: "user-input" },
    { id: "text-completion-1", type: "text-completion" },
    { id: "console-output-1", type: "console-output" },
  ],
};

const handlers: NodeHandlers = {
  "user-input": async () => {
    const input = await text({
      message: "Enter some text",
    });
    return {
      text: input,
    };
  },
  "text-completion": async (inputs) => {
    if (!inputs) return {};
    const s = spinner();
    s.start("Generating text completion");
    const prompt = new Text().text(inputs["text"] as string);
    const request = palm(API_KEY).text(prompt);
    const data = await fetch(request);
    const response = (await data.json()) as GenerateTextResponse;
    s.stop("Success!");
    return {
      completion: response?.candidates?.[0]?.output as string,
    };
  },
  "console-output": async (inputs) => {
    if (!inputs) return {};
    log.info(inputs["text"] as string);
    return {};
  },
};

intro("Let's follow a graph!");
await follow(graph, handlers);
outro("Awesome work! Let's do this again sometime");
