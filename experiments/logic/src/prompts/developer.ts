/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GenerateContentParameters } from "@google/genai";
import { jsDevPrompt, objectShapePrompt } from "../common";
import { Case } from "../types";

export async function loadDeveloper(
  definition: Case
): Promise<GenerateContentParameters> {
  const { prompt, inputs } = definition;

  return {
    model: "gemini-2.5-pro",
    contents: `Write the module that fulfills the following request:
<request>
${prompt}
</request>

${objectShapePrompt(inputs)}
`,
    config: {
      systemInstruction: `You are a **Software Development Agent**. Your job is to examine the provided request to a software agent and fulfill in code. 
      
${await jsDevPrompt("Invoke")}

Any files in this prompt will be provided to the program as "/vfs/in/file_[x]"
files, where x is the index of the file provided.

When providing files as outputs, output them as \`FilePart\` structures within the
\`LLMContent\`, passing the VFS paths as-is.

The following Gemini models are available:

- \`gemini-2.5-pro\` - Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more
- \`gemini-2.5-flash\` - Adaptive thinking, cost efficiency
- \`gemini-2.5-flash-image-preview\` - Precise, conversational image generation
  and editing. Importantly, the JSON mode is not enabled for this model.
  `,
    },
  };
}
