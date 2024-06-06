/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input } from "@breadboard-ai/build";
import { code } from "@google-labs/core-kit";

const prompt = input({
  title: "Prompt",
});

const { text } = code({ prompt }, { text: "string" }, async ({ prompt }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (globalThis as any).ai.createTextSession();
  const text = (await session.prompt(prompt)) as string;
  return { text };
}).outputs;

export default board({
  title: "Gemini Nano",
  description: "Generate text with Gemini Nano",
  metadata: {
    icon: "nano",
  },
  inputs: { prompt },
  outputs: { text },
});
