/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import { anyOf, board, defineNodeType, object } from "@breadboard-ai/build";
import { test } from "node:test";

test("board behavior", () => {
  const def = defineNodeType({
    name: "test",
    inputs: {
      board: {
        type: anyOf("string", object({}, "unknown")),
        behavior: ["board"],
      },
    },
    outputs: {},
    invoke: () => ({}),
  });

  def({ board: "local.bgl.json" });

  def({ board: board({ inputs: {}, outputs: {} }) });

  // @ts-expect-error
  def({ board: 123 });

  // @ts-expect-error
  def({ board: ["local.bgl.json"] });
});
