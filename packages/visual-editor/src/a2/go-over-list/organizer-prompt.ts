/**
 * @fileoverview Plumbing that handles organizing/summarizing content at the end.
 */

import { defaultSafetySettings } from "../a2/gemini.js";
import { llm, ok } from "../a2/utils.js";
import { GeminiPrompt } from "../a2/gemini-prompt.js";
import { type Invokable } from "./types.js";
import { defaultSystemInstruction } from "./system-instruction.js";
import { Capabilities, LLMContent } from "@breadboard-ai/types";
import { A2ModuleArgs } from "../runnable-module-factory.js";

export { organizerPrompt };

type InvokeReturnType = ReturnType<GeminiPrompt["invoke"]>;

function organizerPrompt(
  caps: Capabilities,
  moduleArgs: A2ModuleArgs,
  results: LLMContent[],
  objective: LLMContent
): Invokable<InvokeReturnType> {
  const research = {
    parts: results.flatMap((item) => item.parts),
  };
  const prompt = llm`
You are an expert organizer of raw material. This raw material was produced by 
an AI agent that was tasked with satisfying the the provided objective.

Your job is to examine in detail and organize the provided raw material into
a thorough, detailed write-up that captures all of it in one place, so that
the final product is a perfect response to the objective.

The final must product must contain references to the sources (always cite your sources).

## Objective

${objective}

## Raw Research

\`\`\`
${research}

\`\`\`
`.asContent();

  const geminiPrompt = new GeminiPrompt(caps, moduleArgs, {
    body: {
      systemInstruction: defaultSystemInstruction(),
      contents: [prompt],
      safetySettings: defaultSafetySettings(),
    },
  });

  return {
    invoke: async () => {
      const invoking = await geminiPrompt.invoke();
      if (!ok(invoking)) return invoking;
      const response = invoking.last;
      return {
        ...invoking,
        last: response,
      };
    },
  };
}
