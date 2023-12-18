/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NodeValue,
  Schema,
  base,
  recipe,
  recipeAsCode,
} from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";

const metadata = {
  title: "Mock Text Generator",
  description:
    "This is a mock text generator. It can generate text using a mock model. The mock model simply echoes back the input text. It's good for testing.",
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
  },
  required: ["text"],
} satisfies Schema;

type MockGeneratorInputs = {
  text: string;
  useStreaming: boolean;
};

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

type MockGeneratorTextOutput = {
  text: string;
};

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

type MockGeneratorStreamOutput = {
  stream: NodeValue;
};

type MockGeneratorOutputs = MockGeneratorTextOutput | MockGeneratorStreamOutput;

const mockGenerator = recipe<MockGeneratorInputs, MockGeneratorOutputs>(
  async () => {
    const inputs = base.input({
      $id: "parameters",
      schema: inputSchema,
    });
    type GeneratorOutputs = MockGeneratorTextOutput | { list: string[] };

    const generator = recipeAsCode<MockGeneratorInputs, GeneratorOutputs>(
      async ({ text, useStreaming }) => {
        text = `Mock model with streaming off echoes back: ${text}`;
        if (useStreaming) {
          const list = text.split(" ");
          return { list };
        }
        return { text };
      }
    )(inputs);

    return { text: generator.text };
  }
);

export default await mockGenerator.serialize(metadata);
