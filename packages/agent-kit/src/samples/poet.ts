/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { array, board, input } from "@breadboard-ai/build";
import agents from "@google-labs/agent-kit";
import { contextType } from "../context.js";

const context = input({
  title: "Poem topic",
  type: array(contextType),
  examples: [[{ role: "user", parts: [{ text: "the universe within us" }] }]],
});

const worker = agents.worker({
  $id: "writePoetry",
  instruction: `You are a brilliant poet who specializes in two-line rhyming poems.
    Given any topic, you can quickly whip up a two-line rhyming poem about it.
    Ready?`,
  context,
});

export default board({
  title: "Two-line Rhyming Poet",
  description: "A simple example of using of the Worker node",
  inputs: { context },
  outputs: { context: worker.outputs.context },
});
