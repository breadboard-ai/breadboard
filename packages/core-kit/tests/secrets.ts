/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import secrets from "../src/nodes/secrets.js";

test("describer correctly responds to no inputs", async (t) => {
  t.deepEqual(await secrets.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        keys: {
          title: "secrets",
          description: "The array of secrets to retrieve from the node.",
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["keys"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      additionalProperties: { type: "string" },
    },
  });
});

test("describer correctly responds to inputs", async (t) => {
  const inputs = {
    keys: ["SECRET1", "SECRET2"],
  };
  t.deepEqual(await secrets.describe(inputs), {
    inputSchema: {
      type: "object",
      properties: {
        keys: {
          title: "secrets",
          description: "The array of secrets to retrieve from the node.",
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["keys"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: {
        SECRET1: { title: "SECRET1", type: "string" },
        SECRET2: { title: "SECRET2", type: "string" },
      },
      additionalProperties: false,
    },
  });
});

test("describer correctly responds to unknown inputs", async (t) => {
  t.deepEqual(await secrets.describe(), {
    inputSchema: {
      type: "object",
      properties: {
        keys: {
          title: "secrets",
          description: "The array of secrets to retrieve from the node.",
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: ["keys"],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      additionalProperties: { type: "string" },
    },
  });
});
