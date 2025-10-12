/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { evalSet } from "./eval-set";
import { runTest } from "./run-test";

const results = await Promise.all(evalSet.map((c) => runTest(c)));
for (const result of results) {
  for (const item of result.logs) {
    console.log(...item);
  }
}
