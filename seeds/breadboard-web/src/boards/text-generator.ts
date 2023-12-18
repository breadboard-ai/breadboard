/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board, Schema } from "@google-labs/breadboard";
import { Core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

const board = new Board({
  title: "Text Generator",
  description:
    "This is a text generator. It can generate text using various LLMs. Currently, it supports the follwogin models: Google Gemini Pro, Google PaLM text-bison-001, OpenAI GPT-3.5 Turbo, and a mock model.",
  version: "0.0.1",
});
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
      useStreaming: {
        type: "boolean",
        title: "Stream",
        description: "Whether to stream the output",
        default: "false",
      },
      MODEL: {
        type: "string",
        title: "Model",
        description: "The model to use for generation",
        enum: ["Gemini Pro", "GPT 3.5 Turbo", "PaLM", "mock"],
        examples: ["Gemini Pro"],
      },
    },
    required: ["text"],
  } satisfies Schema,
});

function switchModel({ MODEL }: { MODEL: string }) {
  switch (MODEL) {
    case "Gemini Pro":
      return { gemini: true };
    case "PaLM":
      return { palm: true };
    case "mock":
      return { mock: true };
    case "GPT 3.5 Turbo":
      return { gpt35: true };
    default:
      return { other: `Unsupported model: ${MODEL}` };
  }
}

const textOutput = board.output({
  $id: "textOutput",
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

const streamOutput = board.output({
  $id: "streamOutput",
  schema: {
    type: "object",
    properties: {
      stream: {
        type: "object",
        title: "Stream",
        description: "The generated text",
        format: "stream",
      },
    },
  },
});

const switcher = starter.runJavascript({
  $id: "switchModel",
  name: "switchModel",
  code: switchModel.toString(),
  raw: true,
});

const gemini = core
  .invoke({
    $id: "gemini",
    path: "gemini-generator.json",
  })
  .wire("<-useStreaming", input)
  .wire("<-text", input)
  .wire("text->", textOutput)
  .wire("stream->", streamOutput);

const palmGenerator = core.invoke({
  $id: "palmGenerator",
  path: "palm-text-generator.json",
});
input.wire("useStreaming->", palmGenerator);

const gpt35 = core.invoke({
  $id: "gpt35",
  path: "openai-gpt-35-turbo.json",
});

input.wire("MODEL->", switcher);

input.wire("useStreaming->", gpt35);
input.wire("text->", gpt35.wire("text->", textOutput));
gpt35.wire("stream->", streamOutput);

input.wire("text->", palmGenerator.wire("text->", textOutput));

const mockModel = core.invoke({
  $id: "mockModel",
  path: "mock-text-generator.json",
});

input.wire("useStreaming->", mockModel);
input.wire("text->", mockModel.wire("text->", textOutput));
switcher
  .wire("other->text", textOutput)
  .wire("gemini->", gemini)
  .wire("palm->", palmGenerator)
  .wire("gpt35->", gpt35)
  .wire("mock->", mockModel);

mockModel.wire("stream->", streamOutput);

export default board;
