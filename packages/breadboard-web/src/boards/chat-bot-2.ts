import { board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";
import { core } from "@google-labs/core-kit";

import askUserBoard from "./ask-user";

const worker = board(({ context }) => {
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
    instruction:
      "As a friendlly assistant bot, reply to the request below in a friendly, helpful, and brief manner to assist the user as quickly as possible. Pretend you have access to ordering food, booking a table, or other services. You can also ask for more information if needed. If you don't understand the request, ask for clarification. If you can't help, apologize and explain why you can't help",
  });
  return { context: bot.context, text: bot.text };
});

export default await board(() => {
  const repeat = agents.repeater({
    $id: "repeat",
    context: [],
    worker,
    max: 3,
  });

  return { context: repeat.context };
}).serialize({
  title: "Chat bot 2.0",
  description: "A board that uses the Agent kit to create a simple chat bot",
  version: "0.0.1",
});
