/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Core } from "@google-labs/core-kit";
import { PaLMKit } from "@google-labs/palm-kit";

const board = new Board({
  title: "Accumulating Context",
  description:
    'An example of a board that implements a multi-turn experience: a very simple chat bot that accumulates context of the conversations. Tell it "I am hungry" or something like this and then give simple replies, like "bbq". It should be able to infer what you\'re asking for based on the conversation context. All replies are pure hallucinations, but should give you a sense of how a Breadboard API endpoint for a board with cycles looks like.',
  version: "0.0.1",
});
const kit = board.addKit(Starter);
const core = board.addKit(Core);
const palm = board.addKit(PaLMKit);

// Store input node so that we can refer back to it to create a conversation
// loop.
const input = board.input({
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

// Store prompt node for the same reason.
const prompt = kit.promptTemplate({
  $id: "assistant",
  template: "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
  context: "",
});

// Use the `append` node to accumulate the conversation history.
// Populate it with initial context.
const conversationMemory = core.append({
  accumulator: "\n== Conversation History",
  $id: "conversationMemory",
});
// Wire memory to accumulate: loop it to itself.
conversationMemory.wire("accumulator->", conversationMemory);

core.passthrough({ $id: "start" }).wire(
  "->",
  input
    .wire(
      "text->question",
      prompt.wire(
        "prompt->text",
        palm
          .generateText({ $id: "generator" })
          .wire("<-PALM_KEY.", kit.secrets({ keys: ["PALM_KEY"] }))
          .wire(
            "completion->assistant",
            conversationMemory.wire("accumulator->context", prompt)
          )
          .wire(
            "completion->text",
            board
              .output({
                $id: "assistantResponse",
                schema: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      title: "Assistant",
                      description:
                        "Assistant's response in the conversation with the user",
                    },
                  },
                  required: ["text"],
                },
              })
              .wire("->", input)
          )
      )
    )
    .wire("text->user", conversationMemory)
);

export default board;
