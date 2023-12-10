/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

import { V, base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

const parameters = base.input({
  $id: "parameters",
  schema: z.object({
    generator: z
      .string()
      .describe("Generator: Text generator to use")
      .default("/graphs/text-generator.json"),
  }),
});

const input = base.input({
  $id: "userRequest",
  schema: z.object({
    text: z.string().describe("User: Type here to chat with the assistant"),
  }),
});

parameters.as({}).to(input);

const prompt = starter.promptTemplate({
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

const generator = core.invoke({
  $id: "generator",
  path: parameters.generator.memoize(),
  text: prompt.prompt,
});

conversationMemory.in({ accumulator: generator.text });
// response.completion.to(conversationMemory.accumulator);

const output = base.output({
  text: generator.text as V<string>,
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

export default await graph.serialize({
  title: "Simple chatbot (accumulating context)",
  description:
    'An example of a board that implements a multi-turn experience: a very simple chat bot that accumulates context of the conversations. Tell it "I am hungry" or something like this and then give simple replies, like "bbq". It should be able to infer what you\'re asking for based on the conversation context. All replies are pure hallucinations, but should give you a sense of how a Breadboard API endpoint for a board with cycles looks like.',
  version: "0.0.2",
});
