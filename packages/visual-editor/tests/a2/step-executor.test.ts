/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { ok } from "@breadboard-ai/utils/outcome.js";
import { parseExecutionOutput } from "../../src/a2/a2/step-executor.js";
import { encodeBase64, decodeBase64 } from "../../src/a2/a2/utils.js";
import { InlineDataCapabilityPart } from "@breadboard-ai/types";

describe("parseExecutionOutput", () => {
  it("preserves base64-encoded text/html data in inlineData", () => {
    const html = "<h1>Hello</h1>";
    const encoded = encodeBase64(html);

    const result = parseExecutionOutput([
      { mimetype: "text/html", data: encoded },
    ]);
    if (!ok(result)) {
      throw new Error(result.$error);
    }

    const part = result.chunks[0].parts[0] as InlineDataCapabilityPart;
    strictEqual(part.inlineData.mimeType, "text/html");
    // inlineData.data must remain base64-encoded, not decoded.
    strictEqual(part.inlineData.data, encoded);
  });

  it("preserves base64-encoded text/html with non-Latin1 characters", () => {
    const html = "<h1>こんにちは 🎉</h1>";
    const encoded = encodeBase64(html);

    const result = parseExecutionOutput([
      { mimetype: "text/html", data: encoded },
    ]);
    if (!ok(result)) {
      throw new Error(result.$error);
    }

    const part = result.chunks[0].parts[0] as InlineDataCapabilityPart;
    // Data stays base64 — downstream renderers decode it.
    strictEqual(part.inlineData.data, encoded);
    // Round-trip: decoding the stored data recovers the original HTML.
    strictEqual(decodeBase64(part.inlineData.data), html);
  });

  it("passes through non-HTML data as base64", () => {
    const json = '{"key":"value"}';
    const encoded = encodeBase64(json);

    const result = parseExecutionOutput([
      { mimetype: "application/json", data: encoded },
    ]);
    if (!ok(result)) {
      throw new Error(result.$error);
    }

    const part = result.chunks[0].parts[0] as InlineDataCapabilityPart;
    strictEqual(part.inlineData.data, encoded);
  });

  it("extracts requested-model and executed-model substreams", () => {
    const result = parseExecutionOutput([
      {
        mimetype: "text/plain",
        data: encodeBase64("result"),
        substreamName: undefined,
      },
      {
        mimetype: "text/plain",
        data: "gemini-2.5-flash",
        substreamName: "requested-model",
      },
      {
        mimetype: "text/plain",
        data: "gemini-2.5-flash-001",
        substreamName: "executed-model",
      },
    ]);
    if (!ok(result)) {
      throw new Error(result.$error);
    }

    strictEqual(result.requestedModel, "gemini-2.5-flash");
    strictEqual(result.executedModel, "gemini-2.5-flash-001");
    // Only the non-substream chunk becomes output.
    strictEqual(result.chunks.length, 1);
  });

  it("returns error when input is empty", () => {
    const result = parseExecutionOutput([]);
    if (ok(result)) {
      throw new Error("Expected an error outcome");
    }
    strictEqual(result.$error.includes("Unable to find data"), true);
  });

  it("returns error when input is undefined", () => {
    const result = parseExecutionOutput(undefined);
    if (ok(result)) {
      throw new Error("Expected an error outcome");
    }
    strictEqual(result.$error.includes("Unable to find data"), true);
  });

  it("handles storedData mimetypes", () => {
    const result = parseExecutionOutput([
      { mimetype: "image/png/storedData", data: "https://example.com/img.png" },
    ]);
    if (!ok(result)) {
      throw new Error(result.$error);
    }

    const part = result.chunks[0].parts[0];
    if (!("storedData" in part)) {
      throw new Error("Expected storedData part");
    }
    strictEqual(part.storedData.mimeType, "image/png");
    strictEqual(part.storedData.handle, "https://example.com/img.png");
  });
});

describe("decodeBase64", () => {
  it("decodes valid base64 ASCII text", () => {
    const original = "Hello, world!";
    strictEqual(decodeBase64(encodeBase64(original)), original);
  });

  it("decodes valid base64 UTF-8 text with non-Latin1 characters", () => {
    const original = "こんにちは 🎉 Héllo";
    strictEqual(decodeBase64(encodeBase64(original)), original);
  });

  it("returns raw text when input is not valid base64", () => {
    const raw = "<h1>こんにちは</h1>";
    // This would throw with the old code — non-Latin1 chars in atob input.
    strictEqual(decodeBase64(raw), raw);
  });

  it("round-trips with encodeBase64", () => {
    const cases = [
      "",
      "simple ASCII",
      "with special chars: <>&\"'",
      "UTF-8: café résumé naïve",
      "CJK: 東京タワー",
      "Emoji: 🎉🚀💡",
      "Mixed: Hello 世界 🌍!",
    ];
    for (const original of cases) {
      strictEqual(
        decodeBase64(encodeBase64(original)),
        original,
        `Round-trip failed for: ${original}`
      );
    }
  });
});
