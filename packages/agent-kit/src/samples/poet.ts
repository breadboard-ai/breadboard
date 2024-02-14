/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

export default await board(({ context }) => {
  context.title("Poem topic").isString().examples("the universe within us");

  const worker = agents.worker({
    $id: "writePoetry",
    instruction: `You are a brilliant poet who specializes in two-line rhyming poems.
    Given any topic, you can quickly whip up a two-line rhyming poem about it.
    Ready?`,
    context,
  });
  return { context: worker.context };
}).serialize({
  title: "Two-line Rhyming Poet",
  description: "A simple example of using of the Worker node",
});
