import { board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

export default await board(({ context }) => {
  context.title("Context").isArray().examples("[]");

  const user = core.invoke({
    $id: "askUser",
    $board: "ask-user.json",
    title: "User",
    description: "Type here to chat with the assistant",
    context,
  });

  const assistant = core.invoke({
    $id: "assistant",
    $board: "agent.json",
    context: user.context,
  });

  return { context: assistant.context };
}).serialize({
  title: "Single turn",
  description:
    "A single conversation turn: a combination of a simple agent and a user input",
  version: "0.0.1",
});
