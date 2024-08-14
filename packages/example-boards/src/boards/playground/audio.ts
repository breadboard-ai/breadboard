/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, array, board, input, object, output } from "@breadboard-ai/build";
import { geminiText } from "@google-labs/gemini-kit";

const audio = input({
  title: "Audio",
  type: array(
    annotate(object({}), {
      behavior: ["llm-content"],
    })
  )
});

const llmResponse = geminiText({
  text: "unused",
  context: audio as any,
  model: "gemini-1.5-pro-latest",
  systemInstruction: `Describe what you hear in the audio. Please respond in markdown`,
});

export default board({
  title: "Audio",
  description: "An example of using Gemini Kit's vision(?) node with audio",
  version: "0.1.0",
  inputs: { audio },
  outputs: {
    text: output(llmResponse.outputs.text),
  },
});