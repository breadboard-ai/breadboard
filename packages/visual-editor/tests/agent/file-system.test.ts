/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { AgentFileSystem } from "../../src/a2/agent/file-system.js";
import { stubMemoryManager, stubModuleArgs } from "../useful-stubs.js";
import { err, ok } from "@breadboard-ai/utils/outcome.js";
import { deepStrictEqual, fail, ok as success } from "node:assert";

describe("Agent File System", () => {
  it("handles existing system files", async () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });
    fileSystem.addSystemFile("/vfs/system/foo", () => "foo");
    const file = await fileSystem.get("/vfs/system/foo");
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
    fileSystem.addSystemFile("/vfs/system/foo", () => "foo");
    const file = await fileSystem.get("/vfs/system/bar");
    if (!ok(file)) {
      success(file.$error);
      return;
    }
    fail(`File "/vfs/system/baz" should not have been found`);
  });

  it("handles failure to get a system file", async () => {
    const fileSystem = new AgentFileSystem({
      context: stubModuleArgs.context,
      memoryManager: stubMemoryManager,
    });
    fileSystem.addSystemFile("/vfs/system/foo", () => err("Sorry"));
    const file = await fileSystem.get("/vfs/system/foo");
    if (!ok(file)) {
      success(file.$error);
      return;
    }
    fail(`File "/vfs/system/foo" should not have been found`);
  });
});
