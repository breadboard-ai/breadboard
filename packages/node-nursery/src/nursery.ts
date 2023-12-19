/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import textAsset from "./nodes/text-asset.js";
import textAssetsFromPath from "./nodes/text-assets-from-path.js";
import createVectorDatabase from "./nodes/create-vector-database.js";
import addToVectorDatabase from "./nodes/add-to-vector-database.js";
import queryVectorDatabase from "./nodes/query-vector-database.js";
import embedDocs from "./nodes/embed-docs.js";
import embedString from "./nodes/embed-string.js";
import cache from "./nodes/cache.js";
import templateParser from "./nodes/template-parser.js";
import chunker from "./nodes/chunker.js";

export const Nursery = new KitBuilder({
  title: "Node Nursery Kit",
  description: "A nursery for nodes that are not yet ready for the world",
  version: "0.0.1",
  url: "npm:@google-labs/node-nursery",
}).build({
  createVectorDatabase,
  addToVectorDatabase,
  queryVectorDatabase,
  embedDocs,
  embedString,
  cache,
  textAsset,
  textAssetsFromPath,
  templateParser,
  chunker,
});
