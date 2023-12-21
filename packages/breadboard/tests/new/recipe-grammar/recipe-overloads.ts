/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { z } from "zod";

import { recipe, code } from "../../../src/new/recipe-grammar/recipe.js";

import { testKit } from "../../helpers/_test-kit.js";

test("zod + graph, w/ nested code recipe", async (t) => {
  const graph = recipe(
    {
      input: z.object({ foo: z.string() }),
      output: z.object({ foo: z.string() }),
    },
    (inputs) => {
      return code(({ foo }) => ({ foo: `${foo}!` }))(inputs);
    }
  );

  const result = await graph({ foo: "bar" });
  t.like(result, { foo: "bar!" });
});

test("recipe with its own inputs and outputs", async (t) => {
  const graph = recipe((_, base) => {
    base.input().foo.as("bar").to(base.output());
  });

  const serialized = await graph.serialize();

  t.like(serialized, {
    nodes: [{ type: "input" }, { type: "output" }],
  });

  const result = await graph({ foo: "success" });
  t.like(result, { bar: "success" });
});

test("recipe with multiple outputs", async (t) => {
  const graph2 = recipe<{ foo: string }>(({ foo }) => {
    const { bar } = testKit.noop({ bar: foo });
    const { baz } = testKit.reverser({ baz: foo });
    return [{ bar, baz }, { bar }];
  });

  const graph = recipe(({ foo }) => {
    const { bar } = testKit.noop({ bar: foo });
    const { baz } = testKit.noop({ baz: foo });
    return [{ bar }, { baz }];
  });

  const serialized = await graph.serialize();

  t.like(serialized.nodes.map((node) => node.type).sort(), [
    "input",
    "noop",
    "output",
    "output",
  ]);
});
