/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { EdgeQueuer, peek } from "../src/traversal/state.js";

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

test("EdgeQueuer correctly manages state", (t) => {
  const manager = new EdgeQueuer(new Map());
  manager.push({ from: "a", to: "b" }, { a: 1 });
  t.deepEqual(manager.map, new Map([["b", new Map([["a", [{ a: 1 }]]])]]));
  manager.push({ from: "a", to: "b" }, { b: 2 });
  t.deepEqual(
    manager.map,
    new Map([["b", new Map([["a", [{ a: 1 }, { b: 2 }]]])]])
  );
  manager.push({ from: "b", to: "c" }, { b: 3 });
  t.deepEqual(
    manager.map,
    new Map([
      ["b", new Map([["a", [{ a: 1 }, { b: 2 }]]])],
      ["c", new Map([["b", [{ b: 3 }]]])],
    ])
  );
  manager.push({ from: "b", to: "c" }, undefined);
  t.deepEqual(
    manager.map,
    new Map([
      ["b", new Map([["a", [{ a: 1 }, { b: 2 }]]])],
      ["c", new Map([["b", [{ b: 3 }]]])],
    ])
  );
  manager.shift("b");
  t.deepEqual(
    manager.map,
    new Map([
      ["b", new Map([["a", [{ b: 2 }]]])],
      ["c", new Map([["b", [{ b: 3 }]]])],
    ])
  );
  manager.shift("c");
  t.deepEqual(
    manager.map,
    new Map([
      ["b", new Map([["a", [{ b: 2 }]]])],
      ["c", new Map([["b", []]])],
    ])
  );
  manager.shift("c");
  t.deepEqual(
    manager.map,
    new Map([
      ["b", new Map([["a", [{ b: 2 }]]])],
      ["c", new Map([["b", []]])],
    ])
  );
  manager.shift("b");
  t.deepEqual(
    manager.map,
    new Map([
      ["b", new Map([["a", []]])],
      ["c", new Map([["b", []]])],
    ])
  );
});
