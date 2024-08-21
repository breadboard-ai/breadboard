/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";

import kit from "./boards/kit.js";
import { asRuntimeKit } from "@google-labs/breadboard";
import TemplateKit from "@google-labs/template-kit";
import Core from "@google-labs/core-kit";

// TODO: Replace with a well-known published URL, like a CDN.
const KIT_BASE_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/pinecone-kit/graphs/kit.json";

const NAMESPACE = "pinecone-api-";

const KIT_PACKAGE_URL = "npm:@google-labs/pinecone-kit";

const adapter = await GraphToKitAdapter.create(kit, KIT_BASE_URL, [
  asRuntimeKit(TemplateKit),
  asRuntimeKit(Core),
]);

const builder = new KitBuilder(
  adapter.populateDescriptor({
    url: KIT_PACKAGE_URL,
    namespacePrefix: NAMESPACE,
  })
);

export const Pinecone = builder.build({
  config: adapter.handlerForNode("config"),
  query: adapter.handlerForNode("query"),
  upsert: adapter.handlerForNode("upsert"),
  vector: adapter.handlerForNode("vector"),
});
