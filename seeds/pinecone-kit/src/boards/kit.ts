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

kit.include(pineconeAPIConfig, { $id: "config" });
kit.include(pineconeAPIQuery, { $id: "query" });
kit.include(pineconeAPIUpsert, { $id: "upsert" });
kit.include(pineconeAPIVector, { $id: "vector" });

export default kit;
