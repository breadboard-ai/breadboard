/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { flow } from "../../new/lib.js";
import { core } from "../../new/kits.js";

export const graph = flow(
  (inputs) => {
    const p1 = core.passthrough(inputs);
    const { foo } = p1; // Get an output, as a Promise!
    return { foo };
  },
  { foo: "bar", bar: "baz" }
);

export default await graph.serialize({ title: "Simple graph" });
