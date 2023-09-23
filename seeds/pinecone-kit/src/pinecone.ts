/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeHandlersFromUrls, makeKit } from "./kit.js";

// TODO: Replace with a well-known published URL, like a CDN.
const KIT_BASE_URL =
  "https://raw.githubusercontent.com/google/labs-prototypes/main/seeds/pinecone-kit/graphs/";

const NAMESPACE = "pinecone-api-";

const NODES = ["config", "query", "upsert", "vector"] as const;

const KIT_PACKAGE_URL = "npm:@google-labs/pinecone-kit";

export const Pinecone = makeKit<typeof NODES>(
  await makeHandlersFromUrls(NODES, KIT_BASE_URL, NAMESPACE),
  NODES,
  KIT_PACKAGE_URL,
  NAMESPACE
);
