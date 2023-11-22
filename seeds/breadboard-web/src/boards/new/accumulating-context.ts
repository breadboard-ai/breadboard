/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

import { base, core, llm, palm } from "../../new/kits.js";

const input = base.input({
  $id: "userRequest",
  schema: z.object({
    text: z.string().describe("User: Type here to chat with the assistant"),
  }),
});

core.passthrough({ $id: "start" }).as({}).to(input);

const prompt = llm.promptTemplate({
  template:
    "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
  context: "",
  question: input.text,
  $id: "assistant",
});

const conversationMemory = core.append({
  accumulator: "\n== Conversation History",
  user: input.text,
});
conversationMemory.in(conversationMemory.accumulator);
prompt.in({ context: conversationMemory.accumulator });
// conversationMemory.accumulator.to(prompt.context); ???
// conversationMemory.accumulator.as("context").to(prompt);

const response = palm.generateText({
  text: prompt.prompt,
  PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY.memoize(),
});
conversationMemory.in({ accumulator: response.completion });
// response.completion.to(conversationMemory.accumulator);

const output = base.output({
  text: response.completion,

  schema: z.object({
    text: z
      .string()
      .describe(
        "Assistant: Assistant's response in the conversation with the user"
      ),
  }),
});

output.as({}).to(input);

export const graph = input; // Any node would work here.

export default await graph.serialize({ title: "New: Accumulating context" });
