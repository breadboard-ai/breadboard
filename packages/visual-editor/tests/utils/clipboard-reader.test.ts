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

  describe("read — binary data", () => {
    it("returns inlineData for image mime types", async () => {
      const imgData = "fake-image-bytes";
      mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["image/png"],
          getType: async (mimeType: string) =>
            new Blob([imgData], { type: mimeType }),
        },
      ]);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.read();
      assert.ok("inlineData" in result);
      const data = (result as { inlineData: { mimeType: string } }).inlineData;
      assert.equal(data.mimeType, "image/png");
    });

    it("returns inlineData for video mime types", async () => {
      mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["video/mp4"],
          getType: async (mimeType: string) =>
            new Blob(["vid"], { type: mimeType }),
        },
      ]);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.read();
      assert.ok("inlineData" in result);
    });

    it("returns inlineData for audio mime types", async () => {
      mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["audio/mpeg"],
          getType: async (mimeType: string) =>
            new Blob(["audio"], { type: mimeType }),
        },
      ]);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.read();
      assert.ok("inlineData" in result);
    });

    it("returns inlineData for application/pdf", async () => {
      mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["application/pdf"],
          getType: async (mimeType: string) =>
            new Blob(["pdf"], { type: mimeType }),
        },
      ]);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.read();
      assert.ok("inlineData" in result);
    });

    it("returns inlineData for text/html", async () => {
      mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["text/html"],
          getType: async (mimeType: string) =>
            new Blob(["<p>hi</p>"], { type: mimeType }),
        },
      ]);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.read();
      assert.ok("inlineData" in result);
    });

    it("returns unknown when no supported types found", async () => {
      mock.method(navigator.clipboard, "read", async () => [
        {
          types: ["application/octet-stream"],
          getType: async () => new Blob(),
        },
      ]);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.read();
      assert.deepEqual(result, { unknown: true });
    });

    it("returns unknown when clipboard items are empty", async () => {
      mock.method(navigator.clipboard, "read", async () => []);
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.read();
      assert.deepEqual(result, { unknown: true });
    });
  });

  describe("readText — URL fragments", () => {
    it("detects fragment-only URLs when graphUrl base is provided", async () => {
      mockClipboard("#fragment-id");
      const reader = new ClipboardReader(
        "https://example.com/page",
        makeLoader(false)
      );
      const result = await reader.readText();
      assert.ok("fileData" in result);
    });

    it("treats fragment-only text as plain text when no graphUrl base is provided", async () => {
      mockClipboard("#not-a-url");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("text" in result);
    });
  });

  describe("readText — isUrl fallback (no URL.canParse)", () => {
    // The isUrl function checks `cP in URL` where cP is "canParse".
    // When URL.canParse doesn't exist it falls through to a try/catch
    // with `new URL(...)`. We temporarily remove canParse to test this.
    let savedCanParse: typeof URL.canParse;

    beforeEach(() => {
      savedCanParse = URL.canParse;
      delete (URL as unknown as Record<string, unknown>).canParse;
    });

    afterEach(() => {
      URL.canParse = savedCanParse;
    });

    it("detects a valid URL via try/catch fallback", async () => {
      mockClipboard("https://example.com/board.json");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("fileData" in result);
    });

    it("returns text for invalid URLs via try/catch fallback", async () => {
      mockClipboard("not a url at all");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("text" in result);
    });

    it("handles fragment-only URLs with base via try/catch fallback", async () => {
      mockClipboard("#frag");
      const reader = new ClipboardReader(
        "https://example.com/page",
        makeLoader(false)
      );
      const result = await reader.readText();
      assert.ok("fileData" in result);
    });

    it("handles fragment-only text without base via try/catch fallback", async () => {
      mockClipboard("#frag");
      const reader = new ClipboardReader(undefined, makeLoader(false));
      const result = await reader.readText();
      assert.ok("text" in result);
    });
  });
});
