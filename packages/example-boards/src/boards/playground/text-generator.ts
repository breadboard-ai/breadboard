/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  board,
  enumeration,
  input,
  object,
  output,
} from "@breadboard-ai/build";
import { code, invoke } from "@google-labs/core-kit";

const text = input({
  type: "string",
  title: "Text",
  description: "The text to generate",
});

const model = input({
  type: enumeration("Gemini Pro", "GPT 3.5 Turbo")
});

const switchModel = code(
  { model },
  { board: object({ kind: "string", path: "string"}), model: "string" },
  ({ model }) => {
    const models: Record<string, string> = {
      "Gemini Pro": "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/gemini-kit/graphs/gemini-generator.json",
      "GPT 3.5 Turbo": "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/visual-editor/public/example-boards/playground/openai-gpt-35-turbo.json",
    };
    const path = models[model];
    if (model == "Gemini Pro") {
      return  { board: { kind: "board", path }, model: "gemini-1.5-pro-latest" }
    } else {
      return  { board: { kind: "board", path }, model: "N/A" } // The OpenAI board only supports one model
    }
  }
);

const llmResponse = invoke({
  $id: "llm-response",
  $board: switchModel.outputs.board,
  text,
  model: switchModel.outputs.model,
}).unsafeOutput("text");

const textOutput = output(llmResponse, {
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