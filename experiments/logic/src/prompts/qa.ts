/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GenerateContentParameters } from "@google/genai";
import { jsDevPrompt, objectShapePrompt } from "../common";
import { Case } from "../types";

export async function loadQA(
  definition: Case
): Promise<GenerateContentParameters> {
  const { prompt, inputs } = definition;

  return {
    model: "gemini-2.5-pro",
    contents: `Write a test for the module that fulfills the following request:
<request>
${prompt}
</request>

${objectShapePrompt(inputs)}`,
    config: {
      systemInstruction: `You are a **Software Test-Driven Development Agent**. Your job is to write a comprehensive test for program that will be written in order to fulfill the provided request. Your code will serve as the test spec for the future program. 
      
${await jsDevPrompt("Test")}

When writing tests:
- be loose with text comparisons. The program may add extra line breaks for formatting.

  `,
    },
  };
}
