/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { FileSystemImpl } from "../../../src/data/file-system/index.js";
import { deepStrictEqual, ok } from "node:assert";
import {
  FileSystemReadWritePath,
  Outcome,
  FileSystemEntry,
  FileSystemQueryResult,
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

function makeCx(text: string): LLMContent[] {
  return [{ parts: [{ text }] }];
}

function justPaths(q: FileSystemQueryResult) {
  return good(q) && q.entries.map((entry) => entry.path);
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

  it("cleans up /tmp/", async () => {
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
    fs.startModule();
    bad(await fs.read({ path: "/tmp/foo" }));
    good(await fs.read({ path: "/run/bar" }));
    good(await fs.read({ path: "/session/baz" }));
  });

  it("cleans up /run/", async () => {
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
    fs.startRun();
    bad(await fs.read({ path: "/tmp/foo" }));
    bad(await fs.read({ path: "/run/bar" }));
    good(await fs.read({ path: "/session/baz" }));
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
});
