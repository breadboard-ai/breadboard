/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { z } from "zod";

export const graph = recipe(
  {
    input: z.object({
      a: z.number().describe("A: One Number"),
      b: z.number().describe("B: Another number"),
    }),
    output: z.object({
      result: z.number().describe("Sum: The sum of two numbers"),
    }),
  },
  async (inputs) => {
    return recipe<{ a: number; b: number }, { result: number }>(
      async (inputs) => {
        const { a, b } = await inputs;
        return { result: (a || 0) + (b || 0) };
      }
    )({ a: inputs.a, b: inputs.b });
  }
);

export const example = { a: 1, b: 2 };

export default await graph.serialize({ title: "New: Custom inline action" });
