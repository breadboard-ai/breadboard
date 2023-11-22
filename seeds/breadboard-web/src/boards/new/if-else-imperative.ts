/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { action } from "../../new/lib.js";
import { starter, palm } from "../../new/kits.js";

const math = action((inputs) => {
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
});

const search = action((inputs) => {
  // TODO: Implement
  return inputs;
});

export const graph = action(async (inputs) => {
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

  if (completion && (completion as string).startsWith("YES")) {
    return math({ question: inputs.question });
  } else {
    return search(inputs);
  }
});

export const example = { question: "1+1" };

export default await graph.serialize({
  title: "New: IfElse, imperative execution",
});
