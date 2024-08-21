/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";

export default defineNodeType({
  name: "passthrough",
  metadata: {
    title: "Passthrough",
    description:
      "Takes all inputs and passes them through as outputs. Effectively, a no-op node in Breadboard.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-passthrough-component",
    },
  },
  inputs: {
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
      reflective: true,
    },
  },
  invoke: (_, inputs) => inputs,
});
