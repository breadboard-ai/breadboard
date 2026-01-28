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

  test("returns success when client returns finalOutputValues", async () => {
    const mockOutputValues = { foo: "bar" };
    const mockClient = {
      getFileMedia: async () => ({
        json: async () => ({ finalOutputValues: mockOutputValues }),
      }),
    };

    const result = await loadResults(
      "file-id-123",
      mockClient as never
    );

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.deepStrictEqual(result.finalOutputValues, mockOutputValues);
    }
  });

  test("returns no-results when finalOutputValues is missing", async () => {
    const mockClient = {
      getFileMedia: async () => ({
        json: async () => ({}),
      }),
    };

    const result = await loadResults(
      "file-id-123",
      mockClient as never
    );

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.reason, "no-results");
    }
  });

  test("returns load-failed when client throws", async () => {
    const mockClient = {
      getFileMedia: async () => {
        throw new Error("Network error");
      },
    };

    const result = await loadResults(
      "file-id-123",
      mockClient as never
    );

    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.strictEqual(result.reason, "load-failed");
    }
  });
});

