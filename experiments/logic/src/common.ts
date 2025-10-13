/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from "fs/promises";
import { join } from "path";

export { objectShapePrompt, jsDevPrompt, geminiModelPrompt, cleanupCode };

const SRC_DIR = join(import.meta.dirname, "../src");

function makeInputsType(items: string[]) {
  return `
type Inputs = {
${items.map((item) => `  ${item}: LLMContent;`)}
}`;
}

function objectShapePrompt(inputs: string[]) {
  return `The shape of the input object is as follows:
\`\`\`typescript
${makeInputsType(inputs)}
\`\`\``;
}

function geminiModelPrompt() {
  return `The following Gemini models are available:

- \`gemini-2.5-pro\` - Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more
- \`gemini-2.5-flash\` - Adaptive thinking, cost efficiency
- \`gemini-2.5-flash-image-preview\` - Precise, conversational image generation
  and editing. Importantly, the JSON mode is not enabled for this model.
- \`veo-3.0-generate-001\` -- state-of-the-art model for generating high-fidelity videos from a text or image prompt. When two images submitted, will use the first image as the starting frame and the second image as the end frame.
`;
}

async function jsDevPrompt(type: string) {
  const typesPath = join(SRC_DIR, `types.ts`);
  const types = await readFile(typesPath, "utf-8");

  return `You will write a Javascript module with a single anonymous async function as a default export.
      
The module runs in an isolated environment that has the latest ECMAScript features, but no additional bindings. The function you will write is defined as the \`${type}\` type.

Make sure to write Javascript, not Typescript. Output it directly as Javascript code, with nothing else. This code will be used directly for execution.

Here are all the type defintions:

\`\`\`typescript
${types}
\`\`\``;
}

function cleanupCode(s: string) {
  // Mechanically fix a common problem with Gemini adding extra spaces in
  // optional property accessors and ??.
  s = s.replaceAll(/\?\s*\./g, "?.").replaceAll(/\?\s*\?/g, "??");

  const content = s?.trim();
  if (!content) {
    return "// No file generated";
  }
  const lines = content.split("\n");
  const firstLine = lines[0]?.trim();
  const lastLine = lines.at(-1)?.trim();

  const hasOpeningFence = firstLine?.startsWith("```");
  const hasClosingFence = lines.length > 1 && lastLine === "```";

  if (hasOpeningFence && hasClosingFence) {
    return lines.slice(1, -1).join("\n");
  }

  return s;
}
