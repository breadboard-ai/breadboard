/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { board, serialize } from "@breadboard-ai/build";
import secrets, { secret } from "../src/nodes/secrets.js";

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
      properties: {},
      required: [],
      additionalProperties: false,
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
      required: [],
      additionalProperties: false,
    },
  });
});

test("secret utility serialization", async (t) => {
  const foo = secret("SUPER");
  const bgl = serialize(board({ inputs: {}, outputs: { foo } }));
  t.deepEqual(bgl, {
    edges: [
      {
        from: "SUPER-secret",
        to: "output-0",
        out: "SUPER",
        in: "foo",
      },
    ],
    nodes: [
      {
        id: "output-0",
        type: "output",
        configuration: {
          schema: {
            properties: {
              foo: {
                type: "string",
              },
            },
            required: ["foo"],
            type: "object",
          },
        },
      },
      {
        id: "SUPER-secret",
        type: "secrets",
        configuration: {
          keys: ["SUPER"],
        },
      },
    ],
  });
});
