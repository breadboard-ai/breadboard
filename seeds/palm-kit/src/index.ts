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
});

export const PaLMKit = builder.build({
  /**
   * Places an `generateText` node on the board.
   *
   * Use this node to generate text from a prompt.
   *
   * See [`generateText` node
   * reference](https://github.com/google/labs-prototypes/blob/main/seeds/palm-kit/README.md) for more information.
   */
  generateText,
  /**
   * Places an `embedText` node on the board.
   *
   * Use this node to embed text.
   *
   * See [`embedText` node
   * reference](https://github.com/google/labs-prototypes/blob/main/seeds/palm-kit/README.md) for more information.
   */
  embedText,
});

export type PaLMKit = InstanceType<typeof PaLMKit>;

export default PaLMKit;
