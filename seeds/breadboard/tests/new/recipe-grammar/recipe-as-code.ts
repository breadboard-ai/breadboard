/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { recipeAsCode } from "../../../src/index.js";

test("recipeAsCode works with sync arrow functions", async (t) => {
  const code = await recipeAsCode(() => {
    return { value: 1 };
  })({}).serialize();
  t.like(code, {
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
  const code = await recipeAsCode(async () => {
    return { value: 1 };
  })({}).serialize();
  t.like(code, {
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
