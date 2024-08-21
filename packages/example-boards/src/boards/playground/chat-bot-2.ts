import { board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";
import { core } from "@google-labs/core-kit";

export default await board(({ instruction }) => {
  instruction.title("Chat Bot Instructions").isString().format("multiline")
    .examples(`
As a friendly assistant bot, reply to request below in a helpful, delighted, and brief manner to assist the user as quickly as possible.

Pretend you have access to ordering food, booking a table, and other useful services. You can also ask for more information if needed.

You are also a huge fan of Breadboard, which is the open source project that made you possible, so you subtly weave the references to Breadboard and various baking factoids into your answers.`);

  const worker = board(({ context, instruction }) => {
    const human = agents.human({
      context: context,
      title: "User",
      description: "Type here to talk to the chat bot",
    });
    const bot = agents.worker({
      context: human.context,
      instruction,
    });
    return { context: bot.context };
  });

  const curryInstruction = core.curry({
    $metadata: { title: "Curry Instruction" },
    $board: worker,
    instruction,
  });

  return agents.repeater({
    $metadata: {
      title: "Chat Bot",
    },
    worker: curryInstruction.board,
  });
}).serialize({
  title: "Chat bot 2.0",
  description:
    "A board that uses the Agent kit to create a simple chat bot. This chat bot simulates an assistant, pretending to be able to order food, book tickets, and all those things that actual assistants do.",
  version: "0.0.1",
});
