/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";
import {
  EmbedTextResponse,
  PalmModelMethod,
  palm,
} from "@google-labs/palm-lite";

import { CacheManager } from "../cache.js";

type EmbedStringInputs = {
  /**
   * Prompt for text completion.
   */
  text: string;
  /**
   * The Google Cloud Platform API key
   */
  API_KEY: string;
  /**
   * Cache to use for storing results. Optional.
   */
  cache?: CacheManager;
};

export default async (inputs: InputValues) => {
  const values = inputs as EmbedStringInputs;
  if (!values.API_KEY) throw new Error("Embedding requires `API_KEY` input");
  if (!values.text) throw new Error("Embedding requires `text` input");

  const cache = values.cache?.getCache({
    palm: palm(values.API_KEY).getModelId(PalmModelMethod.EmbedText),
  });

  const query = { text: values.text };

  if (cache) {
    const cachedEmbedding = await cache.get(query);
    if (cachedEmbedding) return { embedding: cachedEmbedding };
  }

  const request = palm(values.API_KEY).embedding(query);
  const data = await fetch(request);
  const response = (await data.json()) as EmbedTextResponse;
  const embedding = response?.embedding?.value;
  if (!embedding) throw new Error(`No embedding returned in ${response}`);

  cache?.set(query, embedding);

  return { embedding };
};
