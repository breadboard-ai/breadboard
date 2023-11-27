/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { recipe } from "@google-labs/breadboard";
import { core } from "../../new/kits.js";

export const graph = recipe((inputs) => {
  const p1 = core.passthrough(inputs);
  const { foo } = p1; // Get an output, as a Promise!
  return { foo };
});

export const example = { foo: "bar", bar: "baz" };

export default await graph.serialize({ title: "New: Simple graph" });
