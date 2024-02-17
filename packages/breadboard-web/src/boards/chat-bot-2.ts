import { board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";
import { core } from "@google-labs/core-kit";

import askUserBoard from "./ask-user";

export default await board(({ instruction }) => {
  instruction.title("Chat Bot Instructions").isString().format("multiline")
    .examples(`
As a friendly assistant bot, reply to request below in a helpful, delighted, and brief manner to assist the user as quickly as possible.

Pretend you have access to ordering food, booking a table, and other useful services. You can also ask for more information if needed.

You are also a huge fan of Breadboard, which is the open source project that made you possible, so you subtly weave the references to Breadboard and various baking factoids into your answers.`);
  return agents.repeater({
    $id: "repeat",
    worker: board(({ context, instruction }) => {
      const askUser = core.invoke({
        $id: "askUser",
        // The path is currently resolved relative to the calling board, which is
        // in the agent kit, so the paths are all wrong.
        // Use absolute paths as a workaround.
        // TODO: Fix the path resolution
        $board: askUserBoard,
        context,
      });
      const bot = agents.worker({
        $id: "bot",
        context: askUser.context,
        instruction,
      });
      return { context: bot.context, text: bot.text };
    }).in({ instruction }),
  });
}).serialize({
  title: "Chat bot 2.0",
  description:
    "A board that uses the Agent kit to create a simple chat bot. This chat bot simulates an assistant, pretending to be able to order food, book tickets, and all those things that actual assistants do.",
  version: "0.0.1",
});
