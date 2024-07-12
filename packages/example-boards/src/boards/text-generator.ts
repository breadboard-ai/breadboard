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
import { invoke, code } from "@google-labs/core-kit";

const text = input({
  type: "string",
  title: "Text",
  description: "The text to generate",
});

const model = input({
  type: enumeration("Gemini Pro", "GPT 3.5 Turbo"),
  title: "Model",
  description: "The model to use for generation",
  examples: ["Gemini Pro"],
});

const switchModel = code(
  { model },
  { path: "string" },
  ({ model }) => {
    const models: Record<string, string> = {
      "Gemini Pro": "gemini-generator.json",
      "GPT 3.5 Turbo": "openai-gpt-35-turbo.json",
    };
    const path = models[model];
    if (!path) throw new Error(`Unsupported model: ${model}`);
    return { path };
  }
);

const invoker = invoke({
  $id: "invoke",
  $board: switchModel.outputs.path,
  text
});

const textOutput = output(invoker.unsafeOutput("text"), {
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