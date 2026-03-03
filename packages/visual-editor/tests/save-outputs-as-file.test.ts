/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from "node:assert";
import { suite, test } from "node:test";
import {
  saveOutputsAsFile,
  extensionFromMimeType,
} from "../src/data/save-outputs-as-file.js";
import type { LLMContent, OutputValues } from "@breadboard-ai/types";
import { encodeBase64 } from "../src/a2/a2/utils.js";
import { ok } from "@breadboard-ai/utils";

function inlineHtml(html: string): OutputValues {
  return {
    context: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "text/html",
              data: encodeBase64(html),
            },
          },
        ],
        role: "model",
      },
    ] satisfies LLMContent[],
  };
}

suite("saveOutputsAsFile", () => {
  test("decodes base64-encoded text/html to readable HTML", async () => {
    const html = "<h1>Hello, world!</h1>";
    const outputs = inlineHtml(html);

    const result = await saveOutputsAsFile(outputs);
    assert.ok(ok(result), "expected successful outcome");
    assert.strictEqual(result.type, "text/html");

    const text = await result.text();
    assert.strictEqual(text, html);
  });

  test("decodes base64-encoded text/html with Unicode characters", async () => {
    const html = "<p>Héllo wörld — 日本語</p>";
    const outputs = inlineHtml(html);

    const result = await saveOutputsAsFile(outputs);
    assert.ok(ok(result), "expected successful outcome");

    const text = await result.text();
    assert.strictEqual(text, html);
  });

  test("decodes base64-encoded text/plain", async () => {
    const plainText = "Just some plain text content.";
    const outputs: OutputValues = {
      context: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "text/plain",
                data: encodeBase64(plainText),
              },
            },
          ],
          role: "model",
        },
      ] satisfies LLMContent[],
    };

    const result = await saveOutputsAsFile(outputs);
    assert.ok(ok(result), "expected successful outcome");
    assert.strictEqual(result.type, "text/plain");

    const text = await result.text();
    assert.strictEqual(text, plainText);
  });

  test("wraps text parts as markdown", async () => {
    const outputs: OutputValues = {
      context: [
        {
          parts: [{ text: "# Hello" }],
          role: "model",
        },
      ] satisfies LLMContent[],
    };

    const result = await saveOutputsAsFile(outputs);
    assert.ok(ok(result), "expected successful outcome");
    assert.strictEqual(result.type, "text/markdown");

    const text = await result.text();
    assert.strictEqual(text, "# Hello");
  });

  test("produces zip for multiple parts", async () => {
    const outputs: OutputValues = {
      context: [
        {
          parts: [
            { text: "part one" },
            {
              inlineData: {
                mimeType: "text/html",
                data: encodeBase64("<p>part two</p>"),
              },
            },
          ],
          role: "model",
        },
      ] satisfies LLMContent[],
    };

    const result = await saveOutputsAsFile(outputs);
    assert.ok(ok(result), "expected successful outcome");
    assert.strictEqual(result.type, "application/zip");
  });

  test("serializes non-LLMContent values as JSON text", async () => {
    const outputs: OutputValues = {
      someField: "just a string",
    };

    const result = await saveOutputsAsFile(outputs);
    assert.ok(ok(result), "expected successful outcome");
    assert.strictEqual(result.type, "text/markdown");

    const text = await result.text();
    assert.strictEqual(text, JSON.stringify("just a string"));
  });
});

suite("extensionFromMimeType", () => {
  test("returns html for text/html", () => {
    assert.strictEqual(extensionFromMimeType("text/html"), "html");
  });

  test("returns txt for text/plain", () => {
    assert.strictEqual(extensionFromMimeType("text/plain"), "txt");
  });

  test("returns empty string for unknown mime type", () => {
    assert.strictEqual(extensionFromMimeType("application/octet-stream"), "");
  });

  test("returns empty string for empty string", () => {
    assert.strictEqual(extensionFromMimeType(""), "");
  });

  test("normalizes case and strips parameters", () => {
    assert.strictEqual(
      extensionFromMimeType("Text/HTML; charset=utf-8"),
      "html"
    );
  });
});
