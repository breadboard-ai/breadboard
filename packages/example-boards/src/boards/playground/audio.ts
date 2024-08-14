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
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  context: audio as any,
  model: "gemini-1.5-pro-latest",
  systemInstruction: `Describe what you hear in the audio. Please respond in markdown`,
});

export default board({
  title: "Audio",
  description: "An example of using Gemini Kit's text node with audio",
  version: "0.1.0",
  inputs: { audio },
  outputs: {
    text: output(llmResponse.outputs.text),
  },
});