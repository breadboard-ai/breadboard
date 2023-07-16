/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";

const math = new Board();
const kit = math.addKit(Starter);

const completion = kit.textCompletion({ $id: "math-function-completion" });
const prompt = kit.textTemplate(
  "Translate the math problem below into a JavaScript function named `compute` that can be executed to provide the answer to the problem\nMath Problem: {{question}}\nSolution:",
  { $id: "math-function" }
);

kit.secrets(["API_KEY"]).wire("API_KEY", completion);

math
  .input("Ask a math question", { $id: "math-question" })
  .wire(
    "text->question",
    prompt.wire(
      "prompt->text",
      completion.wire(
        "completion->code",
        kit
          .runJavascript("compute", { $id: "compute" })
          .wire("result->text", math.output({ $id: "print" }))
      )
    )
  );

export default math;
