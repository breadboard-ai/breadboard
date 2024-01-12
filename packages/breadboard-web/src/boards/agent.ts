/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

export default await recipe(({ topic, template, generator, context }) => {
  const prompt = starter.promptTemplate({
    $id: "prompt",
    template: template.title("Template").isString().examples(`
You are a brilliant poet who specializes in two-line rhyming poems.
Given any topic, you can quickly whip up a two-line rhyming poem about it.
Ready?

The topic is: {{topic}}`),
    topic: topic.title("Topic").examples("The universe within us"),
  });
  const generate = core.invoke({
    $id: "generate",
    text: prompt.prompt,
    path: generator
      .isString()
      .title("Generator")
      .examples("gemini-generator.json"),
  });

  const assemble = starter.jsonata({
    $id: "assemble",
    expression: `$append(context ? context, $append([
      {
          "role": "user",
          "parts": [
              {
                  "text": text
              }
          ]
      }
  ], [generated]))`,
    generated: generate.context,
    text: prompt.prompt,
    context: context.title("Context").isArray().examples("[]"),
  });

  return { context: assemble.result };
}).serialize({
  title: "Agent",
  description: "A prototype of an agent-like board",
  version: "0.0.1",
});
