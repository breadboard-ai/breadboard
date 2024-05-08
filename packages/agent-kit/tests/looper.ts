/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";
import { planReaderFunction } from "../src/boards/looper.js";
import { throws } from "node:assert";

describe("planReader", () => {
  test("throws when no plan is supplied", () => {
    throws(() => {
      planReaderFunction({});
    });
  });
});
