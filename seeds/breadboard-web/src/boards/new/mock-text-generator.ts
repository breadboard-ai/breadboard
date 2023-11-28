/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";
import { z } from "zod";

const mockGenerator = recipe(
  {
    input: z.object({
      text: z.string().describe("Text: The text to generate from"),
      useStreaming: z
        .boolean()
        .describe("Stream: Whether to stream the output"),
    }),
    output: z.object({
      text: z.string().describe("TexT: The generated text"),
    }),
  },
  (inputs) => {
    function runMockModel({
      text,
      useStreaming,
    }: {
      text: string;
      useStreaming: boolean;
    }) {
      text = `Mock model with streaming off echoes back: ${text}`;
      if (useStreaming) {
        const list = text.split(" ");
        return { list };
      }
      return { text };
    }

    const mockModel = starter.runJavascript({
      text: inputs.text,
      useStreaming: inputs.useStreaming,
      name: "runMockModel",
      code: runMockModel.toString(),
      raw: true,
    });

    return { text: mockModel.result as unknown as string };
  }
);

export default await mockGenerator.serialize({
  title: "Mock Text Generator",
  description: "Useful for when you want a text generator for testing purposes",
});
