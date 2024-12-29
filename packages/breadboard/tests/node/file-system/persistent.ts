/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, it } from "node:test";
import { FileSystemImpl } from "../../../src/data/file-system/index.js";
import { deepStrictEqual, ok } from "node:assert";

import { bad, good, justPaths, makeCx, makeFs } from "../test-file-system.js";

describe("FileSystem persistent store", () => {
  let fs: FileSystemImpl;

  beforeEach(() => {
    fs = makeFs();
  });

  afterEach(async () => {
    await fs.close();
  });

  it("is able to query backend", async () => {
    const list = await fs.query({ path: "/local/" });
    good(list) &&
      deepStrictEqual(justPaths(list), ["/local/dummy", "/local/dummy2"]);
    const dummy2 = await fs.query({ path: "/local/dummy2" });
    good(dummy2) && deepStrictEqual(justPaths(dummy2), ["/local/dummy2"]);
  });

  it("is able to read data from backend", async () => {
    const dummy = await fs.read({ path: "/local/dummy" });
    good(dummy) && deepStrictEqual(dummy.context, makeCx("dummy"));

    const dummy2 = await fs.read({ path: "/local/dummy2", start: 1 });
    good(dummy2) && deepStrictEqual(dummy2.context, makeCx("dummy2"));

    const nonExistent = await fs.read({ path: "/local/non-existent" });
    bad(nonExistent);
  });
});
