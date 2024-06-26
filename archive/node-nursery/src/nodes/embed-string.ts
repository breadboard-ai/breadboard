/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/breadboard";
import {
  EmbedTextResponse,
  PalmModelMethod,
  palm,
} from "@google-labs/palm-lite";

import { CacheManager } from "../cache.js";

type EmbedStringInputs = NodeValue & {
  /**
   * Prompt for text completion.
   */
  text: string;
  /**
   * The Google Cloud Platform API key
   */
  PALM_KEY: string;
  /**
   * Cache to use for storing results. Optional.
   */
  cache?: CacheManager;
};

export default async (inputs: InputValues): Promise<OutputValues> => {
  const values = inputs as EmbedStringInputs;
  if (!values.PALM_KEY) throw new Error("Embedding requires `PALM_KEY` input");
  if (!values.text) throw new Error("Embedding requires `text` input");

  const cache = values.cache?.getCache({
    palm: palm(values.PALM_KEY).getModelId(PalmModelMethod.EmbedText),
  });

  const query = { text: values.text };
  if (cache) {
    const cachedEmbedding = await cache.get(query);
    if (cachedEmbedding)
      return { embedding: cachedEmbedding } as unknown as OutputValues;
  }

  let embedding: number[] | undefined;
  // Because Embedding API is a bit flaky, we try a few times before giving up.
  let tries = 3;
  while (!embedding && tries-- > 0) {
    try {
      const request = palm(values.PALM_KEY).embedding(query);
      const data = await fetch(request);
      const response = (await data.json()) as EmbedTextResponse;
      embedding = response?.embedding?.value;
    } catch (e) {
      // TODO: Implement proper error handling.
    }
  }
  if (!embedding) throw new Error(`No embedding returned for "${values.text}"`);

  cache?.set(query, embedding);

  return { embedding } as unknown as OutputValues;
};
