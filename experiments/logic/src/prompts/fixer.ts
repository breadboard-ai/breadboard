/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GenerateContentParameters } from "@google/genai";
import { jsDevPrompt, objectShapePrompt } from "../common";
import { Case } from "../types";

export async function loadFixer(
  definition: Case,
  draft: string,
  test: string,
  errors: string
): Promise<GenerateContentParameters> {
  const { prompt, inputs } = definition;

  return {
    model: "gemini-2.5-pro",
    contents: `Fix the errors with the module that fulfills the following request:
<request>
${prompt}
</request>

<original-code>
\`\`\`typescript
${draft}
\`\`\`
</original-code>

<test-code>
\`\`\`typescript
${test}
\`\`\`
</test-code>

<errors>
${errors}
</errors>


${objectShapePrompt(inputs)}`,
    config: {
      systemInstruction: `You are a **Software Engineering Agent**. Your job is to complete identify and fix the problems in code. 

  Step 1: Analyze the original code (surrounded with the "original-code" tags) that was written to fulfill the provided request (surrounded with the "request" tags), the test written for that code (surrounded with the "test-code" tags), and the errors (surrounded with the "errors" tag) that resulted when testing the original code for program.

  Step 2: Write a new revision of the original code. Your response must be the complete program. Do not shorten it or refer to original code. Your code will entirely replace it.
      
${await jsDevPrompt("Invoke")}

`,
    },
  };
}
