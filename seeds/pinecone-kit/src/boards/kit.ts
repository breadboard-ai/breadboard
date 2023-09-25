/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";

import pineconeAPIConfig from "./config.js";
import pineconeAPIQuery from "./query.js";
import pineconeAPIUpsert from "./upsert.js";
import pineconeAPIVector from "./vector.js";

const kit = new Board({
  title: "Pinecone API Node Kit",
  description:
    "This board is actually a kit: a collection of nodes for working with the Pinecone API.",
  version: "0.0.1",
});

kit.graphs = {
  config: pineconeAPIConfig,
  query: pineconeAPIQuery,
  upsert: pineconeAPIUpsert,
  vector: pineconeAPIVector,
};

kit.include("#config", { $id: "config" });
kit.include("#query", { $id: "query" });
kit.include("#upsert", { $id: "upsert" });
kit.include("#vector", { $id: "vector" });

export default kit;
