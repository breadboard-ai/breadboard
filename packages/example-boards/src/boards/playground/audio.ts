/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, board, input, object, output } from "@breadboard-ai/build";
import { geminiText } from "@google-labs/gemini-kit";

const audio = input({
  title: "Audio",
  type: annotate(object({}), {
    behavior: ["llm-content"],
  })
});

const generator = input({
  type: annotate(object({}), {
    behavior: ["board"],
  }),
  default: { kind: "board", path: "gemini-generator.json" },
});

const llmResponse = geminiText({
  text: "unused",
  context: audio,
  model: "gemini-1.5-pro-latest",
  systemInstruction: `Describe what you hear in the audio. Please respond in markdown`,
});

export default board({
  title: "Audio",
  description: "An example of using Gemini Kit's vision(?) node with audio",
  version: "0.1.0",
  inputs: { audio, generator },
  outputs: {
    text: output(llmResponse.outputs.text),
  },
});