/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const math = new Board();
const kit = math.addKit(Starter);

math.input("Ask a math question", { $id: "math-question" }).wire(
  "text->question",
  kit
    .promptTemplate(
      "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
      { $id: "math-function" }
    )
    .wire(
      "prompt->text",
      kit
        .generateText({ $id: "math-function-completion" })
        .wire(
          "completion->code",
          kit
            .runJavascript("compute", { $id: "compute" })
            .wire("result->text", math.output({ $id: "print" }))
        )
        .wire("<-PALM_KEY", kit.secrets(["PALM_KEY"]))
    )
);

export default math;
