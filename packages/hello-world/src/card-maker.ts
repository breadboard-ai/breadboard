import { Schema, base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";

const visionBoard =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/f4adabe69a5a9af73a29fcc72e7042404157717b/packages/breadboard-web/public/graphs/gemini-pro-vision.json";
const textBoard =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/3e9735ee557bf18deb87bc46663a6e3af7647e7d/packages/breadboard-web/public/graphs/gemini-generator.json";

const drawableSchema = {
  type: "object",
  properties: {
    picture: {
      type: "image/png",
      title: "Your picture",
      format: "drawable",
    },
  },
  required: ["content"],
  additionalProperties: false,
} satisfies Schema;

const appender = code(({ part, prompt }) => {
  const parts = Array.isArray(part) ? part : [part];
  return { parts: [...parts, { text: prompt }] };
});

export default await board(() => {
  // TODO: Teach new syntax to take in the full Schema (maybe a "schema" method?)
  const draw = base.input({ $id: "draw", schema: drawableSchema });

  const { parts } = appender({
    $id: "append",
    part: draw.picture,
    prompt:
      "describe the mystical creature above in great detail and flourish, and come up with a fun name for it, as well as the backstory for how it came to be",
  });

  const describe = core.invoke({
    $id: "describe",
    path: visionBoard,
    parts,
  });

  const { text } = templates.promptTemplate({
    $id: "template",
    template: `You are an expert Dungeons and Dragons character developer. Analyze the following backstory of the mystical creature and reply a brief overview of the creature. Also provide the list of Dungeons and Dragons basic abilities (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma) and their scores:
    
    ## BACKSTORY:
    {{backstory}}
    
    ## RESPONSE:
    `,
    backstory: describe.result,
  });

  const analyze = core.invoke({
    $id: "analyze",
    path: textBoard,
    text,
  });

  return { card: analyze.text, story: describe.result };
}).serialize({
  title: "Card Maker",
  description: "Creates a D&D card for a drawn object",
  version: "0.0.1",
});
