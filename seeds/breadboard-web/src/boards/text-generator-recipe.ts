/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { recipe, base } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";
import { palm } from "@google-labs/palm-kit";
import { nursery } from "@google-labs/node-nursery-web";

const textGenerator = recipe(
  {
    input: z.object({
      text: z.string().describe("Text: The text to generate"),
      useStreaming: z
        .boolean()
        .describe("Stream: Whether to stream the output")
        .default(false),
      model: z
        .enum(["PaLM", "GPT 3.5 Turbo", "mock"])
        .describe("Model: The model to use for generation")
        .default("PaLM"),
    }),
    output: z.object({
      text: z.string().describe("Text: The generated text").optional(),
      stream: z.object({}).describe("Stream: The generated text").optional(),
    }),
  },
  async (inputs) => {
    const textOutput = base.output({
      schema: z.object({
        text: z.string().describe("Text: The generated text"),
      }),
    });

    const streamOutput = base.output({
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

    const generateText = palm.generateText({
      text: inputs.text,
      PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
    });
    generateText.completion.as("text").to(textOutput);

    const gpt35 = core.invoke({
      path: "openai-gpt-35-turbo.json",
      text: inputs.text,
      useStreaming: inputs.useStreaming,
    });
    gpt35.text.to(textOutput);
    gpt35.stream.to(streamOutput);

    const mockModel = recipe<
      { text: string; useStreaming: boolean },
      { text?: string; list?: string[] }
    >((inputs) => {
      const { text, useStreaming } = inputs;

      const result = `Mock model with streaming off echoes back: ${text}`;
      if (useStreaming) {
        const list = result.split(" ");
        return { list };
      }
      return { text: result };
    })({ text: inputs.text, useStreaming: inputs.useStreaming });
    mockModel.text.to(textOutput);
    mockModel.list.to(nursery.listToStream()).to(streamOutput);

    const switcher = recipe((inputs) => {
      const { model, useStreaming } = inputs;
      switch (model) {
        case "PaLM":
          if (useStreaming) {
            return { other: `Streaming is not supported for ${model}` };
          }
          return { palm: true };
        case "mock":
          return { mock: true };
        case "GPT 3.5 Turbo":
          return { gpt35: true };
        default:
          return { other: `Unsupported model: ${model}` };
      }
    })({ model: inputs.model, useStreaming: inputs.useStreaming });
    switcher.palm.to(generateText);
    switcher.gpt35.to(gpt35);
    switcher.mock.to(mockModel);
    switcher.other.as("text").to(textOutput);

    // TODO: The framework expects one of the output nodes. This is weird.
    return textOutput;
  }
);

export default await textGenerator.serialize({
  title: "Text Generator Recipe",
  description:
    "This is a text generator. It can generate text using various LLMs. Currently, it supports the follwogin models: Google PaLM text-bison-001, OpenAI GPT-3.5 Turbo, and a mock model. The mock model simply echoes back the input text. It's good for testing.",
  version: "0.0.1",
});
