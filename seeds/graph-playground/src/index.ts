/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { intro, outro } from "@clack/prompts";
import { readFile } from "fs/promises";

import {
  type GraphDescriptor,
  traverseGraph,
  coreHandlers,
  customNode,
  ReActHelper,
} from "@google-labs/graph-runner";

import { ConsoleContext } from "./console-context.js";

intro("Let's follow a graph!");
const context = new ConsoleContext({
  ...coreHandlers,
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
