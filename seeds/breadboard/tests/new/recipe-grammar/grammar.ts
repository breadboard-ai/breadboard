/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { recipe } from "../../../src/new/recipe-grammar/recipe.js";
import { testKit } from "../../helpers/_test-kit.js";

test("directly await a node", async (t) => {
  const { foo } = await testKit.noop({ foo: "bar" });
  t.is(foo, "bar");
});

test("directly await a value", async (t) => {
  const foo = await testKit.noop({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await declarative recipe, value assignment", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await declarative recipe, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const { foo } = await graph({ foo: "bar" });
  t.log(await graph.serialize());
  t.is(foo as unknown as string, "bar");
});

test("directly await imperative recipe, value assignment", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = await testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await imperative recipe, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    const { foo } = await testKit.noop({ foo: inputs.foo });
    return { foo };
  });
  const { foo } = await graph({ foo: "bar" });
  t.is(foo, "bar");
});
