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
  noop: async (inputs) => inputs,
  test: async (inputs) => inputs,
});
