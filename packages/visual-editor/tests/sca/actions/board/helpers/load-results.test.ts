/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { loadResults } from "../../../../../src/sca/actions/board/helpers/load-results.js";

suite("load-results helpers", () => {
  test("returns error when no client provided", async () => {
    const result = await loadResults("file-id-123", undefined);

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.reason, "no-client");
    }
  });

  // Note: Testing with a real GoogleDriveClient would require mocking
  // the fetch calls. These tests cover the guard conditions.
});
