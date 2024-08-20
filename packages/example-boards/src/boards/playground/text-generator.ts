/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  anyOf,
  board,
  enumeration,
  input,
  object,
  output,
  serialize,
} from "@breadboard-ai/build";
import { code, invoke } from "@google-labs/core-kit";
import { geminiText } from "@google-labs/gemini-kit";

const text = input({
  type: "string",
  title: "Text",
  description: "The text to generate",
});

const model = input({
  type: enumeration("Gemini Pro", "GPT 3.5 Turbo")
});

const geminiGenerator = serialize(geminiText);

const switchModel = code(
  { model, serialized: JSON.stringify(geminiGenerator) },
  { board: anyOf(object({ kind: "string", board: "string"}), object({ kind: "string", path: "string"})), model: "string" },
  ({ model, serialized }) => {
    if (model == "Gemini Pro") {
      return  { board: { kind: "board", board: JSON.parse(serialized) }, model: "gemini-1.5-pro-latest" }
    } else {
      return  { board: { kind: "board", path: "openai-gpt-35-turbo.json" }, model: "N/A" } // The OpenAI board only supports one model
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