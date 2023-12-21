/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { code } from "../../../src/index.js";

test("recipeAsCode works with sync arrow functions", async (t) => {
  const fn = await code(() => {
    return { value: 1 };
  })({}).serialize();
  t.like(fn, {
    graphs: {
      "fn-1": {
        nodes: [
          { type: "input" },
          {
            configuration: {
              code: `function fn_1() {
        return { value: 1 };
    }`,
            },
          },
        ],
      },
    },
  });
});

test("recipeAsCode works with async arrow functions", async (t) => {
  const fn = await code(async () => {
    return { value: 1 };
  })({}).serialize();
  t.like(fn, {
    graphs: {
      "fn-2": {
        nodes: [
          { type: "input" },
          {
            configuration: {
              code: `async function fn_2() {
        return { value: 1 };
    }`,
            },
          },
        ],
      },
    },
  });
});
