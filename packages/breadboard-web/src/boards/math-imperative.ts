/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from "zod";
import { board, V } from "@google-labs/breadboard";

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
    title: "Math, imperative style graph",
  },
  ({ question }) => {
    const { prompt } = templates.promptTemplate({
      template:
        "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
      question: question,
    });
    const { completion } = palm.generateText({
      text: prompt.isString(),
      PALM_KEY: core.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
    });
    const { result } = core.runJavascript({
      code: completion,
    });
    return { result: result as V<string> };
  }
);

export const example = { question: "1+1" };

export default await graph.serialize({});
