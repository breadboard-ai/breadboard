/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "../../src/kit.js";
/**
 * This is a Kit designed specifically for use in the testing harness.
 */
export const TestKit = new KitBuilder({
  url: "npm:test-kit",
}).build({
  /**
   * Just a no-op node.
   * @param inputs Any inputs to the node.
   * @returns Sme inputs
   */
  noop: async (inputs) => inputs,
  /**
   * Just a no-op node, called "test, for when need two noop nodes with
   * different names.
   * @param inputs Any inputs to the node.
   * @returns Sme inputs
   */ test: async (inputs) => inputs,
});
