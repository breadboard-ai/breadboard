/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, V, base, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { templates } from "@google-labs/template-kit";

const metadata = {
  title: "The Calculator Board",
  description:
    "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",
  version: "0.0.3",
};

const inputSchema = {
  type: "object",
  properties: {
    question: {
      type: "string",
      title: "Math problem",
      description: "Ask a math question",
      examples: ["What is the square root of pi?"],
    },
    generator: {
      type: "string",
      title: "Generator",
      description: "The URL of the generator to call",
      default: "text-generator.json",
    },
  },
  required: ["text"],
} satisfies Schema;

const outputSchema = {
  type: "object",
  properties: {
    result: {
      type: "string",
      title: "Answer",
      description: "The answer to the math problem",
    },
  },
  required: ["text"],
} satisfies Schema;

export default await board(() => {
  const input = base.input({ $id: "math-question", schema: inputSchema });
  const template = templates.promptTemplate({
    template: `Translate the math problem below into a self-contained,
zero-argument JavaScript function named \`compute\` that can be executed
to provide the answer to the problem.

Do not use any dependencies or libraries.

Math Problem: {{question}}

Solution:`,
    $id: "math-function",
    question: input.question,
  });
  const generator = core.invoke({
    $id: "generator",
    $board: input.generator as V<string>,
    text: template.prompt,
  });
  return core
    .runJavascript({
      $id: "compute",
      name: "compute",
      code: generator.text as V<string>,
    })
    .result.to(base.output({ $id: "answer", schema: outputSchema }));
}).serialize(metadata);
