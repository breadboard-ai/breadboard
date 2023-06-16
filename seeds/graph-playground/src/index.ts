/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, outro, text, log, spinner } from "@clack/prompts";
import { GenerateTextResponse, Text, palm } from "@google-labs/palm-lite";
import { config } from "dotenv";
import { readFile } from "fs/promises";

import {
  ConfigurationStore,
  ControlValue,
  GraphDescriptor,
  NodeConfiguration,
  NodeHandlers,
  NodeIdentifier,
  follow,
} from "./graph.js";

config();

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY not set");

const substitute = (template: string, values: Record<string, string>) => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, value),
    template
  );
};

const handlers: NodeHandlers = {
  "user-input": async (_config) => {
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
  "prompt-template": async (config, inputs) => {
    if (!inputs) throw new Error("Prompt template requires inputs");
    const question = inputs["question"] as string;
    const template = config["prompt"];
    const prompt = substitute(template, { question });
    return { outputs: { prompt } };
  },
  "text-completion": async (config, inputs) => {
    if (!inputs) throw new Error("Text completion requires inputs");
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
    s.stop("Text completion generated");
    const completion = response?.candidates?.[0]?.output as string;
    return { outputs: { completion } };
  },
  "console-output": async (config, inputs) => {
    if (!inputs) return {};
    log.step(inputs["text"] as string);
    return {};
  },
};

/**
 * This is a mocked out configuration store. Imagine a database or something.
 */
class NodeConfig implements ConfigurationStore {
  async get(id: NodeIdentifier) {
    if (id === "prompt-template-1") {
      return {
        prompt:
          "Analyze the following question and instead of answering, list out steps to take to answer the question: {{question}}",
      } as NodeConfiguration;
    }
    return {};
  }
}

const configuration = new NodeConfig();

const logger = (s: string) => {
  log.message(s, { symbol: "🤖" });
};

intro("Let's follow a graph!");
const graph = JSON.parse(
  await readFile(process.argv[2], "utf-8")
) as GraphDescriptor;
await follow(graph, handlers, configuration, logger);
outro("Awesome work! Let's do this again sometime");
