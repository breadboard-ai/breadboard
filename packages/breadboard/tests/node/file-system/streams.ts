/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, it } from "node:test";
import { FileSystemImpl } from "../../../src/data/file-system/index.js";
import { deepStrictEqual, ok } from "node:assert";

import { LLMContent } from "@breadboard-ai/types";
import {
  Outcome,
  FileSystemEntry,
  FileSystemQueryResult,
} from "../../../src/data/types.js";

function good<T>(o: Outcome<T>): o is T {
  const error = o && typeof o === "object" && "$error" in o && o.$error;
  ok(!error, error as string);
  return !error;
}

function bad<T>(o: Outcome<T>) {
  ok(o && typeof o === "object" && "$error" in o, "outcome must be an error");
}

function makeFs(env: FileSystemEntry[] = [], assets: FileSystemEntry[] = []) {
  return new FileSystemImpl({ env, assets });
}

function makeCx(...items: string[]): LLMContent[] {
  return items.map((text) => ({ parts: [{ text }] }));
}

function justPaths(q: FileSystemQueryResult) {
  return good(q) && q.entries.map((entry) => entry.path);
}

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
      await fs.write({ path: "/tmp/foo", context: makeCx("foo"), stream: true })
    );
    const foo = await fs.read({ path: "/tmp/foo" });
    good(foo) && deepStrictEqual(foo.context, makeCx("foo"));
    await neverResolves(fs.read({ path: "/tmp/foo" }));

    good(
      await fs.write({
        path: "/tmp/bar",
        context: makeCx("bar1"),
        stream: true,
      })
    );
    good(
      await fs.write({
        path: "/tmp/bar",
        context: makeCx("bar2"),
        stream: true,
      })
    );
    good(await fs.write({ path: "/tmp/bar", stream: true, done: true }));

    const readBar1 = await fs.read({ path: "/tmp/bar" });
    good(readBar1) && deepStrictEqual(readBar1.context, makeCx("bar1"));
    const readBar2 = await fs.read({ path: "/tmp/bar" });
    good(readBar2) && deepStrictEqual(readBar2.context, makeCx("bar2"));
    const readEnd = await fs.read({ path: "/tmp/bar" });
    good(readEnd) && deepStrictEqual(readEnd.context, undefined);
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
        context: makeCx("foo"),
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
      await fs.write({ path: "/tmp/foo", context: makeCx("foo"), stream: true })
    );
    good(await fs.write({ path: "/tmp/foo", context: makeCx("bar") }));

    const readFoo = await fs.read({ path: "/tmp/foo" });
    good(readFoo) && deepStrictEqual(readFoo.context, makeCx("bar"));
  });

  it("handles trying to close non-streams", async () => {
    good(await fs.write({ path: "/tmp/foo", context: makeCx("bar") }));
    bad(await fs.write({ path: "/tmp/foo", stream: true, done: true }));
  });

  it("correctly reports inability to read partial streams", async () => {
    good(
      await fs.write({
        path: "/tmp/foo",
        context: makeCx("foo", "bar"),
        stream: true,
      })
    );
    bad(await fs.read({ path: "/tmp/foo", start: 1 }));
  });

  it("correctly reports inability to copy/move stream files", async () => {
    good(
      await fs.write({ path: "/tmp/foo", context: makeCx("bar"), stream: true })
    );
    bad(await fs.write({ path: "/tmp/bar", source: "/tmp/foo" }));
  });
});
