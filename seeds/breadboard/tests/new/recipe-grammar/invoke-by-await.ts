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

test("directly await declarative recipe returning node, value assignment", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const foo = await graph({ foo: "bar" }).foo;
  t.is(foo, "bar");
});

test("directly await declarative recipe returning node, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ foo: inputs.foo });
  });
  const { foo } = await graph({ foo: "bar" });
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
  t.is(foo as unknown as string, "bar");
});

test("directly await declarative recipe, passing full inputs, value", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop(inputs);
  });
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz, "bar");
});

test("directly await declarative recipe, passing full inputs, deconstruct", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop(inputs);
  });
  const { baz } = await graph({ baz: "bar" });
  t.is(baz, "bar");
});

test("directly await declarative recipe, passing full inputs as spread", async (t) => {
  const graph = recipe(async (inputs) => {
    return testKit.noop({ ...inputs });
  });
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz, "bar");
});

test.skip("directly await declarative recipe, passing full inputs as spread, twice", async (t) => {
  const graph = recipe<{ [key: string]: string }>(async (inputs) => {
    const reverser = testKit.reverser({ ...inputs });
    return testKit.noop({ ...reverser });
  });
  t.log(await graph.serialize());
  const baz = await graph({ baz: "bar" }).baz;
  t.is(baz as unknown as string, "rab");
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
