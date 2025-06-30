/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { Path } from "../../../src/file-system/path.js";
import { ok } from "assert";
import type { FileSystemPath, Outcome } from "@breadboard-ai/types";

function pathify(s: string): FileSystemPath {
  return s as FileSystemPath;
}

function good<T>(o: Outcome<T>): T {
  ok(!(o && typeof o === "object" && "$error" in o));
  return o;
}

function bad<T extends object>(o: Outcome<T>) {
  ok(o && typeof o === "object" && "$error" in o);
}

describe("FileSystem Path", () => {
  it("validates path on instantiation", () => {
    good(Path.create("/env/"));
    good(Path.create(pathify("/env/foo")));
    good(Path.create(pathify("/env/foo/")));
    bad(Path.create(pathify("/env/foo//bar")));
    bad(Path.create(pathify("env")));
    bad(Path.create(pathify("/foo/")));
    bad(Path.create(pathify("/env")));
  });

  it("correctly reports writable and not writable dirs", () => {
    {
      const path = good(Path.create("/env/foo"));
      ok(!path.writable);
    }
    {
      const path = good(Path.create("/run/foo"));
      ok(path.writable);
    }
  });

  it("correctly reports being a directory or no", () => {
    {
      const path = good(Path.create("/env/foo"));
      ok(!path.dir);
    }
    {
      const path = good(Path.create("/env/foo/"));
      ok(path.dir);
    }
    {
      const path = good(Path.create("/env/"));
      ok(path.dir);
    }
  });

  it("correctly reports persistent and transient dirs", () => {
    {
      const path = good(Path.create("/env/foo"));
      ok(!path.persistent);
    }
    {
      const path = good(Path.create("/run/foo"));
      ok(!path.persistent);
    }
    {
      const path = good(Path.create("/local/foo"));
      ok(path.persistent);
    }
  });
});
