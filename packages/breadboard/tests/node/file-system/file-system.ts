/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { deepStrictEqual, ok } from "node:assert";
import type { FileSystemReadWritePath } from "@breadboard-ai/types";
import {
  bad,
  good,
  justPaths,
  last,
  makeCx,
  makeDataCx,
  makeFs,
} from "../test-file-system.js";

describe("File System", () => {
  it("reads and writes files", async () => {
    const data = makeCx("test");
    const fs = makeFs();
    const writeResult = await fs.write({
      path: "/session/test",
      data,
    });
    ok(!writeResult);
    const readResult = await fs.read({
      path: "/session/test",
    });
    if (good(readResult)) {
      deepStrictEqual(readResult.data, data);
    }
  });

  it("can delete files", async () => {
    const fs = makeFs();
    const data = makeCx("test");
    const writeResult = await fs.write({
      path: "/session/test",
      data,
    });
    good(writeResult);
    const readResult = await fs.read({
      path: "/session/test",
    });
    if (good(readResult)) {
      deepStrictEqual(readResult.data, data);
    }
    const deleteResult = await fs.write({
      path: "/session/test",
      delete: true,
    });
    good(deleteResult);
    const repeatReadResult = await fs.read({
      path: "/session/test",
    });
    bad(repeatReadResult);
  });

  it("has runtime check for readonly/invalid paths", async () => {
    const fs = makeFs();
    const writeResult = await fs.write({
      // Force invalid value
      path: "/env/test" as unknown as FileSystemReadWritePath,
      data: makeCx("test"),
    });
    ok(writeResult && "$error" in writeResult);
  });

  it("can delete entire directories", async () => {
    const fs = makeFs();
    const fooData = makeCx("foo data");
    const barData = makeCx("bar data");
    good(
      await fs.write({
        path: "/session/test/foo",
        data: fooData,
      })
    );
    good(
      await fs.write({
        path: "/session/test/bar",
        data: barData,
      })
    );
    const readingFoo = await fs.read({ path: "/session/test/foo" });
    if (good(readingFoo)) {
      deepStrictEqual(readingFoo.data, fooData);
    }
    const readingBar = await fs.read({ path: "/session/test/bar" });
    if (good(readingBar)) {
      deepStrictEqual(readingBar.data, barData);
    }
    good(await fs.write({ path: "/session/test/", delete: true }));
    bad(await fs.read({ path: "/session/test/foo" }));
    bad(await fs.read({ path: "/session/test/bar" }));
  });

  it("does not allow writing data to dirs", async () => {
    const fs = makeFs();
    bad(
      await fs.write({
        path: "/session/test/",
        data: makeCx("hello"),
      })
    );
  });

  it("does not pass /tmp/ to new module", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/tmp/foo",
        data: makeCx("foo contents"),
      })
    );
    good(
      await fs.write({
        path: "/run/bar",
        data: makeCx("bar contents"),
      })
    );
    good(
      await fs.write({
        path: "/session/baz",
        data: makeCx("baz contents"),
      })
    );
    const moduleFs = fs.createModuleFileSystem({
      graphUrl: "https://example.com/2",
      env: [],
    });
    bad(await moduleFs.read({ path: "/tmp/foo" }));
    good(await moduleFs.read({ path: "/run/bar" }));
    good(await moduleFs.read({ path: "/session/baz" }));
  });

  it("does not pass /run/ to new run", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/tmp/foo",
        data: makeCx("foo contents"),
      })
    );
    good(
      await fs.write({
        path: "/run/bar",
        data: makeCx("bar contents"),
      })
    );
    good(
      await fs.write({
        path: "/session/baz",
        data: makeCx("baz contents"),
      })
    );
    const moduleFs = fs.createRunFileSystem({
      graphUrl: "http://example.com/foo",
      env: [],
      assets: [],
    });
    bad(await moduleFs.read({ path: "/tmp/foo" }));
    bad(await moduleFs.read({ path: "/run/bar" }));
    good(await moduleFs.read({ path: "/session/baz" }));
  });

  it("reads from env and assets", async () => {
    const foo = makeCx("foo");
    const bar = makeCx("bar");
    const fs = makeFs(
      [{ path: "/env/foo", data: foo }],
      [{ path: "/assets/bar", data: bar }]
    );
    const readFoo = await fs.read({ path: "/env/foo" });
    if (good(readFoo)) {
      deepStrictEqual(readFoo.data, foo);
    }
    const readBar = await fs.read({ path: "/assets/bar" });
    if (good(readBar)) {
      deepStrictEqual(readBar.data, bar);
    }
  });

  it("queries env and assets", async () => {
    const fs = makeFs(
      [{ path: "/env/foo", data: makeCx("foo") }],
      [{ path: "/assets/bar", data: makeCx("bar") }]
    );
    const queryFoo = await fs.query({ path: "/env/foo" });
    if (good(queryFoo)) {
      deepStrictEqual(justPaths(queryFoo), ["/env/foo"]);
    }
    const queryBar = await fs.query({ path: "/assets/bar" });
    if (good(queryBar)) {
      deepStrictEqual(justPaths(queryBar), ["/assets/bar"]);
    }
  });

  it("queries files", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/tmp/foo",
        data: makeCx("foo contents"),
      })
    );
    good(
      await fs.write({
        path: "/run/bar",
        data: makeCx("bar contents"),
      })
    );
    good(
      await fs.write({
        path: "/session/baz",
        data: makeCx("baz contents"),
      })
    );
    const queryFoo = await fs.query({ path: "/tmp/foo" });
    if (good(queryFoo)) {
      deepStrictEqual(justPaths(queryFoo), ["/tmp/foo"]);
    }
    const queryBar = await fs.query({ path: "/run/bar" });
    if (good(queryBar)) {
      deepStrictEqual(justPaths(queryBar), ["/run/bar"]);
    }
    const queryBaz = await fs.query({ path: "/session/baz" });
    if (good(queryBaz)) {
      deepStrictEqual(justPaths(queryBaz), ["/session/baz"]);
    }
  });

  it("supports partial reads", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/tmp/foo",
        data: makeCx("foo1", "foo2", "foo3"),
      })
    );
    const readZero = await fs.read({ path: "/tmp/foo", start: 0 });
    if (good(readZero)) {
      deepStrictEqual(readZero.data, makeCx("foo1", "foo2", "foo3"));
      last(readZero, 2);
    }
    const readOne = await fs.read({ path: "/tmp/foo", start: 1 });
    if (good(readOne)) {
      deepStrictEqual(readOne.data, makeCx("foo2", "foo3"));
      last(readOne, 2);
    }
    const readTwo = await fs.read({ path: "/tmp/foo", start: 2 });
    if (good(readTwo)) {
      deepStrictEqual(readTwo.data, makeCx("foo3"));
      last(readTwo, 2);
    }
    const readThree = await fs.read({ path: "/tmp/foo", start: 3 });
    bad(readThree);
  });

  it("supports append", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/tmp/foo",
        data: makeCx("foo1", "foo2", "foo3"),
      })
    );
    good(
      await fs.write({
        path: "/tmp/foo",
        append: true,
        data: makeCx("foo4"),
      })
    );
    const readBack = await fs.read({ path: "/tmp/foo" });
    if (good(readBack)) {
      deepStrictEqual(readBack.data, makeCx("foo1", "foo2", "foo3", "foo4"));
      last(readBack, 3);
    }
  });

  it("supports copy", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/session/bar",
        data: makeCx("foo1", "foo2", "foo3"),
      })
    );
    good(
      await fs.write({
        path: "/tmp/foo",
        source: "/session/bar",
      })
    );
    const readBack = await fs.read({ path: "/session/bar" });
    if (good(readBack)) {
      deepStrictEqual(readBack.data, makeCx("foo1", "foo2", "foo3"));
      last(readBack, 2);
    }
    const readCopy = await fs.read({ path: "/tmp/foo" });
    if (good(readCopy)) {
      deepStrictEqual(readCopy.data, makeCx("foo1", "foo2", "foo3"));
      last(readCopy, 2);
    }
  });

  it("supports move", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/session/bar",
        data: makeCx("foo1", "foo2", "foo3"),
      })
    );
    good(
      await fs.write({
        path: "/tmp/foo",
        source: "/session/bar",
        move: true,
      })
    );
    const readBack = await fs.read({ path: "/session/bar" });
    bad(readBack);
    const readCopy = await fs.read({ path: "/tmp/foo" });
    if (good(readCopy)) {
      deepStrictEqual(readCopy.data, makeCx("foo1", "foo2", "foo3"));
      last(readCopy, 2);
    }
  });

  it("correctly deflates on write", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/session/bar",
        data: makeDataCx(["foo1"]),
      })
    );
    const readBack = await fs.read({ path: "/session/bar" });
    if (good(readBack)) {
      const part = readBack.data?.at(0)?.parts?.at(0);
      ok(part && "storedData" in part);
    }
  });

  it("correctly deflates on append", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/session/bar",
        data: makeCx("bar"),
      })
    );
    good(
      await fs.write({
        path: "/session/bar",
        data: makeDataCx(["barData"]),
        append: true,
      })
    );
    const readBack = await fs.read({ path: "/session/bar" });
    if (good(readBack)) {
      const part = readBack.data?.at(1)?.parts?.at(0);
      ok(part && "storedData" in part);
    }
  });

  it("can inflate on read", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/session/bar",
        data: makeDataCx(["foo"]),
      })
    );
    const readBack = await fs.read({ path: "/session/bar", inflate: true });
    good(readBack) && deepStrictEqual(readBack.data, makeDataCx(["foo"]));
  });
});
