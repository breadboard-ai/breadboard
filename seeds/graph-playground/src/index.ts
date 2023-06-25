/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, log, outro, text } from "@clack/prompts";
import { readFile } from "fs/promises";

import userInput from "./nodes/user-input.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import consoleOutput from "./nodes/console-output.js";
import localMemory from "./nodes/local-memory.js";
import javascript from "./nodes/run-javascript.js";
import googleSearch from "./nodes/google-search.js";
import passthrough from "./nodes/passthrough.js";
import { customNode } from "./nodes/custom-node.js";

import { GraphDescriptor, InputValues, OutputValues } from "./graph.js";
import { Logger } from "./logger.js";
import { FollowContext, follow } from "./runner.js";

import { ReActHelper } from "./react.js";
import include from "./nodes/include.js";

class ConsoleContext extends FollowContext {
  logger: Logger;

  constructor() {
    super({
      input: userInput,
      "prompt-template": promptTemplate,
      "text-completion": textCompletion,
      output: consoleOutput,
      "local-memory": localMemory,
      "run-javascript": javascript,
      "google-search": googleSearch,
      passthrough: passthrough,
      "react-helper": customNode(new ReActHelper()),
      include: include,
    });
    const root = new URL("../../", import.meta.url);
    this.logger = new Logger(`${root.pathname}/experiment.log`);
    this.log = this.log.bind(this);
  }

  log(s: string) {
    this.logger.log(s);
  }

  async requestExternalInput(inputs: InputValues): Promise<OutputValues> {
    const defaultValue = "<Exit>";
    const message = ((inputs && inputs.message) as string) || "Enter some text";
    const input = await text({
      message,
      defaultValue,
    });
    if (input === defaultValue) return { exit: true };
    return { text: input };
  }

  async provideExternalOutput(inputs: InputValues): Promise<void> {
    if (!inputs) return;
    log.step(JSON.stringify(inputs["text"]));
  }
}

intro("Let's follow a graph!");
const context = new ConsoleContext();
try {
  const graph = JSON.parse(
    await readFile(process.argv[2], "utf-8")
  ) as GraphDescriptor;
  await follow(context, graph);
} finally {
  await context.logger.save();
}
outro("Awesome work! Let's do this again sometime");
