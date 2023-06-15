/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, outro, text, log, spinner } from "@clack/prompts";
import {
  GenerateTextResponse,
  Text,
  palm,
} from "@google-labs-prototypes/palm-lite";
import { config } from "dotenv";

import {
  ControlValue,
  GraphDescriptor,
  NodeHandlers,
  follow,
} from "./graph.js";

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
    // If this node is a service, why does it contain experience?
    // It seems like there's some sort of "configuration store" or something
    // that is provided by the experience, but delivered by the service.
    const input = await text({
      message: "Enter some text",
    });
    // This is likely not a special control value, but rather a kind of output
    // Like: `exit: boolean`
    if (!input) return { control: ControlValue.stop };
    return { outputs: { text: input } };
  },
  "text-completion": async (inputs) => {
    if (!inputs) return { control: ControlValue.error };
    const s = spinner();
    // How to move these outside of the handler?
    // These need to be part of the outer machinery, but also not in the actual
    // follow logic.
    // My guess is I am seeing some sort of lifecycle situation here?
    s.start("Generating text completion");
    const prompt = new Text().text(inputs["text"] as string);
    const request = palm(API_KEY).text(prompt);
    const data = await fetch(request);
    const response = (await data.json()) as GenerateTextResponse;
    s.stop("Success!");
    const completion = response?.candidates?.[0]?.output as string;
    return { outputs: { completion } };
  },
  "console-output": async (inputs) => {
    if (!inputs) return { control: ControlValue.error };
    log.info(inputs["text"] as string);
    return {};
  },
};

intro("Let's follow a graph!");
await follow(graph, handlers);
outro("Awesome work! Let's do this again sometime");
