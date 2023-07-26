/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";
import { EmbedTextResponse, palm } from "@google-labs/palm-lite";

import jsonata from "jsonata";

import type { VectorDocument } from "../vector-database.js";

type EmbedStringInputs = {
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
  API_KEY: string;
};

export default async (inputs: InputValues) => {
  const values = inputs as EmbedStringInputs;
  if (!values.API_KEY) throw new Error("Embedding requires `API_KEY` input");
  if (!values.documents)
    throw new Error("Embedding requires `documents` input");

  const expression = jsonata(values.expression ?? "text");

  const results = values.documents.map(async (doc) => {
    const text = await expression.evaluate(doc);
    const request = palm(values.API_KEY).embedding({ text });
    const data = await fetch(request);
    const response = (await data.json()) as EmbedTextResponse;
    const embedding = response?.embedding?.value;

    if (!embedding) throw new Error(`No embedding returned in ${response}`);

    const result = { ...doc } as VectorDocument;
    result.embedding = embedding;
    return result;
  });

  return { documents: await Promise.all(results) };
};
