/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, code } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

const contextMaker = code(({ topic }) => {
  return {
    context: [
      {
        role: "user",
        parts: [
          {
            text: `
You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up a two-line rhyming poem about it.
Ready?

${topic}`,
          },
        ],
      },
    ],
  };
});

export default await board(({ topic }) => {
  topic.title("Poem topic").isString().examples("the universe within us");
  const { context } = agents.worker({
    $id: "writePoetry",
    context: contextMaker({ $id: "makeContext", topic }).context,
  });
  return { context };
}).serialize({
  title: "Two-line Rhyming Poet",
  description: "A simple example of using of the Worker node",
});
