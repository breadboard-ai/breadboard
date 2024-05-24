/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { NodeFactoryFromDefinition } from "@breadboard-ai/build";
import { addKit } from "@google-labs/breadboard";
import { KitBuilder } from "@google-labs/breadboard/kits";
import generateText from "./nodes/generate-text.js";
import embedText from "./nodes/embed-text.js";
export { default as embedText } from "./nodes/embed-text.js";
export { default as generateText } from "./nodes/generate-text.js";

const builder = new KitBuilder({
  title: "PaLM Kit",
  description: "A Breadboard Kit with nodes to access PaLM APIs.",
  url: "npm:@google-labs/palm-kit",
  namespacePrefix: "palm-",
});

export const PaLMKit = builder.build({
  /**
   * Places an `generateText` node on the board.
   *
   * Use this node to generate text from a prompt.
   *
   * See [`generateText` node
   * reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/palm-kit/README.md) for more information.
   */
  generateText,
  /**
   * Places an `embedText` node on the board.
   *
   * Use this node to embed text.
   *
   * See [`embedText` node
   * reference](https://github.com/breadboard-ai/breadboard/blob/main/packages/palm-kit/README.md) for more information.
   */
  embedText,
});

export type PaLMKit = InstanceType<typeof PaLMKit>;

export default PaLMKit;

export type PaLMKitType = {
  generateText: NodeFactoryFromDefinition<typeof generateText>;
  embedText: NodeFactoryFromDefinition<typeof embedText>;
};

/**
 * The PaLM Kit. Use members of this object to create nodes for using the PaLM API.
 *
 * There are currently two members: `generateText` and `embedText`.
 *
 * The `generateText` creates nodes for generating text from a prompt and
 * The `urlTemplate` creates nodes for embedding text.
 */
export const palm = addKit(PaLMKit) as PaLMKitType;
