/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GenerateContentParameters } from "@google/genai";
import { readFile } from "fs/promises";
import { join } from "path";
import { Case } from "../types";

const SRC_DIR = join(import.meta.dirname, "../../src");

export async function loadDeveloper(
  definition: Case
): Promise<GenerateContentParameters> {
  const { prompt } = definition;
  const typesPath = join(SRC_DIR, `types.ts`);
  const types = await readFile(typesPath, "utf-8");

  return {
    model: "gemini-2.5-pro",
    contents: `Write the module that fulfills the following request:
<request>
${prompt}
</request>`,
    config: {
      systemInstruction: `You are a **Software Development Agent**. Your job is to examine the provided request to a software agent and fulfill in code. Your code will be  a Javascript module with a single anonymous async function as a default export. The module runs in an isolated environment that has the latest ECMAScript features, but no additional bindings. The function you will write is defined as the \`Invoke\` type.

Any files in this prompt will be provided to the program as "/vfs/in/file_[x]"
files, where x is the index of the file provided.

When providing files as outputs, output them as \`FilePart\` structures within the
\`LLMContent\`, passing the VFS paths as-is.

Make sure to write Javascript, not Typescript. Output it directly as Javascript code, with nothing else. This code will be used directly for execution.

The following Gemini models are available:

- \`gemini-2.5-pro\` - Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more
- \`gemini-2.5-flash\` - Adaptive thinking, cost efficiency
- \`gemini-2.5-flash-image-preview\` - Precise, conversational image generation
  and editing. Importantly, the JSON mode is not enabled for this model.

Here are all the type defintions:

\`\`\`typescript
${types}
\`\`\

  `,
    },
  };
}
