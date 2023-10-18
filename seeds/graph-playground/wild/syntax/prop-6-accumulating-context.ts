import { board } from "./prop-6-breadboard.js";
import {
  generateText,
  promptTemplate,
  secrets,
  append,
  passthrough,
} from "./prop-6-handlers.js";

{
  const input = board.input({
    $id: "userRequest",
    schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          title: "User",
          description: "Type here to chat with the assistant",
        },
      },
      required: ["text"],
    },
  });

  const prompt = board.place(promptTemplate, {
    $id: "assistantPrompt",
    template:
      "This is a conversation between a friendly assistant and their user. You are the assistant and your job is to try to be helpful, empathetic, and fun.\n{{context}}\n\n== Current Conversation\nuser: {{question}}\nassistant:",
    context: "",
  });

  const conversationMemory = board.place(append, {
    accumulator: "\n== Conversation History",
    $id: "conversationMemory",
  });

  const generator = board.place(generateText, {
    $id: "generator",
    PALM_KEY: board.place(secrets, { keys: ["PALM_KEY"] }).out.PALM_KEY,
  });

  const output = board.output({
    $id: "assistantResponse",
    schema: {
      type: "object",
      properties: {
        completion: {
          type: "string",
          title: "Assistant",
          description: "Assistant's response in the conversation with the user",
        },
      },
      required: ["text"],
    },
  });

  const start = board.place(passthrough, { $id: "start" });

  // wire the main infinite conversation loop.
  start.to(input.to(prompt.to(generator.to(output.to(input)))));

  // wire the conversation memory loop.
  board.wire(
    conversationMemory.out.accumulator,
    conversationMemory.in.accumulator
  );

  // make sure memory loop is populated with content.
  board.wire(input.out.question, conversationMemory.in.user);
  board.wire(generator.out.completion, conversationMemory.in.assistant);
}
