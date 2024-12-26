/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  FileSystem,
  FileSystemPath,
  FileSystemQueryArguments,
  FileSystemQueryEntry,
  FileSystemQueryResult,
  FileSystemReadArguments,
  FileSystemEntry,
  FileSystemReadResult,
  FileSystemWriteArguments,
  FileSystemWriteResult,
  OuterFileSystems,
  Outcome,
} from "../types.js";
import { Path } from "./path.js";
import { err, ok } from "./utils.js";

export { FileSystemImpl, Path };

class File {
  constructor(public readonly context: LLMContent[]) {}

  result(): FileSystemReadResult {
    return {
      context: this.context,
      last: this.context.length - 1,
    };
  }

  queryEntry(path: FileSystemPath): FileSystemQueryEntry {
    return {
      path,
      length: this.context.length,
      stream: false,
    };
  }

  static fromEntry(entry: FileSystemEntry): File {
    return new File(entry.context);
  }

  static fromEntries(entries: FileSystemEntry[]): Map<FileSystemPath, File> {
    return new Map(entries.map((entry) => [entry.path, File.fromEntry(entry)]));
  }
}

class TreeNode {
  children = new Map<string, TreeNode>();

  constructor(public path: Path) {}
}

class Tree {
  #top: Map<string, TreeNode>;
  #writables: Set<string>;

  constructor() {
    this.#top = new Map();
    this.#writables = new Set();
    Path.createRoots().forEach((path) => {
      if (path.writable) {
        this.#writables.add(path.root);
      }
      this.#top.set(path.root, new TreeNode(path));
    });
  }
}

type FileMap = Map<FileSystemPath, File>;

class FileSystemImpl implements FileSystem {
  #files: FileMap = new Map();
  #env: FileMap;
  #assets: FileMap;

  constructor(outer: OuterFileSystems) {
    this.#env = File.fromEntries(outer.env);
    this.#assets = File.fromEntries(outer.assets);
  }

  async query({
    path,
  }: FileSystemQueryArguments): Promise<FileSystemQueryResult> {
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }
    const map = this.#getFileMap(parsedPath);
    if (!ok(map)) {
      return map;
    }
    return {
      entries: this.#startsWith(map, path),
    };
  }

  #getFileMap(parsedPath: Path): Outcome<FileMap> {
    if (parsedPath.root === "local") {
      return err(`Querying "${parsedPath.root}" is not yet implemented.`);
    } else if (parsedPath.root === "env") {
      return this.#env;
    } else if (parsedPath.root === "assets") {
      return this.#assets;
    } else {
      return this.#files;
    }
  }

  #startsWith(map: FileMap, prefix: FileSystemPath): FileSystemQueryEntry[] {
    const results: FileSystemQueryEntry[] = [];
    for (const [path, file] of map.entries()) {
      if (path.startsWith(prefix)) {
        results.push(file.queryEntry(path));
      }
    }
    return results;
  }

  async read({ path }: FileSystemReadArguments): Promise<FileSystemReadResult> {
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }
    const map = this.#getFileMap(parsedPath);
    if (!ok(map)) {
      return map;
    }
    const file = map.get(path);
    if (!file) {
      return err(`File not found: "${path}"`);
    }
    return file.result();
  }

  async write(args: FileSystemWriteArguments): Promise<FileSystemWriteResult> {
    const { path } = args;
    if ("source" in args) {
      return err("Copying/moving files is not yet implemented.");
    }
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }
    if (!parsedPath.writable) {
      return err(`Destination "${path}" is not writable`);
    }
    if (parsedPath.persistent) {
      return err(`Writing to "${parsedPath.root}" is not yet implemented`);
    }
    const { context } = args;
    if (context === null) {
      if (parsedPath.dir) {
        this.#deleteDir(path);
      }
      this.#files.delete(path);
      return;
    }
    if (parsedPath.dir) {
      return err(`Can't write data to a directory: "${path}"`);
    }
    this.#files.set(path, new File(context));
  }

  #deleteDir(path: FileSystemPath) {
    this.#startsWith(this.#files, path).forEach((entry) => {
      this.#files.delete(entry.path);
    });
  }

  startRun() {
    this.#deleteDir("/run/");
    this.startModule();
  }

  startModule() {
    this.#deleteDir("/tmp/");
  }
}
