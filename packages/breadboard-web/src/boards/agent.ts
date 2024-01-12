/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

export default await recipe(({ topic, template, generator }) => {
  const prompt = starter.promptTemplate({
    $id: "prompt",
    template: template
      .title("Template")
      .isString()
      .examples(
        `You are the most amazing poet who specializes in two-line rhyming poems.
  Given any topic, you can quickly whip up a two-line rhyming poem about it.
  Ready?

  The topic is: {{topic}}`
      ),
    topic: topic.title("Instruction").examples("The universe within us"),
  });
  const generate = core.invoke({
    $id: "generate",
    text: prompt.prompt,
    path: generator
      .isString()
      .title("Generator")
      .examples("gemini-generator.json"),
  });

  return { result: generate.text, context: generate.context };
}).serialize({
  title: "Agent",
  description: "A prototype of an agent-like board",
  version: "0.0.1",
});
