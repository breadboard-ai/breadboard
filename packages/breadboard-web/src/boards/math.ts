/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { board, input, output, unsafeCast } from "@breadboard-ai/build";
import { invoke, runJavascript } from "@google-labs/core-kit";
import { promptTemplate } from "@google-labs/template-kit";

const question = input({
  $id: "math-question",
  title: "Math problem",
  description: "Ask a math question",
  examples: ["What is the square root of pi?"],
});

const generator = input({
  $id: "math-question",
  title: "Generator",
  description: "The URL of the generator to call",
  default: "text-generator.json",
});

// TODO(aomarks) Implement a prompt`...` template literal function that enforces
// placeholders.
const prompt = promptTemplate({
  $id: "math-function",
  template: `Translate the math problem below into a self-contained,
zero-argument JavaScript function named \`compute\` that can be executed
to provide the answer to the problem.

Do not use any dependencies or libraries.

Math Problem: {{question}}

Solution:`,
  question,
});

const generatedCode = invoke({
  $id: "generator",
  $board: generator,
  text: prompt,
  // TODO(aomarks) Some kind of helper that can abstract over multiple boards
  // (need to convert all underyling boards to the new API first).
}).unsafeOutput("text");

const result = runJavascript({
  $id: "compute",
  name: "compute",
  code: generatedCode,
  // TODO(aomarks) Implement a `code` helper that enforces params/return.
}).unsafeOutput("result");

export default board({
  title: "The Calculator Board",
  description:
    "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",
  version: "0.0.4",
  inputs: { question, generator },
  outputs: {
    result: output(
      // TODO(aomarks) This unsafeCast is here to match the existing schema to
      // prove we can replicate it, but actually we should add a node here which
      // enforces that the type is string, and errors if it doesn't match. An
      // assertType node in core-kit, maybe?
      unsafeCast(result, "string"),
      {
        id: "answer",
        title: "Answer",
        description: "The answer to the math problem",
      }
    ),
  },
});
