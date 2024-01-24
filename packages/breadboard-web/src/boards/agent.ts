/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";

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
  generator.title("Generator").optional().default("gemini-generator.json");
  context.title("Context").isArray().examples("[]");
  stopSequences.title("Stop Sequences").isArray().optional().default("[]");

  const { context: generated, text: output } = core.invoke({
    $id: "generate",
    text,
    context,
    stopSequences,
    path: generator.isString(),
  });

  const { result } = json.jsonata({
    $id: "assemble",
    expression: `$append(context ? context, $append([
      {
          "role": "user",
          "parts": [ { "text": text } ]
      }
  ], [generated]))`,
    generated,
    text,
    context,
  });

  result
    .title("Context")
    .isObject()
    .description("Agent context after generation");
  output.title("Output").isString().description("Agent's output");

  return { context: result, text: output };
}).serialize({
  title: "Agent",
  description: "A prototype of an agent-like board",
  version: "0.0.3",
});
