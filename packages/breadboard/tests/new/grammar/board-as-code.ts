/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { code } from "../../../src/index.js";

test("`code` works with sync arrow functions", async (t) => {
  const fn = await code(() => {
    return { value: 1 };
  })({ $id: "fn" }).serialize();
  t.like(fn, {
    nodes: [
      {
        type: "runJavascript",
        configuration: {
          code: `function fn() {
        return { value: 1 };
    }`,
        },
      },
    ],
  });
});

test("`code` works with async arrow functions", async (t) => {
  const fn = await code(async () => {
    return { value: 1 };
  })({ $id: "fn" }).serialize();
  t.like(fn, {
    nodes: [
      {
        type: "runJavascript",
        configuration: {
          code: `async function fn() {
        return { value: 1 };
    }`,
        },
      },
    ],
  });
});
