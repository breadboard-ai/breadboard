/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, it } from "node:test";
import { FileSystemImpl } from "../../../src/data/file-system/index.js";
import { deepStrictEqual } from "node:assert";

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

  it("is able to write data to backend", async () => {
    const foo = makeCx("foo");
    good(await fs.write({ path: "/local/foo", context: foo }));
    const readFoo = await fs.read({ path: "/local/foo" });
    good(readFoo) && deepStrictEqual(readFoo.context, foo);

    const bar = makeCx("bar");
    good(await fs.write({ path: "/local/foo", context: bar, append: true }));
    const readBar = await fs.read({ path: "/local/foo", start: 1 });
    good(readBar) && deepStrictEqual(readBar.context, bar);
  });

  it("is able to delete files/dirs in backend", async () => {
    good(await fs.write({ path: "/local/dummy", context: null }));
    bad(await fs.read({ path: "/local/dummy" }));

    const foo = makeCx("foo");
    good(await fs.write({ path: "/local/foo/1", context: foo }));
    good(await fs.write({ path: "/local/foo/2", context: foo }));
    good(await fs.write({ path: "/local/foo/3", context: foo }));
    const listFoo = await fs.query({ path: "/local/foo/" });
    good(listFoo) &&
      deepStrictEqual(justPaths(listFoo), [
        "/local/foo/1",
        "/local/foo/2",
        "/local/foo/3",
      ]);

    good(await fs.write({ path: "/local/foo/", context: null }));

    const listFooAgain = await fs.query({ path: "/local/foo/" });
    good(listFooAgain) && deepStrictEqual(justPaths(listFooAgain), []);
  });

  it("is able to copy files in backend", async () => {
    // 1) From persistent to persistent
    good(await fs.write({ path: "/local/foo", source: "/local/dummy" }));
    const readFoo = await fs.read({ path: "/local/foo" });
    good(readFoo) && deepStrictEqual(readFoo.context, makeCx("dummy"));
    // 2) From persistent to ephemeral
    good(await fs.write({ path: "/tmp/bar", source: "/local/dummy" }));
    const readBar = await fs.read({ path: "/tmp/bar" });
    good(readBar) && deepStrictEqual(readBar.context, makeCx("dummy"));
    // 3) From ephemeral to persistent
    good(await fs.write({ path: "/tmp/baz", context: makeCx("baz") }));
    good(await fs.write({ path: "/local/baz", source: "/tmp/baz" }));
    const readBaz = await fs.read({ path: "/local/baz" });
    good(readBaz) && deepStrictEqual(readBaz.context, makeCx("baz"));
  });

  it("is able to move files in backend", async () => {
    // 1) From persistent to persistent
    good(
      await fs.write({ path: "/local/foo", source: "/local/dummy", move: true })
    );
    const readFoo = await fs.read({ path: "/local/foo" });
    good(readFoo) && deepStrictEqual(readFoo.context, makeCx("dummy"));
    bad(await fs.read({ path: "/local/dummy" }));
    // 2) From persistent to ephemeral
    good(
      await fs.write({ path: "/tmp/bar", source: "/local/dummy2", move: true })
    );
    const readBar = await fs.read({ path: "/tmp/bar" });
    good(readBar) &&
      deepStrictEqual(readBar.context, makeCx("dummy1", "dummy2"));
    bad(await fs.read({ path: "/local/dummy2" }));
    // 3) From ephemeral to persistent
    good(await fs.write({ path: "/tmp/baz", context: makeCx("baz") }));
    good(
      await fs.write({ path: "/local/baz", source: "/tmp/baz", move: true })
    );
    const readBaz = await fs.read({ path: "/local/baz" });
    good(readBaz) && deepStrictEqual(readBaz.context, makeCx("baz"));
    bad(await fs.read({ path: "/tmp/baz" }));
  });
});
