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
  async (inputs) => {
    return starter
      .promptTemplate({
        template:
          "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
        question: inputs.question,
      })
      .prompt.as("text")
      .to(
        palm.generateText({
          PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
        })
      )
      .completion.as("code")
      .to(starter.runJavascript());
  }
);

export const example = { question: "1+1" };

export default await graph.serialize({ title: "New: Math, chain style graph" });
