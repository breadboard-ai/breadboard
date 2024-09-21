/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType } from "@breadboard-ai/build";

export const retrieveDataNode = defineNodeType({
  name: "retrieveData",
  metadata: {
    title: "Retrieve Data",
    description: "Retrieve a value that was previously stored.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-retrieve-data-component",
    },
  },
  inputs: {
    key: {
      type: "string",
      description: "The key to retrieve the value for.",
      behavior: ["config"],
    },
  },
  outputs: {
    value: {
      type: "unknown",
      description: "The stored value.",
      title: "Value",
    },
    notFound: {
      type: "string",
      title: "Not Found",
      description: "The key is routed here when the value is not found.",
    },
  },
  invoke: async ({ key }, _, context) => {
    const store = context.store;
    if (!store) {
      throw new Error("Unable to retrieve data: The data store not available.");
    }
    const result = await store.retrieveData(key);
    if (!result.success) {
      return {
        notFound: key,
      };
    }
    return {
      value: result.value,
    };
  },
});
