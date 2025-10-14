/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { GeminiPrompt } from "./gemini-prompt";
import { ok } from "@breadboard-ai/utils";
import { GeminiSchema } from "./gemini";

export { renderConsistentUI };

const UI_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    data: {
      type: "string",
    },
  },
};

async function renderConsistentUI(
  caps: Capabilities,
  data: LLMContent,
  systemInstruction?: LLMContent
): Promise<Outcome<LLMContent[]>> {
  const prompt = new GeminiPrompt(caps, {
    model: "gemini-2.5-flash",
    body: {
      contents: [data],
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: UI_SCHEMA,
      },
    },
  });
  const generated = await prompt.invoke();
  if (!ok(generated)) return generated;
  return generated.all;
}
