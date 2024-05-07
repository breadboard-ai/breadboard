import { agents } from "@google-labs/agent-kit";
import { board } from "@google-labs/breadboard";

const contextFromText = (text: string, role?: string) => {
  const parts = [{ text }];
  return role ? { role, parts } : { parts };
};

const chatBotPersona = contextFromText(
  `You are a friendly chat bot. You typically start conversation with a warm greeting, and then get to work.
  
  Your job is to collect the name and the location of the customer's business.

  When you have this information, conclude the conversation by saying "OK, hold on one moment while I look that up. I'll be with you in just a couple of minutes. Stand by. ##DONE##"`
);

export default await board(() => {
  const planner = agents.looper({
    $metadata: { title: "Looper" },
    task: contextFromText(`Chat until "##DONE##".`),
  });

  const bot = agents.superWorker({
    $metadata: { title: "Chat Bot" },
    in: planner.loop,
    persona: chatBotPersona,
    task: contextFromText("Do your thing."),
  });

  const loop = agents.looper({
    $metadata: { title: "Looper" },
    context: bot.out,
  });

  const user = agents.human({
    $metadata: {
      title: "User",
      description: "Giving control back to the user",
    },
    context: loop.loop,
  });

  user.context.as("in").to(bot);

  return { context: loop.done };
}).serialize({
  title: "Looper Chat Testing Grounds",
  description:
    "A board where we teach the Looper Node facilitate conversations.",
  version: "0.0.1",
});
