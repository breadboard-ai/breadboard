/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { z } from "zod";

import { board, code } from "../../../src/new/grammar/board.js";

test("zod + graph, w/ nested code board", async (t) => {
  const graph = board(
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

test("board with its own inputs and outputs", async (t) => {
  const graph = board((_, base) => {
    base.input().foo.as("bar").to(base.output());
  });

  const serialized = await graph.serialize();

  t.like(serialized, {
    nodes: [{ type: "input" }, { type: "output" }],
  });

  const result = await graph({ foo: "success" });
  t.like(result, { bar: "success" });
});
