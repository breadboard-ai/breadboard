/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input, output } from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";

/** See https://github.com/explainers-by-googlers/prompt-api */
interface PromptApi {
  createTextSession: () => Promise<{
    prompt: (text: string) => Promise<string>;
  }>;
  canCreateTextSession: () => Promise<"no" | "after-download" | "readily">;
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
  async ({ prompt }) => {
    const ai = (globalThis as { ai?: PromptApi }).ai;
    if (!ai) {
      throw new Error(
        `The AI Prompt API is not available on this platform. For more ` +
          `information see https://developer.chrome.com/docs/ai/built-in.`
      );
    }
    const status = await ai.canCreateTextSession();
    // TODO It would be better if the "after-download" status popped up a dialog
    // asking if the user wants to download the model, since it is large.
    // Currently, the first session will just take a much longer time because it
    // will also download the model, and the user won't know why.
    if (!(status === "readily" || status === "after-download")) {
      throw new Error(
        `The AI Prompt API reports it is not available (status:${status}). ` +
          `For more information see ` +
          `https://developer.chrome.com/docs/ai/built-in.`
      );
    }
    const session = await ai.createTextSession();
    const text = await session.prompt(prompt);
    return { text };
  }
).outputs;

export const geminiNano = board({
  title: "Gemini Nano",
  description: "Generate text with Gemini Nano",
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
