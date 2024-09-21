/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNodeType, object, unsafeSchema } from "@breadboard-ai/build";
import { Schema } from "@google-labs/breadboard";

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
    schema: {
      type: object({}, "unknown"),
      title: "Schema",
      description: "The schema of the data to retrieve.",
      behavior: ["ports-spec", "config"],
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
    $notFound: {
      type: object({}, "unknown"),
      title: "Not Found",
      description: "The schema of keys that were not found.",
    },
  },
  invoke: async ({ schema }, _, context) => {
    const store = context.store;
    if (!store) {
      throw new Error("Unable to retrieve data: The data store not available.");
    }
    const properties = (schema as Schema)?.properties;
    if (!properties) {
      throw new Error("Unable to store data: Schema is missing properties.");
    }
    const keys = Object.keys(properties);
    if (keys.length === 0) {
      throw new Error("Unable to store data: Schema has no properties.");
    }
    const notFound: [property: string, schema: Schema][] = [];
    const values: Record<string, object | null> = {};
    for (const key of keys) {
      const result = await store.retrieveData(key);
      if (!result.success) {
        notFound.push([key, properties[key]]);
      } else {
        // TODO: Implement schema comparison.
        values[key] = result.value;
      }
    }

    if (notFound.length > 0) {
      console.log("Not found", notFound);
      return {
        $notFound: {
          properties: Object.fromEntries(notFound),
          type: "object",
          required: notFound.map(([key]) => key),
        },
        ...values,
      };
    }
    console.log("All found", values);
    return values;
  },
  describe: async ({ schema }) => {
    const outputs = schema ? unsafeSchema(schema) : { "*": "unknown" };
    return {
      outputs,
    };
  },
});
