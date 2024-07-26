import { board, enumeration, input, output } from "@breadboard-ai/build";
import { geminiText } from "@google-labs/gemini-kit";

const prompt = input({
  title: "Prompt",
  type: "string",
  examples: ["Write a rhyming poem about breadboards"]
});

const model = input({
  type: enumeration("gemini-1.5-flash-latest", "gemini-1.5-pro-latest")
});

const llmResponse = geminiText({ model, text: prompt });

const text = output(llmResponse.outputs.text);

export default board({
  title: "Gemini Simple",
  description: "The simplest possible example of using Gemini Kit.",
  version: "0.1.0",
  inputs: { prompt, model },
  outputs: { text },
});