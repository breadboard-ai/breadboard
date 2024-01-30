/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { board } from "@google-labs/breadboard";

import { templates } from "@google-labs/template-kit";
import { palm } from "@google-labs/palm-kit";
import { core } from "@google-labs/core-kit";

export const graph = board(
  {
    input: z.object({
      question: z.string().describe("Query: What is your math question?"),
    }),
    output: z.object({
      result: z.string().describe("Answer: The answer to the query"),
    }),
    title: "Math, chain style graph",
  },
  ({ question }) => {
    return templates
      .promptTemplate({
        template:
          "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
        question: question,
      })
      .prompt.as("text")
      .to(
        palm.generateText({
          PALM_KEY: core.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
        })
      )
      .completion.as("code")
      .to(core.runJavascript());
  }
);

export const example = { question: "1+1" };

export default await graph.serialize();
