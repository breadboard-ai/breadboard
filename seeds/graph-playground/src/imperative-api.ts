/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphRunner, Graph } from "./graph.js";

import userInput from "./nodes/user-input.js";
import promptTemplate from "./nodes/prompt-template.js";
import textCompletion from "./nodes/text-completion.js";
import consoleOutput from "./nodes/console-output.js";
import localMemory from "./nodes/local-memory.js";
import { Logger } from "./logger.js";

const root = new URL("../../", import.meta.url);
const logger = new Logger(`${root.pathname}/experiment.log`);

const graph = new Graph();

// Nifty hack to save from typing characters.
const node = graph.newNode;

const print = node(consoleOutput);
const rememberAlbert = node(localMemory);
const rememberFriedrich = node(localMemory);

const albert = node(promptTemplate, {
  template:
    "Add a single argument to a debate between a scientist named Albert and a philosopher named Friedrich. You are Albert, and you are warm, funny, inquisitve, and passionate about uncovering new insights with Friedrich. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating.\n\n== Debate History\n{{context}}\n\n==Additional Single Argument\n\nAlbert:",
}).to(
  { prompt: "text" },
  node(textCompletion, { "stop-sequences": ["\nFriedrich", "\n**Friedrich"] })
    .to(
      { completion: "context" },
      node(promptTemplate, {
        template:
          "Restate the paragraph below in the voice of a brillant 20th century scientist. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
      }).to(
        { prompt: "text" },
        node(textCompletion).to({ completion: "text" }, print)
      )
    )
    .to({ completion: "Albert" }, rememberAlbert)
);

const friedrich = node(promptTemplate, {
  template:
    "Add a single argument to a debate between a philosopher named Friedrich and a scientist named Albert. You are Friedrich, and you are disagreeable, brooding, skeptical, sarcastic, yet passionate about uncovering new insights with Albert. To keep the debate rich and satisfying, you vary your sentence patterns and keep them from repeating.\n\n== Conversation Transcript\n{{context}}\n\n==Additional Single Argument\nFriedrich:",
}).to(
  { prompt: "text" },
  node(textCompletion, { "stop-sequences": ["\nAlbert", "\n**Albert"] })
    .to(
      { completion: "context" },
      node(promptTemplate, {
        template:
          "Restate the paragraph below in the voice of a 19th century philosopher. Change the structure of the sentences completely to mix things up.\n==Paragraph\n{{context}}\n\nRestatement:",
      }).to(
        { prompt: "text" },
        node(textCompletion).to({ completion: "text" }, print)
      )
    )
    .to({ completion: "Friedrich" }, rememberFriedrich)
);

rememberFriedrich.to({ context: "context" }, albert);
rememberAlbert.to({ context: "context" }, friedrich);

node(userInput, { message: "What is the topic of the debate?" }).to(
  { $entry: true, text: "topic" },
  node(localMemory).to({ context: "context" }, albert)
);

const runner = new GraphRunner();
try {
  await runner.run(graph, (s: string) => {
    logger.log(s);
  });
} catch (e) {
  logger.log((e as Error).message);
} finally {
  logger.save();
}
