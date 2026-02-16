/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { mock, suite, test } from "node:test";
import {
  decodeError,
  decodeErrorData,
} from "../../../src/sca/utils/decode-error.js";
import type {
  ErrorObject,
  ErrorResponse,
  RunErrorEvent,
} from "@breadboard-ai/types";
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
  return { error: message, metadata } as unknown as ErrorObject;
}

suite("decodeErrorData", () => {
  test("returns simple message when input is a plain string", () => {
    const result = decodeErrorData(undefined, "simple error");
    assert.deepStrictEqual(result, { message: "simple error" });
  });

  test("returns simple message for ErrorObject without metadata", () => {
    const result = decodeErrorData(undefined, { error: "bad input" });
    assert.deepStrictEqual(result, { message: "bad input" });
  });

  test("handles unknown kind with actionTracker", () => {
    const tracker = createTracker();
    const error = errorWith("something broke", { kind: "unknown" });
    const result = decodeErrorData(tracker, error);
    assert.ok(result?.message.includes("Something went wrong"));
    assert.strictEqual(callCount(tracker.errorUnknown), 1);
  });

  test("handles bug kind same as unknown", () => {
    const tracker = createTracker();
    const error = errorWith("bug happened", { kind: "bug" });
    const result = decodeErrorData(tracker, error);
    assert.ok(result?.message.includes("Something went wrong"));
    assert.strictEqual(callCount(tracker.errorUnknown), 1);
  });

  test("handles config kind", () => {
    const tracker = createTracker();
    const error = errorWith("bad config", { kind: "config" });
    const result = decodeErrorData(tracker, error);
    assert.strictEqual(result?.message, "bad config");
    assert.strictEqual(callCount(tracker.errorConfig), 1);
  });

  test("handles recitation kind", () => {
    const tracker = createTracker();
    const error = errorWith("recitation", { kind: "recitation" });
    const result = decodeErrorData(tracker, error);
    assert.ok(result?.message.includes("too similar"));
  });

  test("handles capacity kind", () => {
    const tracker = createTracker();
    const error = errorWith("quota exceeded", { kind: "capacity" });
    const result = decodeErrorData(tracker, error);
    assert.ok(result?.message.includes("quota"));
  });

  test("handles safety kind with reasons", () => {
    const tracker = createTracker();
    const error = errorWith("safety violation", {
      kind: "safety",
      reasons: ["child"],
    });
    const result = decodeErrorData(tracker, error);
    assert.ok(result?.message.includes("minors"));
    assert.strictEqual(callCount(tracker.errorSafety), 1);
  });

  test("handles safety kind without reasons", () => {
    const error = errorWith("safety", { kind: "safety" });
    const result = decodeErrorData(undefined, error);
    assert.ok(result?.message.includes("unsafe"));
  });

  test("handles safety kind with multiple reasons", () => {
    const error = errorWith("multiple safety", {
      kind: "safety",
      reasons: ["violence", "hate"],
    });
    const result = decodeErrorData(undefined, error);
    assert.ok(result?.details?.includes("violent"));
    assert.ok(result?.details?.includes("harmful"));
  });

  test("detects video medium from model name", () => {
    const error = errorWith("quota", { kind: "capacity", model: "veo-2" });
    const result = decodeErrorData(undefined, error);
    assert.ok(result?.message.includes("video"));
  });

  test("detects image medium from model name", () => {
    const error = errorWith("quota", {
      kind: "capacity",
      model: "imagegeneration",
    });
    const result = decodeErrorData(undefined, error);
    assert.ok(result?.message.includes("image"));
  });

  test("detects audio medium from model name", () => {
    const error = errorWith("quota", {
      kind: "capacity",
      model: "audio-gen",
    });
    const result = decodeErrorData(undefined, error);
    assert.ok(result?.message.includes("audio"));
  });

  test("defaults to text medium", () => {
    const error = errorWith("quota", { kind: "capacity" });
    const result = decodeErrorData(undefined, error);
    assert.ok(result?.message.includes("text"));
  });
});

suite("decodeError", () => {
  test("delegates to decodeErrorData", () => {
    const event = {
      data: { error: "test error" },
    } as unknown as RunErrorEvent;
    const result = decodeError(undefined, event);
    assert.strictEqual(result.message, "test error");
  });
});
