/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { action } from "../../new/lib.js";
import { llm } from "../../new/kits.js";

export const graph = action((inputs) => {
  const { prompt } = llm.promptTemplate({
    template:
      "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
    question: inputs.question,
  });
  const { completion } = llm.generateText({
    text: prompt,
    PALM_KEY: llm.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
  });
  const result = llm.runJavascript({ code: completion });
  return result;
});

export const example = { question: "1+1" };

export default await graph.serialize({
  title: "New: Math, imperative style graph",
});
