/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { action, flow } from "../../new/lib.js";

export const graph = action((inputs) => {
  return flow(async (inputs) => {
    const { a, b } = await inputs;
    return { result: ((a as number) || 0) + ((b as number) || 0) };
  }, inputs);
});

export const example = { a: 1, b: 2 };

export default await graph.serialize({ title: "New: Custom inline action" });
