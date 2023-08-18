/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InputValues, OutputValues } from "@google-labs/graph-runner";

import { MemoryVectorDatabase } from "../vector-database.js";

export default async (inputs: InputValues): Promise<OutputValues> => {
  switch (inputs["type"] ?? "memory") {
    case "memory":
      return { db: new MemoryVectorDatabase(inputs["similarity"] as string) };
    case "pinecone":
      throw new Error("Pinecone not yet supported");
    default:
      throw new Error(`Unknown vector database type: ${inputs["type"]}`);
  }
};
