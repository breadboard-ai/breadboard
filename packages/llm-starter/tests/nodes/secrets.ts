/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { secretsDescriber } from "../../src/nodes/secrets.js";

test("describer correctly responds to no inputs", async (t) => {
  t.like(await secretsDescriber(), {
    inputSchema: {
      properties: {
        keys: {
          type: "array",
        },
      },
    },
    outputSchema: {
      properties: {},
    },
  });
});

test("describer correctly responds to inputs", async (t) => {
  const inputs = {
    keys: ["SECRET1", "SECRET2"],
  };
  t.like(await secretsDescriber(inputs), {
    inputSchema: {
      properties: {
        keys: {
          type: "array",
        },
      },
    },
    outputSchema: {
      properties: {
        SECRET1: { title: "SECRET1" },
        SECRET2: { title: "SECRET2" },
      },
    },
  });
});

test("describer correctly responds to unknown inputs", async (t) => {
  const inputs = {
    foo: "bar",
  };
  t.like(await secretsDescriber(), {
    inputSchema: {
      properties: {
        keys: {
          type: "array",
        },
      },
    },
    outputSchema: {
      properties: {},
    },
  });
});
