/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: Make this API better.

import { Graph } from "../dist/src/graph.js";
import { Logger } from "../dist/src/logger.js";
import { Runner } from "../dist/src/runner.js";

import userInput from "../dist/src/nodes/user-input.js";
import textCompletion from "../dist/src/nodes/text-completion.js";
import consoleOutput from "../dist/src/nodes/console-output.js";

const root = new URL("..", import.meta.url);
const logger = new Logger(`${root.pathname}/experiment.log`);

const graph = new Graph();

// Nifty hack to save from typing characters.
const wire = graph.newNode;

wire(userInput).to(
  { $entry: true, text: "text" },
  wire(textCompletion).to({ completion: "text" }, consoleOutput)
);

const runner = new Runner();
try {
  await runner.run(graph, (s) => {
    logger.log(s);
  });
} catch (e) {
  logger.log(e.message);
} finally {
  logger.save();
}
