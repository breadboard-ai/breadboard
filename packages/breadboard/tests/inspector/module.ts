/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { inspector } from "../helpers/_inspector.js";

test("inspectableModule correctly returns modules", (t) => {
  const modules = {
    foo: {
      metadata: {},
      code: 'console.log("Hello, World")',
    },
  };
  const graph = {
    nodes: [],
    edges: [],
    modules,
  };
  const inspectable = inspector(graph);
  t.deepEqual(inspectable.modules()?.foo.code(), modules.foo.code);
  t.deepEqual(inspectable.modules()?.foo.metadata(), modules.foo.metadata);
});

test("inspectableModule correctly returns empty modules when not populated", (t) => {
  const graph = {
    nodes: [],
    edges: [],
  };
  const inspectable = inspector(graph);
  t.deepEqual(inspectable.modules(), {});
});

test("InspectableModule instances are stable within InspectableGraph", (t) => {
  const modules = {
    foo: {
      metadata: {},
      code: 'console.log("Hello, World")',
    },
  };

  const graph = {
    nodes: [],
    edges: [],
    modules,
  };

  const inspectable = inspector(graph);
  t.assert(inspectable.moduleById("foo") === inspectable.moduleById("foo"));
});

test("returns undefined for non-existent modules", (t) => {
  const graph = {
    nodes: [],
    edges: [],
    modules: {},
  };

  const inspectable = inspector(graph);
  t.is(inspectable.moduleById("foo"), undefined);
});
