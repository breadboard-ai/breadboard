/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { V, base, recipe } from "@google-labs/breadboard";
import { starter } from "@google-labs/llm-starter";

/**
 * A recipe for chunking OpenaAI output streams into text chunks.
 */
export const chunkTransformer = recipe(() => {
  const input = base.input({ $id: "chunk" });
  const transformCompletion = starter.jsonata({
    $id: "transformCompletion",
    expression: 'choices[0].delta.content ? choices[0].delta.content : ""',
    json: input.chunk as V<string>,
  });

  return transformCompletion.result
    .as("chunk")
    .to(base.output({ $id: "result" }));
});
