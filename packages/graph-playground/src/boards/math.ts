/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import Core from "@google-labs/core-kit";
import { TemplateKit } from "@google-labs/template-kit";
import { PaLMKit } from "@google-labs/palm-kit";

const math = new Board({
  title: "The Calculator Board",
  description:
    "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",
  version: "0.0.1",
});
const kit = math.addKit(TemplateKit);
const core = math.addKit(Core);
const palm = math.addKit(PaLMKit);

math
  .input({
    $id: "math-question",
    schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          title: "Math problem",
          description: "Ask a math question",
        },
      },
      required: ["text"],
    },
  })
  .wire(
    "text->question",
    kit
      .promptTemplate({
        template:
          "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
        $id: "math-function",
      })
      .wire(
        "prompt->text",
        palm
          .generateText({ $id: "math-function-generator" })
          .wire(
            "completion->code",
            core
              .runJavascript({
                name: "compute",
                $id: "compute",
              })
              .wire(
                "result->text",
                math.output({
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
          )
          .wire("<-PALM_KEY", core.secrets({ keys: ["PALM_KEY"] }))
      )
  );

export default math;
