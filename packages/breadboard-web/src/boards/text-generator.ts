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

const MODEL = input({
      type: enumeration("Gemini Pro", "GPT 3.5 Turbo"),
      title: "Model",
      description: "The model to use for generation",
      examples: ["Gemini Pro"],
});

const switchModel = code(
  { MODEL },
  { path: "string" },
  ({ MODEL }) => {
    const models: Record<string, string> = {
      "Gemini Pro": "gemini-generator.json",
      "GPT 3.5 Turbo": "openai-gpt-35-turbo.json",
    };
    const path = models[MODEL];
    if (!path) throw new Error(`Unsupported model: ${MODEL}`);
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
  version: "0.0.2",
  inputs: { text, MODEL },
  outputs: { textOutput }
});