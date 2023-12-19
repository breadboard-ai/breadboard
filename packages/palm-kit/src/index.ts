/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";

import generateText from "./nodes/generate-text.js";
import embedText from "./nodes/embed-text.js";

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

/**
 * This is a wrapper around existing kits for the new syntax to add types.
 *
 * This should transition to a codegen step, with typescript types constructed
 * from .describe() calls.
 */
import { addKit, NewNodeFactory as NodeFactory } from "@google-labs/breadboard";

export const palm = addKit(PaLMKit, "palm-") as unknown as {
  generateText: NodeFactory<
    { text: string; PALM_KEY: string },
    { completion: string }
  >;
};
