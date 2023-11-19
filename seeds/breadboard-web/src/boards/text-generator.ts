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
    "This is a text generator. It can generate text using various LLMs. Currently, it only supports the PaLM model.",
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
        enum: ["PaLM"],
        default: "PaLM",
      },
    },
  },
});

function switchModel({ model }: { model: string }) {
  switch (model) {
    case "PaLM":
      return { palm: true };
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

input.wire("model->", switcher.wire("palm->", generateText));
input.wire("text->", generateText.wire("completion->text", output));
switcher.wire("other->text", output);

export default board;
