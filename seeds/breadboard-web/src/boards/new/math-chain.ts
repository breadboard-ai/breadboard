/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { action } from "../../new/lib.js";
import { starter, palm } from "../../new/kits.js";

export const graph = action((inputs) => {
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

export const example = { question: "1+1" };

export default await graph.serialize({ title: "New: Math, chain style graph" });
