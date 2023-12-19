/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { result } from "../src/board.js";

test(`emits the hello world message`, async (t) => {
  t.deepEqual(result, { hear: "Hello, world?" });
});
