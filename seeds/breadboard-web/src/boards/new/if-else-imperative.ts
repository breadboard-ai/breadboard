/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { flow, action } from "../../new/lib.js";
import { llm } from "../../new/kits.js";

const math = action((inputs) => {
  return llm
    .promptTemplate({
      template:
        "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
      question: inputs.question,
    })
    .prompt.as("text")
    .to(
      llm.generateText({
        PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
      })
    )
    .completion.as("code")
    .to(llm.runJavascript());
});

const search = action((inputs) => {
  // TODO: Implement
  return inputs;
});

export const graph = flow(
  async (inputs) => {
    const { completion } = await llm
      .promptTemplate({
        template:
          "Is this question about math? Answer YES or NO.\nQuestion: {{question}}\nAnswer: ",
        question: inputs.question,
      })
      .prompt.as("text")
      .to(
        llm.generateText({
          PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
        })
      );
    if (completion && (completion as string).startsWith("YES")) {
      return math({ question: inputs.question });
    } else {
      return search(inputs);
    }
  },
  { question: "1+1" }
);

export default await graph.serialize({ title: "IfElse, imperative execution" });
