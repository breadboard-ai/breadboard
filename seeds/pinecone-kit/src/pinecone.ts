/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import kit from "./boards/kit.js";

// TODO: Replace with a well-known published URL, like a CDN.
const KIT_BASE_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/pinecone-kit/graphs/kit.json";

const NAMESPACE = "pinecone-api-";

const KIT_PACKAGE_URL = "npm:@google-labs/pinecone-kit";

const builder = new KitBuilder();
await builder.initialize({
  graph: kit,
  baseUrl: KIT_BASE_URL,
  packageUrl: KIT_PACKAGE_URL,
  namespacePrefix: NAMESPACE,
});
export const Pinecone = builder.build({
  config: builder.handlerForNode("config"),
  query: builder.handlerForNode("query"),
  upsert: builder.handlerForNode("upsert"),
  vector: builder.handlerForNode("vector"),
});
