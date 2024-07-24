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
  nano: adapter.handlerForNode("nano"),
});

export type GeminiKit = InstanceType<typeof GeminiKit>;

export type GeminiKitType = {
  /**
   * Creates a node that calls the `Gemini Pro` model to generate a response.
   */
  text: NewNodeFactory<
    {
      /**
       * The input text that will be used to generate the response.
       */
      text: NewNodeValue;
    },
    {
      /**
       * The generated response from the `Gemini Pro` model.
       */
      text: NewNodeValue;
    }
  >;
};

export default GeminiKit;

/**
 * The Gemini Kit. Use members of this object to create nodes to interact with
 * the Gemini language model. Currently, the two members are `text` and `vision`.
 * The `text` member is used to generate text from the Gemini Pro model, and the
 * `vision` member is used to generate a response from the Gemini Pro Vision
 * model.
 */
export const gemini = addKit(GeminiKit) as unknown as GeminiKitType;

export { default as geminiText } from "./components/gemini-generator.js";
