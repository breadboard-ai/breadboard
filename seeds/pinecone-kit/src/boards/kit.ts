/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import pineconeAPIConfig from "./pinecone-api-config.js";
import pineconeAPIQuery from "./pinecone-api-query.js";
import pineconeAPIUpsert from "./pinecone-api-upsert.js";
import pineconeAPIVector from "./pinecone-api-vector.js";

const kit = new Board({
  title: "Pinecone API Node Kit",
  description:
    "This board is actually a kit: a collection of nodes for working with the Pinecone API.",
  version: "0.0.1",
});

kit.graphs = {
  "pinecone-api-config": pineconeAPIConfig,
  "pinecone-api-query": pineconeAPIQuery,
  "pinecone-api-upsert": pineconeAPIUpsert,
  "pinecone-api-vector": pineconeAPIVector,
};

kit.include("#pinecone-api-config", { $id: "config" });
kit.include("#pinecone-api-query", { $id: "query" });
kit.include("#pinecone-api-upsert", { $id: "upsert" });
kit.include("#pinecone-api-vector", { $id: "vector" });

export default kit;
