/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { starter } from "@google-labs/llm-starter";

export default await recipe(({ text, generator, context, stopSequences }) => {
  text
    .title("Text")
    .examples(
      `
  You are a brilliant poet who specializes in two-line rhyming poems.
  Given any topic, you can quickly whip up a two-line rhyming poem about it.
  Ready?
  
  The topic is: the universe within us`
    )
    .format("multiline");
  generator.title("Generator").examples("gemini-generator.json");
  context.title("Context").isArray().examples("[]");
  stopSequences.title("Stop Sequences").isArray().optional().default("[]");

  const generate = core.invoke({
    $id: "generate",
    text,
    context,
    stopSequences,
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
    text,
    context,
  });

  return { context: assemble.result, text: generate.text };
}).serialize({
  title: "Agent",
  description: "A prototype of an agent-like board",
  version: "0.0.2",
});
