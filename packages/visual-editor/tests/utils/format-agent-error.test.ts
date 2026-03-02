/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import {
  formatAgentError,
  classifyCaughtError,
} from "../../src/utils/formatting/format-agent-error.js";

describe("formatAgentError", () => {
  it("handles Error objects", () => {
    assert.equal(formatAgentError(new Error("boom")), "boom");
  });

  it("handles Error with cause chain", () => {
    const inner = new Error("root cause");
    const outer = new Error("wrapper", { cause: inner });
    assert.equal(formatAgentError(outer), "wrapper: root cause");
  });

  it("handles nested cause chains", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    const c = new Error("c", { cause: b });
    assert.equal(formatAgentError(c), "c: b: a");
  });

  it("handles plain strings", () => {
    assert.equal(
      formatAgentError("something went wrong"),
      "something went wrong"
    );
  });

  it("trims whitespace from strings", () => {
    assert.equal(formatAgentError("  padded  "), "padded");
  });

  it("handles Outcome $error objects", () => {
    assert.equal(
      formatAgentError({ $error: "quota exhausted" }),
      "quota exhausted"
    );
  });

  it("trims $error strings", () => {
    assert.equal(formatAgentError({ $error: "  spaced  " }), "spaced");
  });

  it("handles objects with message property", () => {
    assert.equal(formatAgentError({ message: "from message" }), "from message");
  });

  it("prefers $error over message", () => {
    assert.equal(
      formatAgentError({ $error: "outcome", message: "fallback" }),
      "outcome"
    );
  });

  it("handles null", () => {
    assert.equal(formatAgentError(null), "null");
  });

  it("handles undefined", () => {
    assert.equal(formatAgentError(undefined), "undefined");
  });

  it("handles numbers", () => {
    assert.equal(formatAgentError(42), "42");
  });

  it("handles boolean", () => {
    assert.equal(formatAgentError(false), "false");
  });

  it("handles non-Error cause values", () => {
    const e = new Error("outer", { cause: "string cause" });
    assert.equal(formatAgentError(e), "outer: string cause");
  });
});

describe("classifyCaughtError", () => {
  it("classifies TypeError 'Failed to fetch' as network", () => {
    const e = new TypeError("Failed to fetch");
    const meta = classifyCaughtError(e);
    assert.equal(meta.kind, "network");
    assert.equal(meta.origin, "client");
  });

  it("classifies cross-realm TypeError (e.name match) as network", () => {
    // Simulates Comlink/OAuth shell cross-realm scenario where
    // instanceof TypeError fails but e.name is still "TypeError".
    const e = new Error("Failed to fetch");
    e.name = "TypeError";
    const meta = classifyCaughtError(e);
    assert.equal(meta.kind, "network");
    assert.equal(meta.origin, "client");
  });

  it("classifies TypeError 'NetworkError' as network", () => {
    const e = new TypeError("NetworkError when attempting to fetch resource.");
    const meta = classifyCaughtError(e);
    assert.equal(meta.kind, "network");
    assert.equal(meta.origin, "client");
  });

  it("classifies AbortError by name as abort", () => {
    const e = new DOMException("The operation was aborted.", "AbortError");
    const meta = classifyCaughtError(e);
    assert.equal(meta.kind, "abort");
    assert.equal(meta.origin, "client");
  });

  it("classifies Error with AbortError name as abort", () => {
    const e = new Error("signal aborted");
    e.name = "AbortError";
    const meta = classifyCaughtError(e);
    assert.equal(meta.kind, "abort");
    assert.equal(meta.origin, "client");
  });

  it("returns client origin for unrecognized TypeError", () => {
    const e = new TypeError("Cannot read properties of null");
    const meta = classifyCaughtError(e);
    assert.equal(meta.kind, undefined);
    assert.equal(meta.origin, "client");
  });

  it("returns client origin for plain Error", () => {
    const e = new Error("something broke");
    const meta = classifyCaughtError(e);
    assert.equal(meta.kind, undefined);
    assert.equal(meta.origin, "client");
  });

  it("returns client origin for string", () => {
    const meta = classifyCaughtError("oops");
    assert.equal(meta.kind, undefined);
    assert.equal(meta.origin, "client");
  });

  it("returns client origin for null", () => {
    const meta = classifyCaughtError(null);
    assert.equal(meta.kind, undefined);
    assert.equal(meta.origin, "client");
  });
});
