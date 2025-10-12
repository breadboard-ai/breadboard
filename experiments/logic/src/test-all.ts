/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { evalSet } from "./eval-set";
import { runTest } from "./run-test";

await Promise.all(
  evalSet.map(async (c) => {
    const result = await runTest(c);
    for (const item of result.logs) {
      console.log(...item);
    }
  })
);
