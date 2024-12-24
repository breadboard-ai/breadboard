/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { FileSystemImpl } from "../../../src/data/file-system/index.js";
import { deepStrictEqual, ok } from "node:assert";
import { FileSystemReadWritePath } from "../../../src/index.js";

describe("File System", () => {
  it("reads and writes files", async () => {
    const fs = new FileSystemImpl();
    const writeResult = await fs.write({
      path: "/session/test",
      type: "text",
      data: "test",
    });
    ok(!writeResult);
    const readResult = await fs.read({
      path: "/session/test",
    });
    deepStrictEqual(readResult, { type: "text", data: "test" });
  });

  it("can delete files", async () => {
    const fs = new FileSystemImpl();
    const writeResult = await fs.write({
      path: "/session/test",
      type: "text",
      data: "test",
    });
    ok(!writeResult);
    const readResult = await fs.read({
      path: "/session/test",
    });
    deepStrictEqual(readResult, { type: "text", data: "test" });
    const deleteResult = await fs.write({
      path: "/session/test",
      type: "text",
      data: null,
    });
    ok(!deleteResult);
    const repeatReadResult = await fs.read({
      path: "/session/test",
    });
    ok("$error" in repeatReadResult);
  });

  it("has runtime check for readonly/invalid paths", async () => {
    const fs = new FileSystemImpl();
    const writeResult = await fs.write({
      // Force invalid value
      path: "/env/test" as unknown as FileSystemReadWritePath,
      type: "text",
      data: "test",
    });
    ok(writeResult && "$error" in writeResult);
  });
});
