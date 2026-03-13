/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { parseStreamError } from "../../../src/utils/formatting/parse-stream-error.js";

describe("parseStreamError", () => {
  it("extracts the friendly message from a raw 503 error dump", () => {
    const raw =
      `503 UNAVAILABLE. {'error': {'code': 503, 'message': ` +
      `'This model is currently experiencing high demand. ` +
      `Spikes in demand are usually temporary. Please try again later.', ` +
      `'status': 'UNAVAILABLE', 'details': [{'@type': 'some.type', ` +
      `'detail': 'internal stack trace'}]}}`;

    const result = parseStreamError(raw);
    assert.equal(
      result,
      "This model is currently experiencing high demand. " +
        "Spikes in demand are usually temporary. Please try again later."
    );
  });

  it("returns the raw text for a simple error string", () => {
    const raw = "Something went wrong";
    assert.equal(parseStreamError(raw), "Something went wrong");
  });

  it("returns a fallback for empty text", () => {
    assert.equal(parseStreamError(""), "An unknown error occurred.");
  });

  it("returns raw text when JSON parsing fails", () => {
    const raw = "503 UNAVAILABLE. {broken json here}";
    assert.equal(parseStreamError(raw), raw);
  });

  it("handles error JSON without a message field", () => {
    const raw = "500 ERROR. {'error': {'code': 500}}";
    assert.equal(parseStreamError(raw), raw);
  });

  it("handles proper double-quoted JSON as well", () => {
    const raw =
      '503 UNAVAILABLE. {"error": {"code": 503, "message": "Model overloaded"}}';
    assert.equal(parseStreamError(raw), "Model overloaded");
  });
});
