/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { annotate, array, board, enumeration, input, object, output } from "@breadboard-ai/build";
import { geminiText } from "@google-labs/gemini-kit";

const imagePartType = object({
  inlineData: object({
    mimeType: enumeration(
      "image/png",
      "image/jpeg",
      "image/heic",
      "image/heif",
      "image/webp"
    ),
    data: "string",
  }),
});

const generateContentContentsType = object({
  role: "string",
  parts: array(imagePartType),
});

const picture = input({
  title: "Image",
  type: array(
    annotate(generateContentContentsType, {
      behavior: ["llm-content"],
    })
  )
});

const prompt = input({
  title: "Prompt",
  type: "string",
  examples: ["Describe what you see in the picture"]
});

const llmResponse = geminiText({
  text: "unused",
  context: picture as any,
  model: "gemini-1.5-pro-latest",
  systemInstruction: prompt
});

export default board({
  title: "Webcam",
  description: "An example of using Gemini Kit's text node with a webcam",
  version: "0.1.0",
  inputs: { picture, prompt },
  outputs: {
    text: output(llmResponse.outputs.text),
  },
});