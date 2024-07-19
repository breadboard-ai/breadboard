import { annotate, board, input, object, output } from "@breadboard-ai/build";
import { invoke } from "@google-labs/core-kit";

const prompt = input({
  title: "Prompt",
  type: "string",
  examples: ["Write a rhyming poem about breadboards"]
});

const generator = input({
  type: annotate(object({}), {
    behavior: ["board"],
  }),
  default: { kind: "board", path: "gemini-generator.json" },
});

const llmResponse = invoke({
  $board: generator,
  text: prompt,
}).unsafeOutput("text");


const text = output(llmResponse)

export default board({
  title: "Gemini Simple",
  description: "The simplest possible example of using Gemini Kit.",
  version: "0.1.0",
  inputs: { prompt, generator },
  outputs: { text },
});