/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, it } from "node:test";
import { FileSystemImpl } from "../../../src/file-system/index.js";
import { deepStrictEqual, ok } from "node:assert";

import {
  bad,
  good,
  justPaths,
  makeCx,
  makeDataCx,
  makeFs,
} from "../test-file-system.js";

// Helper function to test that a promise never resolves
async function neverResolves(
  promise: Promise<unknown>,
  timeout = 100
): Promise<void> {
  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeout)
  );

  const result = await Promise.race([promise, timeoutPromise]);
  ok(result === "timeout");
}

describe("FileSystem stream files", () => {
  let fs: FileSystemImpl;

  beforeEach(() => {
    fs = makeFs();
  });

  afterEach(async () => {
    await fs.close();
  });

  it("can create, write to, and read from stream files", async () => {
    good(
      await fs.write({ path: "/tmp/foo", data: makeCx("foo"), stream: true })
    );
    const foo = await fs.read({ path: "/tmp/foo" });
    good(foo) && deepStrictEqual(foo.data, makeCx("foo"));
    await neverResolves(fs.read({ path: "/tmp/foo" }));

    good(
      await fs.write({
        path: "/tmp/bar",
        data: makeCx("bar1"),
        stream: true,
      })
    );
    good(
      await fs.write({
        path: "/tmp/bar",
        data: makeCx("bar2"),
        stream: true,
      })
    );
    good(await fs.write({ path: "/tmp/bar", stream: true, done: true }));

    const readBar1 = await fs.read({ path: "/tmp/bar" });
    good(readBar1) && deepStrictEqual(readBar1.data, makeCx("bar1"));
    const readBar2 = await fs.read({ path: "/tmp/bar" });
    good(readBar2) && deepStrictEqual(readBar2.data, makeCx("bar2"));
    const readEnd = await fs.read({ path: "/tmp/bar" });
    good(readEnd) && deepStrictEqual(readEnd.data, undefined);
    const list = await fs.query({ path: "/tmp/ " });
    good(list) && deepStrictEqual(justPaths(list), []);
    const readMore = await fs.read({ path: "/tmp/bar" });
    bad(readMore);
  });

  it("handles write with receipt", async () => {
    const results: string[] = [];

    const write = async () => {
      await fs.write({
        path: "/tmp/foo",
        data: makeCx("foo"),
        stream: true,
        receipt: true,
      });
      results.push("write");
    };

    const read = async () => {
      await fs.read({ path: "/tmp/foo" });
      results.push("read");
    };
    await Promise.all([write(), read()]);
    deepStrictEqual(results, ["read", "write"]);
  });

  it("handles subsequent writes without the stream flag", async () => {
    good(
      await fs.write({ path: "/tmp/foo", data: makeCx("foo"), stream: true })
    );
    good(await fs.write({ path: "/tmp/foo", data: makeCx("bar") }));

    const readFoo = await fs.read({ path: "/tmp/foo" });
    good(readFoo) && deepStrictEqual(readFoo.data, makeCx("bar"));
  });

  it("handles trying to close non-streams", async () => {
    good(await fs.write({ path: "/tmp/foo", data: makeCx("bar") }));
    bad(await fs.write({ path: "/tmp/foo", stream: true, done: true }));
  });

  it("correctly reports inability to read partial streams", async () => {
    good(
      await fs.write({
        path: "/tmp/foo",
        data: makeCx("foo", "bar"),
        stream: true,
      })
    );
    bad(await fs.read({ path: "/tmp/foo", start: 1 }));
  });

  it("correctly reports inability to copy/move stream files", async () => {
    good(
      await fs.write({ path: "/tmp/foo", data: makeCx("bar"), stream: true })
    );
    bad(await fs.write({ path: "/tmp/bar", source: "/tmp/foo" }));
  });

  it("deflates stream data", async () => {
    good(
      await fs.write({
        path: "/tmp/bar",
        data: makeDataCx(["bar1"]),
        stream: true,
      })
    );
    const readBar1 = await fs.read({ path: "/tmp/bar" });
    if (good(readBar1)) {
      const part = readBar1.data?.at(0)?.parts?.at(0);
      ok(part && "storedData" in part);
    }
  });
});
