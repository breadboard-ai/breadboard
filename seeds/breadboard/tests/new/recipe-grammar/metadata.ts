/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { recipe } from "../../../src/new/recipe-grammar/recipe.js";

import { testKit } from "../../helpers/_test-kit.js";

test("metadata in recipe constructor", async (t) => {
  const graph = recipe(
    { url: "data:", title: "test", description: "test test", version: "0.0.1" },
    async (inputs) => testKit.noop(inputs)
  );

  const serialized = await graph.serialize();

  t.like(serialized, {
    url: "data:",
    title: "test",
    description: "test test",
    version: "0.0.1",
  });
});

test("metadata in serialize", async (t) => {
  const graph = recipe(async (inputs) => testKit.noop(inputs));

  const serialized = await graph.serialize({
    url: "data:",
    title: "test",
    description: "test test",
    version: "0.0.1",
  });

  t.like(serialized, {
    url: "data:",
    title: "test",
    description: "test test",
    version: "0.0.1",
  });
});

test("metadata in serialize overrides metadata in constructor", async (t) => {
  const graph = recipe(
    { title: "constructor", description: "test test" },
    async (inputs) => testKit.noop(inputs)
  );

  const serialized = await graph.serialize({
    url: "data:",
    title: "serialized",
  });

  t.like(serialized, {
    url: "data:",
    title: "serialized",
    description: "test test",
  });
});
