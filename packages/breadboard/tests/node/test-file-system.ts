/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import { FileSystemImpl } from "../../src/data/file-system/index.js";
import {
  FileSystemEntry,
  FileSystemPath,
  FileSystemQueryResult,
  PersistentBackend,
  Outcome,
  FileSystemReadResult,
} from "../../src/data/types.js";
import { deepStrictEqual, fail, ok } from "node:assert";
import { PersistentFile } from "../../src/data/file-system/persistent-file.js";
import { err } from "../../src/data/file-system/utils.js";

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
  const map = new Map<FileSystemPath, LLMContent[]>();
  // Add dummy file.
  map.set("/local/dummy", makeCx("dummy"));
  map.set("/local/dummy2", makeCx("dummy1", "dummy2"));

  const local: PersistentBackend = {
    query: async (startWith) => {
      {
        return {
          entries: [...map.entries()]
            .filter(([path]) => {
              return path.startsWith(startWith);
            })
            .map(([path, entry]) => {
              return { path, length: entry.length, stream: false };
            }),
        };
      }
    },
    read: async (path) => {
      const entry = map.get(path);
      if (!entry) {
        return err(`File ${path} not found`);
      }
      return entry;
    },
    get: async (path) => {
      return new PersistentFile(path, local);
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
