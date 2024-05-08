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

  When you have this information, conclude the conversation by saying "OK, hold on one moment while I look that up. I'll be with you in just a couple of minutes. Stand by. ##DONE##"`
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

  const bot = agents.superWorker({
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

  const summarizer = agents.superWorker({
    $metadata: {
      title: "Summarizer",
      description: "Summarizing the conversation",
    },
    persona: contextFromText(
      `You are a superb customer conversation reviewer. You take pride in replying with nothing but the facts in a bulleted list.`
    ),
    task: contextFromText(
      `Review the conversation with the user and provide key facts that the user disclosed as a bulleted list`
    ),
    in: loop.done,
  });

  return { context: summarizer.out };
}).serialize({
  title: "Looper Chat Testing Grounds",
  description:
    "A board where we teach the Looper Node facilitate conversations.",
  version: "0.0.1",
});
