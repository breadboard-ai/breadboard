/**
 * @fileoverview Plumbing that handles organizing/summarizing content at the end.
 */

import { defaultSafetySettings } from "./a2/gemini";
import { llm, ok, toLLMContent } from "./a2/utils";
import { GeminiPrompt } from "./a2/gemini-prompt";
import { StructuredResponse } from "./a2/structured-response";
import { generateId } from "./runtime";
import { type Invokable } from "./types";
import { listPrompt, listSchema, toList } from "./a2/lists";

export { organizerPrompt };

type InvokeReturnType = ReturnType<GeminiPrompt["invoke"]>;

function organizerPrompt(
  results: LLMContent[],
  objective: LLMContent,
  makeList: boolean
): Invokable<InvokeReturnType> {
  const research = {
    parts: results.flatMap((item) => item.parts),
  };
  console.log("RESEARCH", research);

  const extra = makeList
    ? `
Your job is to examine in detail and organize the provided raw material into
a thorough, detailed list of write-ups, so that the final list of write-ups
is a perfect response to the objective. The number of write-ups in the list must be the same as
asked in the objective.

Make sure each write-up is complete as its own document, because these write-ups
will be used separately from each other.


`
    : `
Your job is to examine in detail and organize the provided raw material into
a thorough, detailed write-up that captures all of it in one place, so that
the final product is a perfect response to the objective.

The final must product must contain references to the sources (always cite your sources).`;

  const prompt = llm`
You are an expert organizer of raw material. This raw material was produced by 
an AI agent that was tasked with satisfying the the provided objective.

${extra}

## Objective

${objective}

## Raw Research

\`\`\`
${research}

\`\`\`
`.asContent();

  if (makeList) {
    const geminiPrompt = new GeminiPrompt({
      body: {
        contents: [listPrompt(prompt)],
        safetySettings: defaultSafetySettings(),
        generationConfig: {
          responseSchema: listSchema(),
          responseMimeType: "application/json",
        },
      },
    });
    return {
      invoke: async () => {
        const invoking = await geminiPrompt.invoke();
        if (!ok(invoking)) return invoking;
        const last = toList(invoking.last);
        if (!ok(last)) return last;
        return { ...invoking, last };
      },
    };
  } else {
    const structuredResponse = new StructuredResponse(generateId(), false);

    const geminiPrompt = new GeminiPrompt(
      {
        body: {
          systemInstruction: structuredResponse.instruction(),
          contents: structuredResponse.addPrompt([], prompt),
          safetySettings: defaultSafetySettings(),
        },
      },
      {
        validator: (content) => {
          return structuredResponse.parseContent(content);
        },
      }
    );

    return {
      invoke: async () => {
        const invoking = await geminiPrompt.invoke();
        if (!ok(invoking)) return invoking;
        const response = toLLMContent(structuredResponse.body, "model");
        return {
          ...invoking,
          last: response,
        };
      },
    };
  }
}
