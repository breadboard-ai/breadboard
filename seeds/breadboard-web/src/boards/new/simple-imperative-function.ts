/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { action } from "../../new/lib.js";
import { core } from "../../new/kits.js";

export const graph = action(async (inputs) => {
  const { foo } = await core.passthrough(inputs);
  return { foo };
});

export const example = { foo: "bar", bar: "baz" };

export default await graph.serialize({
  title: "New: Simple imperative function",
});
