/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, object } from "@breadboard-ai/build";
import { NodeHandlerContext, inflateData } from "@google-labs/breadboard";

export default defineNodeType({
  name: "inflate",
  metadata: {
    title: "Inflate",
    description: "Converts stored data to base64.",
  },
  inputs: {
    data: {
      type: object({}),
      description: "Data to inflate.",
    },
  },
  outputs: {
    data: {
      type: object({}),
      description: "inflated data.",
    },
  },
  invoke: async ({ data }, _, { store }: NodeHandlerContext) => {
    if (!store) {
      throw new Error(
        "Data store was not specified in run configuration, but is required for inflation."
      );
    }
    return { data: await inflateData(store, data) };
  },
});
