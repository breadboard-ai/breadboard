/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

const makePoetPrompt = code(({ topic }) => {
  return {
    prompt: `
You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up a two-line rhyming poem about it.
Ready?

The topic is: ${topic}`,
  };
});

export default await board(({ topic }) => {
  topic.title("Poem topic").isString().examples("the universe within us");
  const instruction = agents.instruction({
    $id: "poetPrompt",
    prompt: makePoetPrompt({ $id: "makePoetPrompt", topic }).prompt,
  });
  const worker = agents.worker({
    $id: "writePoetry",
    context: instruction.context,
  });
  return { context: worker.context };
}).serialize({
  title: "Two-line Rhyming Poet",
  description: "A simple example of using of the Worker node",
});
