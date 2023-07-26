/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues } from "@google-labs/graph-runner";

import { VectorDocument, VectorDatabase } from "../vector-database.js";

export default async (inputs: InputValues) => {
  const db = inputs["db"] as VectorDatabase;
  const documents = inputs["documents"] as VectorDocument[];

  if (!db) throw new Error("No vector database provided");
  if (!documents) throw new Error("No documents provided");

  await db.add(documents);

  return { db: db };
};
