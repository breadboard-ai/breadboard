/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { recipe } from "@google-labs/breadboard";

import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";
import { palm } from "@google-labs/palm-kit";

import { graph as math } from "./math-imperative.js";
import { graph as search } from "./search-summarize-as-action.js";

export const graph = recipe(
  {
    input: z.object({
      text: z.string().describe("Query: A math or search question?"),
    }),
    output: z.object({
      result: z.string().describe("Answer: The answer to the query"),
    }),
  },
  async (inputs) => {
    return starter
      .promptTemplate({
        template:
          "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
        question: inputs.text,
      })
      .prompt.as("text")
      .to(
        palm.generateText({
          PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
        })
      )
      .to(
        async (inputs) => {
          const { completion, math, search } = await inputs;
          if (completion?.startsWith("YES")) {
            return {
              result: math({ question: inputs.question }).result,
            };
          } else {
            return {
              result: search({ text: inputs.question }).text,
            };
          }
        },
        { question: inputs.text, math, search }
      )
      .result.to(core.passthrough());
  }
);

export const example = { question: "1+1" };

export default await graph.serialize({ title: "New: IfElse, serializable" });
