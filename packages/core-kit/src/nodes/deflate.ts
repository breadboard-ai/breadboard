/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, object } from "@breadboard-ai/build";
import { NodeHandlerContext, deflateData } from "@google-labs/breadboard";

export default defineNodeType({
  name: "deflate",
  metadata: {
    title: "Deflate",
    description:
      "Converts all inline data to stored data, saving memory. Useful when working with multimodal content. Safely passes data through if it's already stored or no inline data is present.",
  },
  inputs: {
    data: {
      type: object({}),
      description: "Data to deflate.",
    },
  },
  outputs: {
    data: {
      type: object({}),
      description: "Deflated data.",
    },
  },
  invoke: async ({ data }, _, { store }: NodeHandlerContext) => {
    if (!store) {
      throw new Error(
        "Data store was not specified in run configuration, but is required for deflation."
      );
    }
    return { data: await deflateData(store, data) };
  },
});
