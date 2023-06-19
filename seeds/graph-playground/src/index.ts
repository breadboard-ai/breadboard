/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, outro, text, log, spinner } from "@clack/prompts";
import { GenerateTextResponse, Text, palm } from "@google-labs/palm-lite";
import { config } from "dotenv";
import { readFile } from "fs/promises";

import { GraphDescriptor, NodeHandlers, follow } from "./graph.js";
import { Logger } from "./logger.js";

config();

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("API_KEY not set");

const root = new URL("../../", import.meta.url);
const logger = new Logger(`${root.pathname}/experiment.log`);

const substitute = (template: string, values: Record<string, string>) => {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replace(`{{${key}}}`, value),
    template
  );
};

const parametersFromTemplate = (template: string): string[] => {
  const matches = template.matchAll(/{{(?<name>\w+)}}/g);
  const parameters = Array.from(matches).map(
    (match) => match.groups?.name || ""
  );
  return parameters;
};

const context: string[] = [];

const handlers: NodeHandlers = {
  "user-input": async (inputs) => {
    const defaultValue = "<Exit>";
    const message = ((inputs && inputs.message) as string) || "Enter some text";
    // If this node is a service, why does it contain experience?
    // It seems like there's some sort of "configuration store" or something
    // that is provided by the experience, but delivered by the service.
    const input = await text({
      message,
      defaultValue,
    });
    if (input === defaultValue) return { exit: true };
    return { text: input };
  },
  "prompt-template": async (inputs) => {
    if (!inputs) throw new Error("Prompt template requires inputs");

    const template = inputs.template as string;
    const parameters = parametersFromTemplate(template);
    if (!parameters.length) return { prompt: template };

    const substitutes = parameters.reduce((acc, parameter) => {
      if (inputs[parameter] === undefined)
        throw new Error(`Input is missing parameter "${parameter}"`);
      return { ...acc, [parameter]: inputs[parameter] };
    }, {});

    const prompt = substitute(template, substitutes);
    // log.info(`Prompt: ${prompt}`);
    return { prompt };
  },
  "text-completion": async (inputs) => {
    if (!inputs) throw new Error("Text completion requires inputs");
    // const s = spinner();
    // How to move these outside of the handler?
    // These need to be part of the outer machinery, but also not in the actual
    // follow logic.
    // My guess is I am seeing some sort of lifecycle situation here?
    // s.start("Generating text completion");
    const prompt = new Text().text(inputs["text"] as string);
    const stopSequences = (inputs["stop-sequences"] as string[]) || [];
    stopSequences.forEach((stopSequence) =>
      prompt.addStopSequence(stopSequence)
    );
    const request = palm(API_KEY).text(prompt);
    const data = await fetch(request);
    const response = (await data.json()) as GenerateTextResponse;
    // s.stop("Text completion generated");
    const completion = response?.candidates?.[0]?.output as string;
    return { completion };
  },
  "console-output": async (inputs) => {
    if (!inputs) return {};
    log.step(inputs["text"] as string);
    return {};
  },
  "accumulating-context": async (inputs) => {
    if (!inputs) return {};
    Object.entries(inputs).forEach(([key, value]) => {
      context.push(`${key}: ${value}`);
    });
    // TODO: This is a hack to get around the fact that we don't have a way to
    //       exit the graph.
    if (context.length > 20) return { exit: true };
    return { context: context.join("\n") };
  },
};

intro("Let's follow a graph!");
const graph = JSON.parse(
  await readFile(process.argv[2], "utf-8")
) as GraphDescriptor;
await follow(graph, handlers, (s: string) => {
  logger.log(s);
});
outro("Awesome work! Let's do this again sometime");
await logger.save();
