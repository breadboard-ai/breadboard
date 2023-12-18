/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Board,
  Schema,
  base,
  recipe,
  recipeAsCode,
} from "@google-labs/breadboard";
import { Core, core } from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

const metadata = {
  title: "Text Generator",
  description:
    "This is a text generator. It can generate text using various LLMs. Currently, it supports the follwogin models: Google Gemini Pro, Google PaLM text-bison-001, OpenAI GPT-3.5 Turbo, and a mock model.",
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
      enum: ["Gemini Pro", "GPT 3.5 Turbo", "PaLM", "mock"],
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

export default await recipe(async () => {
  const parameters = base.input({ $id: "input", schema: inputSchema });

  const textOutput = base.output({
    $id: "textOutput",
    schema: textOutputSchema,
  });

  const streamOutput = base.output({
    $id: "streamOutput",
    schema: streamOutputSchema,
  });

  const switchModel = recipeAsCode(({ MODEL }) => {
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
  })(parameters.MODEL);

  const mock = core.invoke({
    $id: "mock",
    path: "mock-text-generator.json",
    choose: switchModel.mock,
  });
  parameters.to(mock);
  mock.text.to(textOutput);
  mock.stream.to(streamOutput);

  const gemini = core.invoke({
    $id: "gemini",
    path: "gemini-generator.json",
    choose: switchModel.gemini,
  });
  parameters.to(gemini);
  gemini.text.to(textOutput);
  gemini.stream.to(streamOutput);

  const palmGenerator = core.invoke({
    $id: "palmGenerator",
    path: "palm-text-generator.json",
    choose: switchModel.palm,
  });
  parameters.to(palmGenerator);
  palmGenerator.text.to(textOutput);
  palmGenerator.stream.to(streamOutput);

  const gpt35 = core.invoke({
    $id: "gpt35",
    path: "openai-gpt-35-turbo.json",
    choose: switchModel.gpt35,
  });
  parameters.to(gpt35);
  gpt35.text.to(textOutput);
  gpt35.stream.to(streamOutput);

  return textOutput;
}).serialize(metadata);
