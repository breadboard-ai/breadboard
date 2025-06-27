/**
 * @fileoverview Defines the schema for simple slides JSON output
 */

import { type GeminiSchema } from "./a2/gemini";
import { GeminiPrompt } from "./a2/gemini-prompt";
import { toText, ok, err, llm } from "./a2/utils";
import type { SimplePresentation } from "./types";

export { inferSlideStructure };

function simpleSlidesSchema(): GeminiSchema {
  const slide: GeminiSchema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Slide title (plain text)" },
      subtitle: {
        type: "string",
        description:
          "Slide subtitle (plain text, can be empty for a text slide)",
      },
      body: {
        type: "string",
        description: "Slide body (markdown, can be empty for a title slide)",
      },
    },
    required: ["title"],
  };
  return {
    type: "object",
    properties: {
      slides: {
        description: "A collection of slides",
        type: "array",
        items: slide,
      },
    },
    required: ["slides"],
  };
}

async function inferSlideStructure(
  contents?: LLMContent[]
): Promise<Outcome<SimplePresentation>> {
  if (!contents) {
    return err(`Unable to infer slide structure. No information was provided.`);
  }
  const prompt = new GeminiPrompt({
    body: {
      contents,
      systemInstruction:
        llm`Your job is to generate a slide deck from the provided input.
Make sure that the deck represents the key information from the content.
Keep each slide body text short so that the audience doesn't have to read long sheets of text on each slide.
If necessary, break down the deck into sections using title slides`.asContent(),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: simpleSlidesSchema(),
      },
    },
  });
  const invoking = await prompt.invoke();
  if (!ok(invoking)) return invoking;
  const result = (invoking.last.parts?.at(0) as JSONPart)?.json;
  if (!result) {
    return err(
      `Unable to infer slide structure. Invalide response from Gemini.`
    );
  }
  return result as SimplePresentation;
}
