import { board } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";
import { core } from "@google-labs/core-kit";

const worker = board(({ context }) => {
  const askUser = core.invoke({
    $id: "askUser",
    // The path is currently resolved relative to the calling board, which is
    // in the agent kit, so the paths are all wrong.
    // Use absolute paths as a workaround.
    // TODO: Fix the path resolution
    $board:
      "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/breadboard-web/public/graphs/ask-user.json",
    context,
  });
  const bot = agents.worker({
    $id: "bot",
    context: askUser.context,
    instruction:
      "As a friendlly assistant bot, reply in a friendly, helpful, and brief manner to assist the user as quickly as possible to the request below.",
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
  description:
    "A board that uses the Agent kit to create a simple chat bot (work in progress, doesn't quite work yet)",
  version: "0.0.1",
});
