/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";

export const graph = recipe((inputs) => {
  return recipe<{ a: number; b: number }, { result: number }>(
    async (inputs) => {
      const { a, b } = await inputs;
      return { result: (a || 0) + (b || 0) };
    }
  )(inputs);
});

export const example = { a: 1, b: 2 };

export default await graph.serialize({ title: "New: Custom inline action" });
