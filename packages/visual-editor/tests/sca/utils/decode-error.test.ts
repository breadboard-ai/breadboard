/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { mock, suite, test } from "node:test";
import {
  decodeErrorData,
  trackError,
} from "../../../src/sca/utils/decode-error.js";
import type { ErrorResponse } from "@breadboard-ai/types";
import type { ActionTracker } from "../../../src/ui/types/types.js";

function createTracker(): ActionTracker {
  return {
    errorUnknown: mock.fn(),
    errorConfig: mock.fn(),
    errorRecitation: mock.fn(),
    errorCapacity: mock.fn(),
    errorSafety: mock.fn(),
    errorPermission: mock.fn(),
    submit: mock.fn(),
    runApp: mock.fn(),
    cancel: mock.fn(),
    generateApp: mock.fn(),
    editApp: mock.fn(),
    share: mock.fn(),
    feedback: mock.fn(),
    deleteApp: mock.fn(),
    viewApp: mock.fn(),
  } as unknown as ActionTracker;
}

/** Helper to count mock.fn calls via unknown cast. */
function callCount(fn: unknown): number {
  return (fn as { mock: { calls: unknown[] } }).mock.calls.length;
}

/**
 * Build an ErrorObject that also carries `metadata` as it does at runtime.
 * TypeScript's ErrorObject type does not include `metadata`, but the
 * runtime objects coming from the server do. The decode-error code reads it
 * via `"metadata" in error`.
 */
function errorWith(
  message: string,
  metadata: Record<string, unknown>
): ErrorResponse["error"] {
  return { error: message, metadata } as unknown as ErrorResponse["error"];
}

suite("decodeErrorData", () => {
  test("returns simple message when input is a plain string", () => {
    const result = decodeErrorData("simple error");
    assert.deepStrictEqual(result, { message: "simple error" });
  });

  test("returns simple message for ErrorObject without metadata", () => {
    const result = decodeErrorData({ error: "bad input" });
    assert.deepStrictEqual(result, { message: "bad input" });
  });

  test("handles unknown kind", () => {
    const error = errorWith("something broke", { kind: "unknown" });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("Something went wrong"));
  });

  test("handles bug kind same as unknown", () => {
    const error = errorWith("bug happened", { kind: "bug" });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("Something went wrong"));
  });

  test("handles config kind", () => {
    const error = errorWith("bad config", { kind: "config" });
    const result = decodeErrorData(error);
    assert.strictEqual(result?.message, "bad config");
  });

  test("handles recitation kind", () => {
    const error = errorWith("recitation", { kind: "recitation" });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("too similar"));
  });

  test("handles image medium for free-quota-exhausted", () => {
    const error = errorWith("quota exceeded", {
      kind: "free-quota-exhausted",
      model: "imagegeneration",
    });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("image"));
    assert.ok(result?.message.includes("try again later"));
  });

  test("free-quota-exhausted-can-pay message mentions upgrade", () => {
    const error = errorWith("quota exceeded", {
      kind: "free-quota-exhausted-can-pay",
    });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("upgrade"));
    assert.ok(result?.message.includes("text"));
  });

  test("free-quota-exhausted-can-pay with video medium", () => {
    const error = errorWith("quota exceeded", {
      kind: "free-quota-exhausted-can-pay",
      model: "veo-2",
    });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("video"));
    assert.ok(result?.message.includes("upgrade"));
  });

  test("handles safety kind with reasons", () => {
    const error = errorWith("safety violation", {
      kind: "safety",
      reasons: ["child"],
    });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("minors"));
  });

  test("handles safety kind without reasons", () => {
    const error = errorWith("safety", { kind: "safety" });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("unsafe"));
  });

  test("handles safety kind with multiple reasons", () => {
    const error = errorWith("multiple safety", {
      kind: "safety",
      reasons: ["violence", "hate"],
    });
    const result = decodeErrorData(error);
    assert.ok(result?.details?.includes("violent"));
    assert.ok(result?.details?.includes("harmful"));
  });

  test("detects video medium from model name", () => {
    const error = errorWith("quota", {
      kind: "free-quota-exhausted",
      model: "veo-2",
    });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("video"));
  });

  test("detects image medium from model name", () => {
    const error = errorWith("quota", {
      kind: "free-quota-exhausted",
      model: "imagegeneration",
    });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("image"));
  });

  test("detects audio medium from model name", () => {
    const error = errorWith("quota", {
      kind: "free-quota-exhausted",
      model: "audio-gen",
    });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("audio"));
  });

  test("defaults to text medium", () => {
    const error = errorWith("quota", { kind: "free-quota-exhausted" });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("text"));
    assert.ok(result?.message.includes("try again later"));
  });

  test("handles capacity kind", () => {
    const error = errorWith("quota exceeded", { kind: "capacity" });
    const result = decodeErrorData(error);
    assert.ok(result?.message.includes("high demand"));
  });

  // --- Auto-extraction from raw error strings (maybeExtractRichError) ---

  test("auto-extracts free-quota-exhausted from RESOURCE_EXHAUSTED JSON", () => {
    const json = JSON.stringify({
      code: "RESOURCE_EXHAUSTED",
      error_reason: "FREE_QUOTA_EXHAUSTED",
      message: "Quota exceeded",
    });
    const result = decodeErrorData(json);
    assert.strictEqual(result.metadata?.kind, "free-quota-exhausted");
    assert.ok(result.message.includes("quota"));
  });

  test("auto-extracts paid-quota-exhausted from RESOURCE_EXHAUSTED JSON", () => {
    const json = JSON.stringify({
      code: "RESOURCE_EXHAUSTED",
      error_reason: "PAID_QUOTA_EXHAUSTED",
      message: "Paid quota exceeded",
    });
    const result = decodeErrorData(json);
    assert.strictEqual(result.metadata?.kind, "paid-quota-exhausted");
    assert.ok(result.message.includes("credits"));
  });

  test("auto-extracts free-quota-exhausted-can-pay from RESOURCE_EXHAUSTED JSON", () => {
    const json = JSON.stringify({
      code: "RESOURCE_EXHAUSTED",
      error_reason: "FREE_QUOTA_EXHAUSTED_CAN_PAY",
      message: "Free quota exceeded",
    });
    const result = decodeErrorData(json);
    assert.strictEqual(result.metadata?.kind, "free-quota-exhausted-can-pay");
    assert.ok(result.message.includes("upgrade"));
  });

  test("auto-extracts safety kind from plain string via fuzzy match", () => {
    const result = decodeErrorData("blocked for safety reasons");
    assert.strictEqual(result.metadata?.kind, "safety");
  });

  test("auto-extracts capacity kind from plain string with 'quota'", () => {
    const result = decodeErrorData("rate limited due to quota");
    assert.strictEqual(result.metadata?.kind, "capacity");
  });

  test("auto-extracts recitation kind from plain string", () => {
    const result = decodeErrorData("recitation detected in output");
    assert.strictEqual(result.metadata?.kind, "recitation");
  });

  test("explicit metadata takes precedence over auto-extracted", () => {
    // JSON has "RESOURCE_EXHAUSTED" → auto-extracts "free-quota-exhausted"
    // But explicit metadata says "paid-quota-exhausted"
    const json = JSON.stringify({
      code: "RESOURCE_EXHAUSTED",
      error_reason: "FREE_QUOTA_EXHAUSTED",
      message: "Quota exceeded",
    });
    const error = {
      error: json,
      metadata: { kind: "paid-quota-exhausted" as const },
    };
    const result = decodeErrorData(
      error as unknown as Parameters<typeof decodeErrorData>[0]
    );
    assert.strictEqual(result.metadata?.kind, "paid-quota-exhausted");
  });

  test("explicit model is preserved when kind is auto-extracted", () => {
    const json = JSON.stringify({
      code: "RESOURCE_EXHAUSTED",
      error_reason: "FREE_QUOTA_EXHAUSTED",
      message: "Quota exceeded",
    });
    const result = decodeErrorData(json, { origin: "server", model: "veo-2" });
    assert.strictEqual(result.metadata?.kind, "free-quota-exhausted");
    assert.strictEqual(result.metadata?.model, "veo-2");
    // Should use video medium since model is "veo-2"
    assert.ok(result.message.includes("video"));
  });

  // --- Null/undefined guard ---

  test("returns fallback message when error is undefined", () => {
    const result = decodeErrorData(
      undefined as unknown as Parameters<typeof decodeErrorData>[0]
    );
    assert.strictEqual(result.message, "Unknown error");
  });

  test("returns fallback message when error is null", () => {
    const result = decodeErrorData(
      null as unknown as Parameters<typeof decodeErrorData>[0]
    );
    assert.strictEqual(result.message, "Unknown error");
  });

  // --- RESOURCE_EXHAUSTED with unknown error_reason ---

  test("RESOURCE_EXHAUSTED with unknown error_reason falls back to capacity", () => {
    const json = JSON.stringify({
      code: "RESOURCE_EXHAUSTED",
      error_reason: "SOMETHING_ELSE",
      message: "Other quota issue",
    });
    const result = decodeErrorData(json);
    assert.strictEqual(result.metadata?.kind, "capacity");
    assert.ok(result.message.includes("high demand"));
  });

  // --- Structured JSON without RESOURCE_EXHAUSTED ---

  test("JSON without RESOURCE_EXHAUSTED code falls through to fuzzy match", () => {
    const json = JSON.stringify({
      code: "INTERNAL",
      message: "something about safety went wrong",
    });
    const result = decodeErrorData(json);
    // Should fuzzy-match on "safety" in the message
    assert.strictEqual(result.metadata?.kind, "safety");
  });

  test("JSON without RESOURCE_EXHAUSTED and no fuzzy match returns simple message", () => {
    const json = JSON.stringify({
      code: "INTERNAL",
      message: "unexpected failure",
    });
    const result = decodeErrorData(json);
    assert.strictEqual(result.message, "unexpected failure");
    assert.strictEqual(result.metadata, undefined);
  });

  // --- Safety reason branches ---

  test("handles safety celebrity reason", () => {
    const error = errorWith("safety", {
      kind: "safety",
      reasons: ["celebrity"],
    });
    const result = decodeErrorData(error);
    assert.ok(result.message.includes("prominent people"));
  });

  test("handles safety sexual reason", () => {
    const error = errorWith("safety", {
      kind: "safety",
      reasons: ["sexual"],
    });
    const result = decodeErrorData(error);
    assert.ok(result.message.includes("sexual"));
  });

  test("handles safety dangerous reason", () => {
    const error = errorWith("safety", {
      kind: "safety",
      reasons: ["dangerous"],
    });
    const result = decodeErrorData(error);
    assert.ok(result.message.includes("harmful"));
  });

  test("handles safety unknown reason with default policy", () => {
    const error = errorWith("safety", {
      kind: "safety",
      reasons: ["other-unknown"],
    });
    const result = decodeErrorData(error);
    assert.ok(result.message.includes("unsafe"));
  });

  // --- Default kind switch ---

  test("unrecognized kind returns raw message with metadata", () => {
    const error = errorWith("custom error", {
      kind: "some-future-kind",
    });
    const result = decodeErrorData(error);
    assert.strictEqual(result.message, "custom error");
    assert.strictEqual(result.metadata?.kind, "some-future-kind");
  });

  // --- paid-quota-exhausted message verification ---

  test("paid-quota-exhausted message mentions credits", () => {
    const error = errorWith("quota", {
      kind: "paid-quota-exhausted",
      model: "veo-2",
    });
    const result = decodeErrorData(error);
    assert.ok(result.message.includes("credits"));
    assert.ok(result.message.includes("video"));
  });

  // --- Network kind ---

  test("handles network kind via explicit metadata", () => {
    const result = decodeErrorData("Failed to fetch", {
      kind: "network",
      origin: "client",
    });
    assert.ok(result.message.includes("Unable to reach the server"));
    assert.strictEqual(result.metadata?.kind, "network");
  });

  test("network kind preserves original error in details", () => {
    const result = decodeErrorData("Failed to fetch", {
      kind: "network",
      origin: "client",
    });
    assert.strictEqual(result.details, "Failed to fetch");
  });

  test("network kind via error object metadata", () => {
    const error = errorWith("NetworkError when attempting to fetch", {
      kind: "network",
      origin: "client",
    });
    const result = decodeErrorData(error);
    assert.ok(result.message.includes("Unable to reach the server"));
    assert.strictEqual(result.metadata?.kind, "network");
  });

  // --- Abort kind ---

  test("handles abort kind via explicit metadata", () => {
    const result = decodeErrorData("Run stopped", {
      kind: "abort",
      origin: "client",
    });
    assert.strictEqual(result.message, "Run stopped.");
    assert.strictEqual(result.metadata?.kind, "abort");
  });

  test("abort kind via error object metadata", () => {
    const error = errorWith("The operation was aborted", {
      kind: "abort",
      origin: "client",
    });
    const result = decodeErrorData(error);
    assert.strictEqual(result.message, "Run stopped.");
    assert.strictEqual(result.metadata?.kind, "abort");
  });
});

suite("trackError", () => {
  test("calls errorUnknown for unknown kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "unknown" });
    assert.strictEqual(callCount(tracker.errorUnknown), 1);
  });

  test("calls errorUnknown for bug kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "bug" });
    assert.strictEqual(callCount(tracker.errorUnknown), 1);
  });

  test("calls errorConfig for config kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "config" });
    assert.strictEqual(callCount(tracker.errorConfig), 1);
  });

  test("calls errorRecitation for recitation kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "recitation" });
    assert.strictEqual(callCount(tracker.errorRecitation), 1);
  });

  test("calls errorCapacity for capacity kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "capacity" });
    assert.strictEqual(callCount(tracker.errorCapacity), 1);
  });

  test("calls errorCapacity for free-quota-exhausted kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "free-quota-exhausted" });
    assert.strictEqual(callCount(tracker.errorCapacity), 1);
  });

  test("calls errorCapacity for free-quota-exhausted-can-pay kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "free-quota-exhausted-can-pay" });
    assert.strictEqual(callCount(tracker.errorCapacity), 1);
  });

  test("calls errorCapacity for paid-quota-exhausted kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "paid-quota-exhausted" });
    assert.strictEqual(callCount(tracker.errorCapacity), 1);
  });

  test("calls errorSafety for safety kind", () => {
    const tracker = createTracker();
    trackError(tracker, { kind: "safety" });
    assert.strictEqual(callCount(tracker.errorSafety), 1);
  });

  test("does nothing when tracker is undefined", () => {
    // Should not throw
    trackError(undefined, { kind: "unknown" });
  });

  test("does nothing when metadata is undefined", () => {
    const tracker = createTracker();
    trackError(tracker, undefined);
    assert.strictEqual(callCount(tracker.errorUnknown), 0);
    assert.strictEqual(callCount(tracker.errorConfig), 0);
  });
});
