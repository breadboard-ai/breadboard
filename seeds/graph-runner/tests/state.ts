/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { peek } from "../src/traversal/state.js";

test("peek correctly peeks", (t) => {
  {
    const map = new Map();
    t.deepEqual(peek(map), new Map());
  }

  {
    const map = undefined;
    t.deepEqual(peek(map), new Map());
  }

  {
    const map = new Map();
    map.set("a", []);
    t.deepEqual(peek(map), new Map());
  }

  {
    const map = new Map();
    map.set("a", [{ a: 1 }, { b: 2 }]);
    map.set("b", [{ c: 3 }]);
    map.set("c", [{ d: 4 }, { e: 5 }]);
    t.deepEqual(
      peek(map),
      new Map([
        ["a", { a: 1 }],
        ["b", { c: 3 }],
        ["c", { d: 4 }],
      ])
    );
  }
});
