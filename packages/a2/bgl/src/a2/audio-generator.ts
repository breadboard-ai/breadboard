/**
 * @fileoverview Generates audio output using supplied context.
 */

import gemini, {
  defaultSafetySettings,
  type GeminiOutputs,
  type GeminiInputs,
} from "./gemini";
import { err, ok, llm, toLLMContent, toText } from "./utils";
import { type DescriberResult } from "./common";

type AudioGeneratorInputs = {
  context: LLMContent[];
};

type AudioGeneratorOutputs = {
  context: LLMContent[] | DescriberResult;
};

export { invoke as default, describe };

async function invoke({
  context,
}: AudioGeneratorInputs): Promise<Outcome<AudioGeneratorOutputs>> {
  // 1) Get last LLMContent from input.
  const prompt =
    context && Array.isArray(context) && context.length > 0
      ? context.at(-1)!
      : undefined;
  if (!prompt) {
    return err("Must supply context as input");
  }
  prompt.role = "user";

  // 2) Call Gemini to generate audio.
  const result = await gemini({
    model: "gemini-2.0-flash-exp",
    body: {
      contents: [prompt],
      generationConfig: {
        responseModalities: ["AUDIO"],
      },
      safetySettings: defaultSafetySettings(),
    },
  });
  if (!ok(result)) {
    return result;
  }
  if ("context" in result) {
    return err("Invalid output from Gemini -- must be candidates");
  }

  const content = result.candidates.at(0)?.content;
  if (!content) {
    return err("No content");
  }

  return { context: [content] };
}

async function describe() {
  return {
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context in",
          behavior: ["main-port"],
        },
      },
      additionalProperties: false,
    } satisfies Schema,
    outputSchema: {
      type: "object",
      properties: {
        context: {
          type: "array",
          items: { type: "object", behavior: ["llm-content"] },
          title: "Context out",
          behavior: ["hint-audio"],
        },
      },
      additionalProperties: false,
    } satisfies Schema,
    title: "Make Audio [Deprecated, Use Make Speech]",
    metadata: {
      icon: "generative-audio",
      tags: ["quick-access", "generative", "experimental"],
      order: 3,
    },
  };
}
