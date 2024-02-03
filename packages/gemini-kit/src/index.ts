/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";
import { NewNodeFactory, NewNodeValue, addKit } from "@google-labs/breadboard";

import kit from "./kit.js";

// TODO: Replace with the actual URL.
const KIT_BASE_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/gemini-kit/graphs/kit.json";

const adapter = await GraphToKitAdapter.create(kit, KIT_BASE_URL, []);

const builder = new KitBuilder(
  adapter.populateDescriptor({
    url: "npm:@google-labs/gemini-kit",
    namespacePrefix: "gemini-api-",
  })
);

export const gemini = addKit(
  builder.build({
    text: adapter.handlerForNode("text"),
    vision: adapter.handlerForNode("vision"),
  })
) as unknown as {
  text: NewNodeFactory<{ text: string }, { text: string }>;
  vision: NewNodeFactory<{ parts: NewNodeValue }, { result: string }>;
};
