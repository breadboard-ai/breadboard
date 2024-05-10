import { agents } from "@google-labs/agent-kit";
import { board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const contextFromText = (text: string, role?: string) => {
  const parts = [{ text }];
  return role ? { role, parts } : { parts };
};

const chatBotPersona = contextFromText(
  `You are a friendly chat bot. You typically start conversation with a warm greeting, and then get to work.
  
  Your job is to collect the name, the location, and the instagram account of the customer's business.

  When you have this information, reply with a brief summary of the information you've collected in a neat bulleted list, then conclude the conversation by saying "OK, hold on one moment while I look that up. I'll be with you in just a couple of minutes. Stand by. ##DONE##"`
);

export default await board(() => {
  const start = core.passthrough({
    $metadata: { title: "Start" },
    context: [],
  });

  const loop = agents.looper({
    $metadata: { title: "Looper" },
    context: start.context,
    task: contextFromText(`Chat until "##DONE##".`),
  });

  const bot = agents.specialist({
    $metadata: { title: "Chat Bot" },
    in: loop.loop,
    persona: chatBotPersona,
  });

  const user = agents.human({
    $metadata: {
      title: "User",
      description: "Giving control back to the user",
    },
    context: bot.out,
  });

  user.context.as("context").to(loop);

  return { context: loop.done };
}).serialize({
  title: "Looper Chat Testing Grounds",
  description:
    "A board where we teach the Looper Node facilitate conversations.",
  version: "0.0.1",
});
