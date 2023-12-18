/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, V, base, recipe, recipeAsCode } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { palm } from "@google-labs/palm-kit";

const metadata = {
  title: "PaLM Text Generator",
  description:
    "This text generator relies on the Google PaLM text-bison-001 model.",
  version: "0.0.1",
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

export default await recipe(async () => {
  const parameters = base.input({ $id: "parameters", schema: inputSchema });

  recipeAsCode(({ useStreaming }) => {
    if (useStreaming)
      throw new Error("Streaming is not supported by PaLM model");
    return {};
  })(parameters.useStreaming);

  const generateText = palm.generateText({
    $id: "generateText",
    text: parameters.text as V<string>,
    PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }),
  });

  const textOutput = base.output({
    $id: "textOutput",
    schema: textOutputSchema,
    text: generateText.completion,
  });

  return textOutput;
}).serialize(metadata);
