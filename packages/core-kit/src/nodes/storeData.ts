/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, enumeration, object } from "@breadboard-ai/build";

export const storeDataNode = defineNodeType({
  name: "storeData",
  metadata: {
    title: "Store Data",
    description: "Store a value for later use.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-store-data-component",
    },
  },
  inputs: {
    key: {
      type: "string",
      description: "The key to store the value under.",
      title: "Key",
      behavior: ["config"],
    },
    scope: {
      type: enumeration("run", "session", "client"),
      description: "The scope to store the data in.",
      title: "Scope",
      behavior: ["config"],
    },
    value: {
      type: object({}, "unknown"),
      title: "Value",
      description: "The value to store.",
    },
  },
  outputs: {
    value: {
      type: object({}, "unknown"),
      title: "Value",
      description: "The stored value.",
    },
  },
  invoke: async ({ key, value }, _, context) => {
    const store = context.store;
    if (!store) {
      throw new Error("Unable to store data: The data store not available.");
    }
    await store.storeData(key, value);
    return {
      value,
    };
  },
});
