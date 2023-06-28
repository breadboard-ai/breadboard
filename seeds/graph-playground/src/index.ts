/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, outro } from "@clack/prompts";
import { readFile } from "fs/promises";

import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import localMemory from "./nodes/local-memory.js";
import javascript from "./nodes/run-javascript.js";
import googleSearch from "./nodes/google-search.js";
import input from "./nodes/input.js";
import output from "./nodes/output.js";
import passthrough from "./nodes/passthrough.js";
import include from "./nodes/include.js";
import vars from "./nodes/vars.js";
import { customNode } from "./nodes/custom-node.js";
import { ReActHelper } from "./react.js";

import { GraphDescriptor } from "./types.js";
import { traverseGraph } from "./traversal.js";
import { ConsoleContext } from "./console-context.js";

intro("Let's follow a graph!");
const context = new ConsoleContext({
  input,
  output,
  passthrough,
  include,
  vars,
  "prompt-template": promptTemplate,
  "text-completion": textCompletion,
  "local-memory": localMemory,
  "run-javascript": javascript,
  "google-search": googleSearch,
  "react-helper": customNode(new ReActHelper()),
});
try {
  const graph = JSON.parse(
    await readFile(process.argv[2], "utf-8")
  ) as GraphDescriptor;
  await traverseGraph(context, graph);
} finally {
  await context.logger.save();
}
outro("Awesome work! Let's do this again sometime");
