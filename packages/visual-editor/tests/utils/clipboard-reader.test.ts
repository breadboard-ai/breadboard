/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { GraphLoader } from "@breadboard-ai/types";
import { setDOM, unsetDOM } from "../fake-dom.js";
import { ClipboardReader } from "../../src/utils/clipboard-reader.js";

beforeEach(() => setDOM());
afterEach(() => {
  unsetDOM();
  mock.restoreAll();
});

function makeLoader(success: boolean): GraphLoader {
  return {
    load: async () => ({ success, title: "t", description: "" }),
  } as unknown as GraphLoader;
}

function mockClipboard(text: string, types: string[] = ["text/plain"]) {
  mock.method(navigator.clipboard, "readText", async () => text);
  mock.method(navigator.clipboard, "read", async () => [
    {
      types,
      getType: async (mimeType: string) => new Blob([text], { type: mimeType }),
    },
  ]);
}

describe("ClipboardReader", () => {
  describe("readText — plain text", () => {
    it("returns text for non-URL, non-JSON strings", async () => {
      mockClipboard("hello world");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("text" in result);
      assert.equal((result as { text: string }).text, "hello world");
    });
  });

  describe("readText — JSON graph descriptor", () => {
    it("detects a valid graph descriptor", async () => {
      const graph = JSON.stringify({
        nodes: [{ id: "n1", type: "foo" }],
        edges: [],
        title: "Test Board",
      });
      mockClipboard(graph);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("graphDescriptor" in result);
    });

    it("returns text for JSON that is not a graph descriptor", async () => {
      mockClipboard(JSON.stringify({ foo: "bar" }));
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("text" in result);
    });
  });

  describe("readText — URLs", () => {
    it("detects a graph URL when loader succeeds", async () => {
      mockClipboard("https://example.com/board.json");
      const reader = new ClipboardReader(undefined, makeLoader(true));
      const result = await reader.readText();
      assert.ok("graphUrl" in result);
      assert.equal(
        (result as { graphUrl: string }).graphUrl,
        "https://example.com/board.json"
      );
    });

    it("returns fileData for URLs that are not graphs", async () => {
      mockClipboard("https://example.com/file.pdf");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("fileData" in result);
      const fileData = (
        result as { fileData: { fileUri: string; mimeType: string } }
      ).fileData;
      assert.equal(fileData.fileUri, "https://example.com/file.pdf");
      assert.equal(fileData.mimeType, "application/octet-stream");
    });

    it("detects YouTube watch URLs as video fileData", async () => {
      mockClipboard("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("fileData" in result);
      const fileData = (
        result as { fileData: { fileUri: string; mimeType: string } }
      ).fileData;
      assert.equal(fileData.mimeType, "video/mp4");
      assert.ok(fileData.fileUri.includes("embed"));
    });

    it("detects YouTube share URLs as video fileData", async () => {
      mockClipboard("https://youtu.be/dQw4w9WgXcQ");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("fileData" in result);
      const fileData = (
        result as { fileData: { fileUri: string; mimeType: string } }
      ).fileData;
      assert.equal(fileData.mimeType, "video/mp4");
    });
  });

  describe("unknown", () => {
    it("returns the unknown sentinel", () => {
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = reader.unknown();
      assert.deepEqual(result, { unknown: true });
    });
  });

  describe("isGraphUrl", () => {
    it("returns true when loader succeeds", async () => {
      const reader = new ClipboardReader(undefined, makeLoader(true));
      const result = await reader.isGraphUrl("https://example.com/board");
      assert.equal(result, true);
    });

    it("returns false when loader fails", async () => {
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.isGraphUrl("https://example.com/nope");
      assert.equal(result, false);
    });
  });
});
