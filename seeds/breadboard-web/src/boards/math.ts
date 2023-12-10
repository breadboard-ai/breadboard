/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { Starter } from "@google-labs/llm-starter";

const recipe = new Board({
  title: "The Calculator Recipe",
  description:
    "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",
  version: "0.0.2",
});
const kit = recipe.addKit(Starter);
const core = recipe.addKit(Core);

const inputs = recipe.input({
  $id: "math-question",
  schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        title: "Math problem",
        description: "Ask a math question",
      },
      generator: {
        type: "string",
        title: "Generator",
        description: "The URL of the generator to call",
        default: "/graphs/text-generator.json",
      },
    },
    required: ["text"],
  },
});

inputs.wire(
  "text->question",
  kit
    .promptTemplate({
      template:
        "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
      $id: "math-function",
    })
    .wire(
      "prompt->text",
      core
        .invoke({ $id: "generator" })
        .wire("path<-generator", inputs)
        .wire(
          "text->code",
          kit
            .runJavascript({
              name: "compute",
              $id: "compute",
            })
            .wire(
              "result->text",
              recipe.output({
                $id: "print",
                schema: {
                  type: "object",
                  properties: {
                    text: {
                      type: "string",
                      title: "Answer",
                      description: "The answer to the math problem",
                    },
                  },
                  required: ["text"],
                },
              })
            )
            .wire("<-PALM_KEY", kit.secrets({ keys: ["PALM_KEY"] }))
        )
    )
);

export default recipe;
