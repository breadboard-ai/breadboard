/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, core, llm } from "../../new/kits.js";

const input = base.input({
  $id: "userRequest",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "User",
        description: "Type here to chat with the assistant",
      },
    },
    required: ["text"],
  },
});

core.passthrough({ $id: "start" }).to(input);

const prompt = llm.promptTemplate({
  template:
    "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
  context: "",
  question: input.text,
  $id: "assistant",
});

const conversationMemory = llm.append({
  accumulator: "\n== Conversation History",
  $id: "conversationMemory",
  user: input.text,
});
conversationMemory.accumulator.to(conversationMemory);

const response = llm.generateText({
  text: prompt.prompt,
  PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
});

conversationMemory.in({ accumulator: response.completion });

prompt.in({ context: conversationMemory.accumulator });

const output = base.output({ text: response.completion });

// TODO: Don't send data, just "->"
output.to(input);

export const graph = input; // Any node would work here.

export default await graph.serialize({ title: "New: Accumulating context" });
