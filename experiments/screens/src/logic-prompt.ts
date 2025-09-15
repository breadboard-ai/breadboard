/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const logicPrompt = `To accomplish this task, write a Javascript module with a single anonymous async function as a default export. The module runs in an isolated environment that has the latest ECMAScript features, but no additional bindings. The function you will write is defined as the \`Invoke\` type.

Any files in this prompt will be provided to the program as "/vfs/in/file_[x]"
files, where x is the index of the file provided.

When providing files as outputs, output them as \`FilePart\` structures within the
\`LLMContent\`, passing the VFS paths as-is.

Make sure to write Javascript, not Typescript. Output it directly as Javascript code, with nothing else. This code will be used directly for execution.

The following Gemini models are available:

- \`gemini-2.5-pro\` - Enhanced thinking and reasoning, multimodal understanding, advanced coding, and more
- \`gemini-2.5-flash\` - Adaptive thinking, cost efficiency
- \`gemini-2.5-flash-image-preview\` - Precise, conversational image generation
  and editing

Here are all the type defintions:
`;
