/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { palm } from "@google-labs/palm-kit";

const metaData = {
  title: "Generate an embedding",
  description:
    "Generates an embedding using PaLM, but can be used with any embedding provider (if the 'provider' is specified.)",
  version: "0.0.3",
};

const embeddingScheme = {
  type: "object",
  properties: {
    input: {
      type: "string",
      title: "input",
      description: "What text is used to generate the embedding?",
    },
    provider: {
      type: "string",
      title: "provider",
      description: "The URL of the embedding provider board?",
      default: ".",
    },
  },
  required: ["input"],
};

export default await board(() => {
  // Either use the default embedding provider or use a custom one (specified by provider)
  const embeddingApi = code(({ provider, palmBoard }) => {
    // The provider must return a "embedding"
    if (provider === undefined || provider == ".") {
      return {
        graph: palmBoard,
      };
    }
    return { path: provider };
  });

  const input = base.input({ $id: "input", schema: embeddingScheme });

  // Because `code` can't return a board, we have to create it here and then pass it in.
  const palmBoard = board(({ input }) => {
    const secrets = core.secrets({
      keys: ["PALM_KEY"],
    });
    return input.as("text").to(palm.embedText({ PALM_KEY: secrets }));
  }).serialize();

  const embedding = embeddingApi({
    palmBoard,
  });

  return input
    .to(embedding)
    .to(
      core.invoke({
        input: input.input,
      })
    )
    .embedding.to(base.output({ $id: "embedding_result" }));
}).serialize(metaData);
