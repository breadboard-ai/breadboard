/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { AgentFileSystem } from "../../src/a2/agent/file-system.js";
import { stubMemoryManager, stubModuleArgs } from "../useful-stubs.js";
import { err, ok } from "@breadboard-ai/utils/outcome.js";
import { deepStrictEqual, fail, ok as success, strictEqual } from "node:assert";

describe("Agent File System", () => {
  it("handles existing system files", async () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });
    fileSystem.addSystemFile("/mnt/system/foo", () => "foo");
    const file = await fileSystem.get("/mnt/system/foo");
    if (!ok(file)) {
      fail(file.$error);
    }
    deepStrictEqual(file, [{ text: "foo" }]);
  });

  it("handles non-existing system files", async () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });
    fileSystem.addSystemFile("/mnt/system/foo", () => "foo");
    const file = await fileSystem.get("/mnt/system/bar");
    if (!ok(file)) {
      success(file.$error);
      return;
    }
    fail(`File "/mnt/system/baz" should not have been found`);
  });

  it("handles failure to get a system file", async () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });
    fileSystem.addSystemFile("/mnt/system/foo", () => err("Sorry"));
    const file = await fileSystem.get("/mnt/system/foo");
    if (!ok(file)) {
      success(file.$error);
      return;
    }
    fail(`File "/mnt/system/foo" should not have been found`);
  });

  it("deduplicates storedData parts with same handle", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const handle = "stored://some-unique-handle";
    const part1 = {
      storedData: { handle, mimeType: "image/png" },
    };
    const part2 = {
      storedData: { handle, mimeType: "image/png" },
    };

    const path1 = fileSystem.add(part1);
    const path2 = fileSystem.add(part2);

    if (!ok(path1) || !ok(path2)) {
      fail("Failed to add parts");
    }

    // Both parts should return the same path since they have the same handle
    strictEqual(path1, path2);
    // Only one file should exist in the file system
    strictEqual(fileSystem.files.size, 1);
  });

  it("deduplicates fileData parts with same URI", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const fileUri = "https://example.com/file.pdf";
    const part1 = {
      fileData: { fileUri, mimeType: "application/pdf" },
    };
    const part2 = {
      fileData: { fileUri, mimeType: "application/pdf" },
    };

    const path1 = fileSystem.add(part1);
    const path2 = fileSystem.add(part2);

    if (!ok(path1) || !ok(path2)) {
      fail("Failed to add parts");
    }

    // Both parts should return the same path since they have the same URI
    strictEqual(path1, path2);
    // Only one file should exist in the file system
    strictEqual(fileSystem.files.size, 1);
  });

  it("does not deduplicate parts with different handles", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const part1 = {
      storedData: { handle: "stored://handle-1", mimeType: "image/png" },
    };
    const part2 = {
      storedData: { handle: "stored://handle-2", mimeType: "image/png" },
    };

    const path1 = fileSystem.add(part1);
    const path2 = fileSystem.add(part2);

    if (!ok(path1) || !ok(path2)) {
      fail("Failed to add parts");
    }

    // Different handles should create different paths
    strictEqual(path1 !== path2, true);
    // Two files should exist in the file system
    strictEqual(fileSystem.files.size, 2);
  });

  it("does not deduplicate text or inlineData parts", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const textPart1 = { text: "same text" };
    const textPart2 = { text: "same text" };

    const path1 = fileSystem.add(textPart1);
    const path2 = fileSystem.add(textPart2);

    if (!ok(path1) || !ok(path2)) {
      fail("Failed to add parts");
    }

    // Text parts are not deduplicated, even with the same content
    strictEqual(path1 !== path2, true);
    strictEqual(fileSystem.files.size, 2);
  });

  it("write infers mime type from .md extension", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const path = fileSystem.write("report.md", "# Hello");
    strictEqual(path, "/mnt/report.md");

    const file = fileSystem.files.get(path);
    success(file);
    strictEqual(file!.mimeType, "text/markdown");
    strictEqual(file!.type, "text");
  });

  it("write stores text/html as inlineData", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const html = "<h1>Hi</h1>";
    const path = fileSystem.write("page.html", html);
    strictEqual(path, "/mnt/page.html");

    const file = fileSystem.files.get(path);
    success(file);
    strictEqual(file!.mimeType, "text/html");
    strictEqual(file!.type, "inlineData");
    // Data must be base64-encoded to match the inlineData convention.
    strictEqual(file!.data, btoa(html));
  });

  it("write HTML round-trips through get as base64 inlineData", async () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const html = "<h1>Hello</h1>";
    const path = fileSystem.write("page.html", html);
    const parts = await fileSystem.get(path);
    if (!ok(parts)) {
      fail(parts.$error);
    }
    deepStrictEqual(parts, [
      {
        inlineData: {
          data: btoa(html),
          mimeType: "text/html",
          title: undefined,
        },
      },
    ]);
    // Verify decoding round-trip
    strictEqual(atob(parts[0].inlineData.data), html);
  });

  it("write infers mime type from .csv extension", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const path = fileSystem.write("data.csv", "a,b,c");
    strictEqual(path, "/mnt/data.csv");

    const file = fileSystem.files.get(path);
    success(file);
    strictEqual(file!.mimeType, "text/csv");
  });

  it("write falls back to text/plain for names without extension", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const path = fileSystem.write("notes", "some text");
    strictEqual(path, "/mnt/notes.txt");

    const file = fileSystem.files.get(path);
    success(file);
    strictEqual(file!.mimeType, "text/plain");
  });

  it("overwrite infers mime type from .json extension", () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });

    const path = fileSystem.overwrite("config.json", '{"key": "value"}');
    strictEqual(path, "/mnt/config.json");

    const file = fileSystem.files.get(path);
    success(file);
    strictEqual(file!.mimeType, "application/json");
  });
});
