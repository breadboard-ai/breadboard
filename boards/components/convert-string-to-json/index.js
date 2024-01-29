/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { base, board, code } from "@google-labs/breadboard";

const metaData = {
  title: "Convert String to JSON",
  description: "Converts a string to JSON.",
  version: "0.0.3",
};

const toJsonScheme = {
  type: "object",
  properties: {
    string: {
      type: "string",
      title: "string",
      description: "The string you will attempt to convert to JSON.",
    },
    splat: {
      type: "boolean",
      title: "splat",
      description: "If true, the output will be the properties of the object.",
      default: false,
    },
  },
  required: ["text"],
};

export default await board(() => {
  const input = base.input({ $id: "input", schema: toJsonScheme });

  // Note: `code` means an implicit `invoke` which means you have to add core-kit
  return input
    .to(
      code(({ string, splat }) => {
        const obj = JSON.parse(string);
        if (splat) {
          if (obj instanceof Array) {
            throw new Error("Cannot splat an array.");
          }
          return { ...obj };
        }
        return { json: obj };
      })()
    )
    .to(base.output({ $id: "json" }));
}).serialize(metaData);
