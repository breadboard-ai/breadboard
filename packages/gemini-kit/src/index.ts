/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";

import kit from "./kit.js";
import { NewNodeFactory, NewNodeValue, addKit } from "@google-labs/breadboard";

// TODO: Replace with the actual URL.
const KIT_BASE_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/gemini-kit/graphs/kit.json";

const adapter = await GraphToKitAdapter.create(kit, KIT_BASE_URL, []);

const builder = new KitBuilder(
  adapter.populateDescriptor({
    url: "npm:@google-labs/gemini-kit",
    // TODO: This currently doesn't work, because "addKit" below translates
    // handler id directly into the node name. We need to make it work without
    // prefix.
    // namespacePrefix: "gemini-api-",
  })
);

const GeminiKit = builder.build({
  text: adapter.handlerForNode("text"),
  vision: adapter.handlerForNode("vision"),
});

export type GeminiKit = InstanceType<typeof GeminiKit>;

export default GeminiKit;
export const gemini = addKit(GeminiKit) as unknown as {
  text: NewNodeFactory<{ text: string }, { text: string }>;
  vision: NewNodeFactory<{ parts: NewNodeValue[] }, { result: string }>;
};
