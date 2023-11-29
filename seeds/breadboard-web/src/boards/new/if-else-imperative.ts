/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";

import { recipe } from "@google-labs/breadboard";

import { starter } from "@google-labs/llm-starter";
import { palm } from "@google-labs/palm-kit";

import { graph as math } from "./math-imperative.js";
import { graph as search } from "./search-summarize-as-action.js";

export const graph = recipe(
  {
    input: z.object({
      question: z.string().describe("Query: A math or search question?"),
    }),
    output: z.object({
      result: z.string().describe("Answer: The answer to the query"),
    }),
  },
  async (inputs) => {
    const { completion } = await starter
      .promptTemplate({
        template:
          "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
        question: inputs.question,
      })
      .prompt.as("text")
      .to(
        palm.generateText({
          PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
        })
      );

    if (completion?.startsWith("YES")) {
      return { result: await math({ question: inputs.question }).result };
    } else {
      return { result: await search({ text: inputs.question }).text };
    }
  }
);

export const example = { question: "1+1" };

export default await graph.serialize({
  title: "New: IfElse, imperative execution",
});
