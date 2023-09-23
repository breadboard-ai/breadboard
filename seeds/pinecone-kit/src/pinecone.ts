/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeHandlersFromUrls, makeKit } from "./kit.js";

// TODO: Replace with a well-known published URL, like a CDN.
const KIT_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/pinecone-kit/graphs/";

const NAMESPACE = "pinecone-api-";

const nodes = ["config", "query", "upsert", "vector"] as const;

export const Pinecone = makeKit<(typeof nodes)[number]>(
  await makeHandlersFromUrls(nodes, KIT_URL, NAMESPACE),
  nodes,
  "npm:@google-labs/pinecone-kit",
  NAMESPACE
);
