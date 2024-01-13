/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

export default await recipe(({ topic, template, generator, context }) => {
  topic.title("Topic").examples("The universe within us");
  template
    .title("Template")
    .examples(
      `
  You are a brilliant poet who specializes in two-line rhyming poems.
  Given any topic, you can quickly whip up a two-line rhyming poem about it.
  Ready?
  
  The topic is: {{topic}}`
    )
    .format("multiline");
  generator.title("Generator").examples("gemini-generator.json");
  context.title("Context").isArray().examples("[]");

  const prompt = starter.promptTemplate({
    $id: "prompt",
    template: template.isString(),
    topic,
  });
  const generate = core.invoke({
    $id: "generate",
    text: prompt.prompt,
    path: generator.isString(),
  });

  const assemble = starter.jsonata({
    $id: "assemble",
    expression: `$append(context ? context, $append([
      {
          "role": "user",
          "parts": [ { "text": text } ]
      }
  ], [generated]))`,
    generated: generate.context,
    text: prompt.prompt,
    context,
  });

  return { context: assemble.result };
}).serialize({
  title: "Agent",
  description: "A prototype of an agent-like board",
  version: "0.0.1",
});
