/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, recipe, code } from "@google-labs/breadboard";

const metaData = {
  title: "Generate retrieve some text that would be aligned to an embedding",
  description: "",
  version: "0.0.3",
};

const embeddingScheme = {
  type: "object",
  properties: {
    embedding: {
      type: "object",
      title: "retrieve",
      description: "The embedding",
    },
  },
  required: ["embedding"],
};

export default await recipe(() => {
  const input = base.input({ $id: "input", schema: embeddingScheme });

  const textNode = code(({ embedding }) => {
    if (embedding === undefined || embedding == ".") {
      throw new Error("retrieve: embedding is undefined");
    }
    return {
      candidates: [
        "This is a test response for context",
        "This is a second test response for context",
      ],
    };
  });

  return input.embedding
    .to(textNode())
    .candidates.to(base.output({ $id: "retrieve_result" }));
}).serialize(metaData);
