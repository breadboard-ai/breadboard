/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";

const board = new Board({
  title: "Text Generator",
  description:
    "This is a text generator. It can generate text using various LLMs. Currently, it supports the follwogin models: Google PaLM text-bison-001, OpenAI GPT-3.5 Turbo, and a mock model. The mock model simply echoes back the input text. It's good for testing.",
  version: "0.0.1",
});
const palm = board.addKit(PaLMKit);
const starter = board.addKit(Starter);
const core = board.addKit(Core);

const input = board.input({
  $id: "input",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Text",
        description: "The text to generate",
      },
      model: {
        type: "string",
        title: "Model",
        description: "The model to use for generation",
        enum: ["PaLM", "GPT 3.5 Turbo", "mock"],
        default: "PaLM",
      },
    },
  },
});

function switchModel({ model }: { model: string }) {
  switch (model) {
    case "PaLM":
      return { palm: true };
    case "mock":
      return { mock: true };
    case "GPT 3.5 Turbo":
      return { gpt35: true };
    default:
      return { other: `Unsupported model: ${model}` };
  }
}

const switcher = starter.runJavascript({
  name: "switchModel",
  code: switchModel.toString(),
  raw: true,
});

const generateText = palm
  .generateText()
  .wire("<-PALM_KEY", starter.secrets({ keys: ["PALM_KEY"] }));

const gpt35 = core.invoke({
  $id: "gpt35",
  path: "openai-gpt-35-turbo.json",
});

function runMockModel({ text }: { text: string }) {
  return { text: `Mock model echoes back: ${text}` };
}

const mockModel = starter.runJavascript({
  $id: "mockModel",
  name: "runMockModel",
  code: runMockModel.toString(),
  raw: true,
});

const output = board.output({
  $id: "output",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Text",
        description: "The generated text",
      },
    },
  },
});

input.wire("model->", switcher);
input.wire("text->", gpt35.wire("text->", output));
input.wire("text->", generateText.wire("completion->text", output));
input.wire("text->", mockModel.wire("text->", output));
switcher
  .wire("other->text", output)
  .wire("palm->", generateText)
  .wire("gpt35->", gpt35)
  .wire("mock->", mockModel);

export default board;
