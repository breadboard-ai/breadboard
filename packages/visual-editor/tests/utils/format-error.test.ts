/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatError } from "../../src/utils/formatting/format-error.js";
import type { ErrorObject } from "@breadboard-ai/types";

describe("formatError", () => {
  it("returns a string error as-is", () => {
    assert.equal(formatError("something went wrong"), "something went wrong");
  });

  it("trims whitespace from string errors", () => {
    assert.equal(formatError("  padded  "), "padded");
  });

  it("returns empty string for empty string input", () => {
    assert.equal(formatError(""), "");
  });

  it("extracts string error from ErrorObject", () => {
    const err: ErrorObject = { error: "inner error" };
    assert.equal(formatError(err), "inner error");
  });

  it("extracts message from nested ErrorObject", () => {
    const err: ErrorObject = {
      error: { message: "outer", error: { message: "inner" } },
    };
    assert.equal(formatError(err), "outer\ninner");
  });

  it("handles deeply nested ErrorObjects", () => {
    const err: ErrorObject = {
      error: {
        message: "level1",
        error: {
          message: "level2",
          error: {
            message: "level3",
          },
        },
      },
    };
    assert.equal(formatError(err), "level1\nlevel2\nlevel3");
  });

  it("returns empty string for nested object without message", () => {
    const err: ErrorObject = {
      error: { error: "terminal" },
    };
    assert.equal(formatError(err), "");
  });

  it("returns string error.error when present", () => {
    const err: ErrorObject = { error: "direct-string" };
    assert.equal(formatError(err), "direct-string");
  });

  it("converts null to string", () => {
    assert.equal(formatError(null), "null");
  });

  it("converts undefined to string", () => {
    assert.equal(formatError(undefined), "undefined");
  });

  it("converts a number to string", () => {
    assert.equal(formatError(42), "42");
  });
});
