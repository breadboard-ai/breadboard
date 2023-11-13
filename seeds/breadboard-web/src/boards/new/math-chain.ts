/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { flow } from "../../new/lib.js";
import { llm } from "../../new/kits.js";

export const graph = flow(
  (inputs) => {
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
  },
  { question: "1+1" }
);

export default await graph.serialize({ title: "Math, chain style graph" });
