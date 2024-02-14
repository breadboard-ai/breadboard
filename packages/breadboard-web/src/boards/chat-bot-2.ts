import { base, board, code } from "@google-labs/breadboard";
import { agents } from "@google-labs/agent-kit";

const worker = code(({ context }) => {
  return { context: [...(context as unknown[]), { hello: "world" }] };
});

export default await board(() => {
  const repeat = agents.repeater({
    $id: "repeat",
    context: ["You are a helpful chat bot. You are here to help the user."],
    worker,
    max: 3,
  });

  return { context: repeat.context };
}).serialize({
  title: "Chat bot 2.0",
  description: "A board that uses the Agent kit to create a simple chat bot",
  version: "0.0.1",
});
