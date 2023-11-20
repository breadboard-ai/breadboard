/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { PaLMKit } from "@google-labs/palm-kit";

const board = new Board({
  title: "Text Generator",
  description:
    "This is a text generator. It can generate text using various LLMs. Currently, it only supports the PaLM model and a mock model. The mock model simply echoes back the input text. It's good for testing.",
  version: "0.0.1",
});
const palm = board.addKit(PaLMKit);
const starter = board.addKit(Starter);

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
        enum: ["PaLM", "mock"],
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
input.wire("text->", generateText.wire("completion->text", output));
input.wire("text->", mockModel.wire("text->text", output));
switcher
  .wire("other->text", output)
  .wire("palm->", generateText)
  .wire("mock->", mockModel);

export default board;
