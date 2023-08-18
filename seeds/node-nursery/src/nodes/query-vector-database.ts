/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Capability,
  InputValues,
  OutputValues,
} from "@google-labs/graph-runner";

import { VectorDocument, VectorDatabase } from "../vector-database.js";

export default async (inputs: InputValues): Promise<OutputValues> => {
  const db = inputs["db"] as VectorDatabase;
  const embedding = inputs["embedding"] as VectorDocument["embedding"];
  const topK = inputs["topK"] as number;

  if (!db) throw new Error("No vector database provided");
  if (!embedding) throw new Error("No embedding provided");

  const results = (await db.findNearest(embedding, topK)) as Capability[];

  return { results } as OutputValues;
};
