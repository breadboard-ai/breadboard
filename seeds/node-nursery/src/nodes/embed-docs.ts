/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeValue,
  OutputValues,
} from "@google-labs/graph-runner";
import {
  EmbedTextResponse,
  PalmModelMethod,
  palm,
} from "@google-labs/palm-lite";

import jsonata from "jsonata";

import type { VectorDocument } from "../vector-database.js";
import { CacheManager } from "../cache.js";

type EmbedStringInputs = NodeValue & {
  /**
   * Documents to embed.
   * Returns that last as "documents", with an "embedding" property added.
   */
  documents: object[];
  /**
   * JSONATA expression to extract text from documents.
   * Defaults to `text`, i.e. defaults to documents being [{ text: "..."}].
   */
  expression: string;
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
  if (!values.documents)
    throw new Error("Embedding requires `documents` input");

  const expression = jsonata(values.expression ?? "text");
  const cache = values.cache?.getCache({
    palm: palm(values.PALM_KEY).getModelId(PalmModelMethod.EmbedText),
  });

  const results = values.documents.map(async (doc) => {
    const text = await expression.evaluate(doc);
    const query = { text };

    let embedding = (await cache?.get(query)) as
      | VectorDocument["embedding"]
      | undefined;

    if (!embedding) {
      const request = palm(values.PALM_KEY).embedding(query);
      const data = await fetch(request);
      const response = (await data.json()) as EmbedTextResponse;
      embedding = response?.embedding?.value;

      if (!embedding) throw new Error(`No embedding returned in ${response}`);

      cache?.set(query, embedding);
    }

    const result = { ...doc } as VectorDocument;
    result.embedding = embedding;
    return result;
  });

  return { documents: await Promise.all(results) };
};
