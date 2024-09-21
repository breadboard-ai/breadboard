/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defineNodeType,
  enumeration,
  object,
  unsafeSchema,
} from "@breadboard-ai/build";
import { Schema } from "@google-labs/breadboard";

export const storeDataNode = defineNodeType({
  name: "storeData",
  metadata: {
    title: "Store Data",
    description: "Store a value for later use.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-store-data-component",
    },
    tags: ["experimental"],
  },
  inputs: {
    $schema: {
      type: object({}, "unknown"),
      title: "Schema",
      description: "The schema of the data to store.",
      behavior: ["ports-spec", "config"],
    },
    $scope: {
      type: enumeration("run", "session", "client"),
      description: "The scope to store the data in.",
      title: "Scope",
      behavior: ["config"],
      default: "session",
    },
    "*": {
      type: "unknown",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  invoke: async ({ $schema, $scope }, values, context) => {
    const store = context.store;
    if (!store) {
      throw new Error("Unable to store data: The data store not available.");
    }
    const properties = ($schema as Schema)?.properties;
    const entries = Object.entries(properties || {});
    if (!properties || entries.length === 0) {
      throw new Error(
        "Unable to store data: no properties were specified in Schema."
      );
    }
    for (const [key, propertySchema] of entries) {
      const value = values[key] as object | null;
      const result = await store.storeData(key, value, propertySchema, $scope);
      if (!result.success) {
        throw new Error(`Unable to store value "${key}": ${result.error}`);
      }
    }
    return values;
  },
  describe: async ({ $schema: schema }) => {
    const inputs = schema ? unsafeSchema(schema) : { "*": "unknown" };
    return { inputs, outputs: inputs };
  },
});
