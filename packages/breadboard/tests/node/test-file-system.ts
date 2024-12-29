/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { FileSystemImpl } from "../../src/data/file-system/index.js";
import {
  FileSystemFile,
  FileSystemEntry,
  FileSystemPath,
  FileSystemQueryResult,
  PersistentBackend,
  Outcome,
  FileSystemReadResult,
} from "../../src/data/types.js";
import { deepStrictEqual, fail, ok } from "node:assert";

export { good, bad, makeFs, makeCx, justPaths, last };

function bad<T>(o: Outcome<T>) {
  ok(o && typeof o === "object" && "$error" in o, "outcome must be an error");
}

function good<T>(o: Outcome<T>): o is T {
  const error = o && typeof o === "object" && "$error" in o && o.$error;
  ok(!error, error as string);
  return !error;
}

function makeFs(env: FileSystemEntry[] = [], assets: FileSystemEntry[] = []) {
  const local: PersistentBackend = {
    query: function (path: FileSystemPath): Promise<FileSystemQueryResult> {
      throw new Error("Function not implemented.");
    },
    get: function (path: FileSystemPath): Promise<FileSystemFile> {
      throw new Error("Function not implemented.");
    },
  };
  return new FileSystemImpl({ local, env, assets });
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
