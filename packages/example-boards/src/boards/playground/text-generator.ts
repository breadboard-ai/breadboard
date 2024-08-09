/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  board,
  enumeration,
  input,
  output,
} from "@breadboard-ai/build";
import { geminiText } from "@google-labs/gemini-kit";

const text = input({
  type: "string",
  title: "Text",
  description: "The text to generate",
});

const model = input({
  type: enumeration("gemini-1.5-flash-latest", "gemini-1.5-pro-latest")
});

const llmResponse = geminiText({ model, text });

const textOutput = output(llmResponse.outputs.text, {
  title: "Text",
  description: "The generated text",
});

export default board({
  title: "Text Generator",
  description:
    "This is a text generator. It can generate text using various LLMs. Currently, it supports the following models: Google Gemini Pro and OpenAI GPT-3.5 Turbo.",
  version: "0.1.0",
  inputs: { text, model },
  outputs: { textOutput }
});