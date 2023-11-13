/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { flow } from "../../new/lib.js";

export const graph = flow(
  (inputs) => {
    return flow(async (inputs) => {
      const { a, b } = await inputs;
      return { result: ((a as number) || 0) + ((b as number) || 0) };
    }, inputs);
  },
  { a: 1, b: 2 }
);

export default await graph.serialize({ title: "Custom inline action" });
