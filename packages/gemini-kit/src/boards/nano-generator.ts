/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input, output } from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";

declare global {
  // eslint-disable-next-line no-var
  var ai: {
    languageModel: {
      create: () => Promise<{ prompt: (text: string) => Promise<string> }>;
      capabilities: () => Promise<{
        available: 'readily', defaultTopK: 3, maxTopK: 8, defaultTemperature: 1
      }>;
    }
  };
}

const prompt = input({
  title: "Prompt",
  description: "The prompt to generate text from",
});

const { text } = code(
  {
    $metadata: {
      title: "Call Prompt API",
      description: "Invoking the Prompt API to generate text from a prompt",
    },
    prompt,
  },
  { text: "string" },
  async ({ prompt }: { prompt: string }) => {
    const ERROR_MESSAGE =
      "Prompt API is not available. For more information, see https://developer.chrome.com/docs/ai/built-in.";

    const ai = globalThis.ai;
    if (!ai) {
      throw new Error(ERROR_MESSAGE);
    }
    const capabilities = await ai.languageModel.capabilities();
    const canAI = capabilities.available === 'readily';
    if (!canAI) {
      throw new Error(ERROR_MESSAGE);
    }
    const session = await ai.languageModel.create();
    const text = (await session.prompt(prompt)) as string;
    return { text };
  }
).outputs;

export default board({
  title: "Gemini Nano (Preview)",
  description: "Generates text with the on-device Gemini Nano model",
  metadata: {
    icon: "nano",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/gemini/#the-nano-component",
    },
  },
  inputs: { prompt },
  outputs: {
    text: output(text, {
      title: "Text",
      description: "The generated text",
    }),
  },
});
