/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import { formatError } from "../../../src/sca/utils/format-error.js";

suite("formatError", () => {
  test("returns a plain string as-is", () => {
    assert.strictEqual(
      formatError("something went wrong"),
      "something went wrong"
    );
  });

  test("trims whitespace from string errors", () => {
    assert.strictEqual(formatError("  err  "), "err");
  });

  test("extracts message from ErrorObject with string error", () => {
    assert.strictEqual(formatError({ error: "bad input" }), "bad input");
  });

  test("extracts nested message chain from ErrorObject", () => {
    const error = {
      message: "outer",
      error: {
        message: "inner",
      },
    };
    assert.strictEqual(formatError(error), "outer\ninner");
  });

  test("handles deeply nested errors", () => {
    const error = {
      message: "level 1",
      error: {
        message: "level 2",
        error: {
          message: "level 3",
        },
      },
    };
    assert.strictEqual(formatError(error), "level 1\nlevel 2\nlevel 3");
  });

  test("returns empty string for empty string input", () => {
    assert.strictEqual(formatError(""), "");
  });

  test("handles ErrorObject without message property", () => {
    const error = { error: {} };
    assert.strictEqual(formatError(error as never), "");
  });

  test("AbortError still yields its message (guard is informational)", () => {
    const abortErr = new DOMException(
      "The operation was aborted",
      "AbortError"
    );
    const error = { error: abortErr };
    // The AbortError branch doesn't short-circuit; the while loop extracts
    // the DOMException's message property.
    assert.strictEqual(
      formatError(error as never),
      "The operation was aborted"
    );
  });

  test("handles ErrorObject with Error instance that is not AbortError", () => {
    const err = new Error("something broke");
    const error = { error: err, message: "wrapper" };
    // The while loop walks both the outer object and the inner Error.
    assert.strictEqual(formatError(error as never), "wrapper\nsomething broke");
  });
});
