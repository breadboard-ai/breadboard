/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepEqual, equal } from "node:assert";
import { suite, test } from "node:test";
import {
  diffAssetReadPermissions,
  truncateValueForUtf8,
} from "../../src/board-server/utils.js";

suite("truncateValueForUtf8", () => {
  test("truncates if needed", () => {
    equal(truncateValueForUtf8("key", "", 4), "");
    equal(truncateValueForUtf8("key", "value", 7), "valu");
    equal(truncateValueForUtf8("key", "value", 5), "va");
    equal(truncateValueForUtf8("key", "value", 8), "value");
    // "Ї" needs 2 bytes.
    equal(truncateValueForUtf8("key", "aЇa", 6), "aЇ");
    equal(truncateValueForUtf8("key", "aࠉa", 6), "a");
    equal(truncateValueForUtf8("key", "aЇa", 7), "aЇa");
    equal(truncateValueForUtf8("key", "aЇa", 8), "aЇa");
    // "ࠉ" needs 3 bytes.
    equal(truncateValueForUtf8("key", "aࠉa", 9), "aࠉa");
    equal(truncateValueForUtf8("key", "aࠉa", 10), "aࠉa");
  });
});

suite("stringifyPermissionIgnoringRole", () => {
  test("both empty", () =>
    deepEqual(diffAssetReadPermissions({ actual: [], expected: [] }), {
      missing: [],
      excess: [],
    }));

  test("no change", () =>
    deepEqual(
      diffAssetReadPermissions({
        actual: [
          { type: "anyone" },
          { type: "domain", domain: "good.example.com" },
          { type: "user", emailAddress: "good@example.com" },
        ],
        expected: [
          { type: "anyone" },
          { type: "domain", domain: "good.example.com" },
          { type: "user", emailAddress: "good@example.com" },
        ],
      }),
      {
        missing: [],
        excess: [],
      }
    ));

  test("zero to anyone", () =>
    deepEqual(
      diffAssetReadPermissions({
        actual: [],
        expected: [{ type: "anyone" }],
      }),
      {
        missing: [{ type: "anyone" }],
        excess: [],
      }
    ));

  test("changed domain", () =>
    deepEqual(
      diffAssetReadPermissions({
        actual: [{ type: "domain", domain: "bad.example.com" }],
        expected: [{ type: "domain", domain: "good.example.com" }],
      }),
      {
        missing: [{ type: "domain", domain: "good.example.com" }],
        excess: [{ type: "domain", domain: "bad.example.com" }],
      }
    ));

  test("changed user", () =>
    deepEqual(
      diffAssetReadPermissions({
        actual: [{ type: "user", emailAddress: "bad@example.com" }],
        expected: [{ type: "user", emailAddress: "good@example.com" }],
      }),
      {
        missing: [{ type: "user", emailAddress: "good@example.com" }],
        excess: [{ type: "user", emailAddress: "bad@example.com" }],
      }
    ));
});
