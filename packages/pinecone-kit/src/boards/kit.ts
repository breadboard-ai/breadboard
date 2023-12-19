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
import { Core } from "@google-labs/core-kit";

const kit = new Board({
  title: "Pinecone API Node Kit",
  description:
    "This board is actually a kit: a collection of nodes for working with the Pinecone API.",
  version: "0.0.1",
});
const core = kit.addKit(Core);

kit.graphs = {
  config: pineconeAPIConfig,
  query: pineconeAPIQuery,
  upsert: pineconeAPIUpsert,
  vector: pineconeAPIVector,
};

core.include({ $id: "config", $ref: "#config" });
core.include({ $id: "query", $ref: "#query" });
core.include({ $id: "upsert", $ref: "#upsert" });
core.include({ $id: "vector", $ref: "#vector" });

export default kit;
