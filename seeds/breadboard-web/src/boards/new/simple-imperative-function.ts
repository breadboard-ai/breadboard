/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { flow } from "../../new/lib.js";
import { core } from "../../new/kits.js";

export const graph = flow(
  async (inputs) => {
    const { foo } = await core.passthrough(inputs);
    return { foo };
  },
  { foo: "bar", baz: "bar" }
);

export default await graph.serialize({ title: "Simple imperative function" });
