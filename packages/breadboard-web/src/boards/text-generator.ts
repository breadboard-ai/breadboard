/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

const metadata = {
  title: "Text Generator",
  description:
    "This is a text generator. It can generate text using various LLMs. Currently, it supports the following models: Google Gemini Pro and OpenAI GPT-3.5 Turbo.",
  version: "0.0.2",
};

const inputSchema = {
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
      enum: ["Gemini Pro", "GPT 3.5 Turbo"],
      examples: ["Gemini Pro"],
    },
  },
  required: ["text"],
} satisfies Schema;

const textOutputSchema = {
  type: "object",
  properties: {
    text: {
      type: "string",
      title: "Text",
      description: "The generated text",
    },
  },
} satisfies Schema;

const streamOutputSchema = {
  type: "object",
  properties: {
    stream: {
      type: "object",
      title: "Stream",
      description: "The generated text",
      format: "stream",
    },
  },
} satisfies Schema;

export default await board(() => {
  const parameters = base.input({ $id: "input", schema: inputSchema });

  const textOutput = base.output({
    $id: "textOutput",
    schema: textOutputSchema,
  });

  const streamOutput = base.output({
    $id: "streamOutput",
    schema: streamOutputSchema,
  });

  const switchModel = code(({ MODEL }: { MODEL: string }) => {
    const models: Record<string, string> = {
      "Gemini Pro": "gemini-generator.json",
      "GPT 3.5 Turbo": "openai-gpt-35-turbo.json",
    };
    const path = models[MODEL];
    if (!path) throw new Error(`Unsupported model: ${MODEL}`);
    return { path };
  })(parameters.MODEL);

  const invoke = core.invoke({
    $id: "invoke",
    $board: switchModel.path,
  });
  parameters.to(invoke);
  invoke.text.to(textOutput);
  invoke.stream.to(streamOutput);

  return textOutput;
}).serialize(metadata);
