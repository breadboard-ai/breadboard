/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, log, outro, spinner, text } from "@clack/prompts";
import { readFile } from "fs/promises";

import input from "./nodes/input.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import output from "./nodes/output.js";
import localMemory from "./nodes/local-memory.js";
import javascript from "./nodes/run-javascript.js";
import googleSearch from "./nodes/google-search.js";
import passthrough from "./nodes/passthrough.js";
import { customNode } from "./nodes/custom-node.js";

import {
  GraphDescriptor,
  InputValues,
  NodeDescriptor,
  OutputValues,
} from "./graph.js";
import { Logger } from "./logger.js";
import { BaseTraversalContext, traverseGraph } from "./traversal.js";

import { ReActHelper } from "./react.js";
import include from "./nodes/include.js";

class ConsoleContext extends BaseTraversalContext {
  logger: Logger;

  constructor() {
    super({
      input,
      output,
      passthrough,
      include,
      "prompt-template": promptTemplate,
      "text-completion": textCompletion,
      "local-memory": localMemory,
      "run-javascript": javascript,
      "google-search": googleSearch,
      "react-helper": customNode(new ReActHelper()),
    });
    const root = new URL("../../", import.meta.url);
    this.logger = new Logger(`${root.pathname}/experiment.log`);
    this.log = this.log.bind(this);
  }

  log(s: string) {
    this.logger.log(s);
  }

  reportProgress(nodeDescriptor: NodeDescriptor): () => void {
    const nodeType = nodeDescriptor.type;
    if (nodeType === "input" || nodeType === "output") return () => ({});
    const s = spinner();
    const nodeId = nodeDescriptor.id;
    s.start(`Traversing "${nodeId}"`);
    return () => s.stop(`Finished traversing "${nodeId}"`);
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
  await traverseGraph(context, graph);
} finally {
  await context.logger.save();
}
outro("Awesome work! Let's do this again sometime");
