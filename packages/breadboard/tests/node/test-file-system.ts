/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileSystemEntry,
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemReadResult,
  InlineDataCapabilityPart,
  LLMContent,
  Outcome,
  PersistentBackend,
} from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";
import { deepStrictEqual, fail, ok } from "node:assert";
import { FileSystemImpl } from "../../src/file-system/index.js";

export { bad, good, inline, justPaths, last, makeCx, makeDataCx, makeFs };

function bad<T>(o: Outcome<T>) {
  ok(o && typeof o === "object" && "$error" in o, "outcome must be an error");
}

function good<T>(o: Outcome<T>): o is T {
  const error = o && typeof o === "object" && "$error" in o && o.$error;
  ok(!error, error as string);
  return !error;
}

function mockPersistentBackend(name: string): PersistentBackend {
  const map = new Map<FileSystemPath, LLMContent[]>();
  // Add dummy file.
  map.set(`/${name}/dummy` as FileSystemPath, makeCx("dummy"));
  map.set(`/${name}/dummy2` as FileSystemPath, makeCx("dummy1", "dummy2"));
  function startWith(prefix: FileSystemPath) {
    return [...map.entries()].filter(([path]) => {
      return path.startsWith(prefix);
    });
  }

  const backend: PersistentBackend = {
    query: async (_graph, path) => {
      {
        return {
          entries: startWith(path).map(([path, entry]) => {
            return { path, length: entry.length, stream: false };
          }),
        };
      }
    },
    read: async (_graph, path) => {
      const entry = map.get(path);
      if (!entry) {
        return err(`File "${path}" not found`);
      }
      return entry;
    },
    write: async (_graph, path, data) => {
      map.set(path, structuredClone(data));
    },
    append: async (_graph, path, data) => {
      const entry = map.get(path);
      if (entry) {
        entry.push(...data);
      } else {
        map.set(path, structuredClone(data));
      }
    },
    delete: async (_graph, path, all) => {
      if (all) {
        startWith(path).forEach(([path]) => {
          map.delete(path);
        });
      } else {
        map.delete(path);
      }
    },
    copy: async (_graph, source, destination) => {
      const entry = map.get(source);
      if (!entry) {
        return err(`Source "${source}" not found`);
      }
      map.set(destination, entry);
    },
    move: async (_graph, source, destination) => {
      const entry = map.get(source);
      if (!entry) {
        return err(`Source "${source}" not found`);
      }
      map.set(destination, entry);
      map.delete(source);
    },
  };
  return backend;
}

function makeFs(env: FileSystemEntry[] = [], assets: FileSystemEntry[] = []) {
  const local = mockPersistentBackend("local");
  const mnt = mockPersistentBackend("mnt");
  return new FileSystemImpl({
    graphUrl: "https://example.com/",
    local,
    mnt,
    env,
    assets,
  });
}

function makeCx(...items: string[]): LLMContent[] {
  return items.map((text) => ({ parts: [{ text }] }));
}

function inline(data: string): InlineDataCapabilityPart {
  return { inlineData: { data, mimeType: "text/plain" } };
}

function makeDataCx(...items: string[][]): LLMContent[] {
  return items.map((part) => ({
    parts: part.map((data) => inline(data)),
  }));
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
