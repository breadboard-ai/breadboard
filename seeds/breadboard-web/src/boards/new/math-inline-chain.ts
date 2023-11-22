/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { core, starter, palm } from "../../new/kits.js";

const question = "1+1";

export const graph = core
  .passthrough({ question })
  .to(
    starter.promptTemplate({
      template:
        "Write a Javascript function called `run` to compute the result for this question:\nQuestion: {{question}}\nCode: ",
    })
  )
  .prompt.as("text")
  .to(
    palm.generateText({
      PALM_KEY: starter.secrets({ keys: ["PALM_KEY"] }).PALM_KEY,
    })
  )
  .completion.as("code")
  .to(starter.runJavascript());

// This would be typically used as "await graph", not as a (serialized) graph.
// Hence no example.

export const example = undefined;

export default await graph.serialize({
  title: "New: Math, directly calling a chain",
});
