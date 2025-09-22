/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function createPrompt(intent: string, types: string, example: string) {
  return `
Your job is to come up with a list of screens and prompts for the application based on the application intent specified below.

Generate output as a TypeScript module that contains three exports: "spec", "screens" and "prompt". See example below.

The type definitions are as follows:

\`\`\`ts
${types}
\`\`\`

## Intent

${intent}

## Example

\`\`\`ts
${example}
\`\`\`

`;
}
