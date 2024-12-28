/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { FileSystemImpl } from "../../../src/data/file-system/index.js";
import { deepStrictEqual, fail, ok } from "node:assert";
import {
  FileSystemReadWritePath,
  Outcome,
  FileSystemEntry,
  FileSystemQueryResult,
  FileSystemReadResult,
} from "../../../src/data/types.js";
import { LLMContent } from "@breadboard-ai/types";

function good<T>(o: Outcome<T>): o is T {
  const error = o && typeof o === "object" && "$error" in o;
  ok(!error, "outcome must not be an error");
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

function last(result: FileSystemReadResult, last: number) {
  if (!("last" in result)) {
    fail("Last must be present in `FileSystemReadResult`");
  }
  deepStrictEqual(result.last, last);
}

describe("File System", () => {
  it("reads and writes files", async () => {
    const context = makeCx("test");
    const fs = makeFs();
    const writeResult = await fs.write({
      path: "/session/test",
      context,
    });
    ok(!writeResult);
    const readResult = await fs.read({
      path: "/session/test",
    });
    if (good(readResult)) {
      deepStrictEqual(readResult.context, context);
    }
  });

  it("can delete files", async () => {
    const fs = makeFs();
    const context = makeCx("test");
    const writeResult = await fs.write({
      path: "/session/test",
      context,
    });
    good(writeResult);
    const readResult = await fs.read({
      path: "/session/test",
    });
    if (good(readResult)) {
      deepStrictEqual(readResult.context, context);
    }
    const deleteResult = await fs.write({
      path: "/session/test",
      context: null,
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
      context: makeCx("test"),
    });
    ok(writeResult && "$error" in writeResult);
  });

  it("can delete entire directories", async () => {
    const fs = makeFs();
    const fooContext = makeCx("foo context");
    const barContext = makeCx("bar context");
    good(
      await fs.write({
        path: "/session/test/foo",
        context: fooContext,
      })
    );
    good(
      await fs.write({
        path: "/session/test/bar",
        context: barContext,
      })
    );
    const readingFoo = await fs.read({ path: "/session/test/foo" });
    if (good(readingFoo)) {
      deepStrictEqual(readingFoo.context, fooContext);
    }
    const readingBar = await fs.read({ path: "/session/test/bar" });
    if (good(readingBar)) {
      deepStrictEqual(readingBar.context, barContext);
    }
    good(await fs.write({ path: "/session/test/", context: null }));
    bad(await fs.read({ path: "/session/test/foo" }));
    bad(await fs.read({ path: "/session/test/bar" }));
  });

  it("does not allow writing data to dirs", async () => {
    const fs = makeFs();
    bad(
      await fs.write({
        path: "/session/test/",
        context: makeCx("hello"),
      })
    );
  });

  it("does not pass /tmp/ to new module", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/tmp/foo",
        context: makeCx("foo contents"),
      })
    );
    good(
      await fs.write({
        path: "/run/bar",
        context: makeCx("bar contents"),
      })
    );
    good(
      await fs.write({
        path: "/session/baz",
        context: makeCx("baz contents"),
      })
    );
    const moduleFs = fs.createModuleFileSystem();
    bad(await moduleFs.read({ path: "/tmp/foo" }));
    good(await moduleFs.read({ path: "/run/bar" }));
    good(await moduleFs.read({ path: "/session/baz" }));
  });

  it("does not pass /run/ to new run", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/tmp/foo",
        context: makeCx("foo contents"),
      })
    );
    good(
      await fs.write({
        path: "/run/bar",
        context: makeCx("bar contents"),
      })
    );
    good(
      await fs.write({
        path: "/session/baz",
        context: makeCx("baz contents"),
      })
    );
    const moduleFs = fs.createRunFileSystem();
    bad(await moduleFs.read({ path: "/tmp/foo" }));
    bad(await moduleFs.read({ path: "/run/bar" }));
    good(await moduleFs.read({ path: "/session/baz" }));
  });

  it("reads from env and assets", async () => {
    const foo = makeCx("foo");
    const bar = makeCx("bar");
    const fs = makeFs(
      [{ path: "/env/foo", context: foo }],
      [{ path: "/assets/bar", context: bar }]
    );
    const readFoo = await fs.read({ path: "/env/foo" });
    if (good(readFoo)) {
      deepStrictEqual(readFoo.context, foo);
    }
    const readBar = await fs.read({ path: "/assets/bar" });
    if (good(readBar)) {
      deepStrictEqual(readBar.context, bar);
    }
  });

  it("queries env and assets", async () => {
    const fs = makeFs(
      [{ path: "/env/foo", context: makeCx("foo") }],
      [{ path: "/assets/bar", context: makeCx("bar") }]
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
        context: makeCx("foo contents"),
      })
    );
    good(
      await fs.write({
        path: "/run/bar",
        context: makeCx("bar contents"),
      })
    );
    good(
      await fs.write({
        path: "/session/baz",
        context: makeCx("baz contents"),
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
        context: makeCx("foo1", "foo2", "foo3"),
      })
    );
    const readZero = await fs.read({ path: "/tmp/foo", start: 0 });
    if (good(readZero)) {
      deepStrictEqual(readZero.context, makeCx("foo1", "foo2", "foo3"));
      last(readZero, 2);
    }
    const readOne = await fs.read({ path: "/tmp/foo", start: 1 });
    if (good(readOne)) {
      deepStrictEqual(readOne.context, makeCx("foo2", "foo3"));
      last(readOne, 2);
    }
    const readTwo = await fs.read({ path: "/tmp/foo", start: 2 });
    if (good(readTwo)) {
      deepStrictEqual(readTwo.context, makeCx("foo3"));
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
        context: makeCx("foo1", "foo2", "foo3"),
      })
    );
    good(
      await fs.write({
        path: "/tmp/foo",
        append: true,
        context: makeCx("foo4"),
      })
    );
    const readBack = await fs.read({ path: "/tmp/foo" });
    if (good(readBack)) {
      deepStrictEqual(readBack.context, makeCx("foo1", "foo2", "foo3", "foo4"));
      last(readBack, 3);
    }
  });

  it("supports copy", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/session/bar",
        context: makeCx("foo1", "foo2", "foo3"),
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
      deepStrictEqual(readBack.context, makeCx("foo1", "foo2", "foo3"));
      last(readBack, 2);
    }
    const readCopy = await fs.read({ path: "/tmp/foo" });
    if (good(readCopy)) {
      deepStrictEqual(readCopy.context, makeCx("foo1", "foo2", "foo3"));
      last(readCopy, 2);
    }
  });

  it("supports move", async () => {
    const fs = makeFs();
    good(
      await fs.write({
        path: "/session/bar",
        context: makeCx("foo1", "foo2", "foo3"),
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
      deepStrictEqual(readCopy.context, makeCx("foo1", "foo2", "foo3"));
      last(readCopy, 2);
    }
  });
});
