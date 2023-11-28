/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { recipe } from "@google-labs/breadboard";

import { starter } from "@google-labs/llm-starter";
import { palm } from "@google-labs/palm-kit";

export const graph = recipe(
  {
    input: z.object({
      question: z.string().describe("Query: What is your math question?"),
    }),
    output: z.object({
      result: z.string().describe("Answer: The answer to the query"),
    }),
  },
  (inputs) => {
    const { prompt } = starter.promptTemplate({
      template:
        "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
      question: inputs.question,
    });
    const { completion } = palm.generateText({
      text: prompt,
      PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
    });
    const result = starter.runJavascript({ code: completion });
    return result;
  }
);

export const example = { question: "1+1" };

export default await graph.serialize({
  title: "New: Math, imperative style graph",
});
