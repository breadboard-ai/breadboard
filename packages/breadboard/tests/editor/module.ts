/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { testEditGraph } from "./graph.js";

test("Can add modules", async (t) => {
  const graph = testEditGraph();
  const result = await graph.edit(
    [{ type: "addmodule", id: "mod1", module: { code: "Hello, World!" } }],
    "test"
  );

  t.truthy(result.success);
  const modules = graph.inspect().modules();
  t.is(Object.keys(modules).length, 1);
  t.deepEqual(modules["mod1"].code(), "Hello, World!");
});

test("Can change modules", async (t) => {
  const graph = testEditGraph();
  const addResult = await graph.edit(
    [{ type: "addmodule", id: "mod1", module: { code: "Hello, World!" } }],
    "add"
  );

  t.truthy(addResult.success);

  const changeResult = await graph.edit(
    [
      {
        type: "changemodule",
        id: "mod1",
        module: { code: "Hello, Updated World!" },
      },
    ],
    "change"
  );

  t.truthy(changeResult.success);
  const modules = graph.inspect().modules();
  t.is(Object.keys(modules).length, 1);
  t.deepEqual(modules["mod1"].code(), "Hello, Updated World!");
});

test("Can delete modules", async (t) => {
  const graph = testEditGraph();
  const addResult = await graph.edit(
    [{ type: "addmodule", id: "mod1", module: { code: "Hello, World!" } }],
    "add"
  );

  t.truthy(addResult.success);

  const removeResult = await graph.edit(
    [{ type: "removemodule", id: "mod1" }],
    "remove"
  );

  t.truthy(removeResult.success);

  const modules = graph.inspect().modules();
  t.is(Object.keys(modules).length, 0);
});
