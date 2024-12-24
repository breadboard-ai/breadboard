/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystem,
  FileSystemPath,
  FileSystemQueryArguments,
  FileSystemQueryEntry,
  FileSystemQueryResult,
  FileSystemReadArguments,
  FileSystemReadResult,
  FileSystemWriteArguments,
  FileSystemWriteResult,
} from "../types.js";
import { Path } from "./path.js";
import { err, ok } from "./utils.js";

export { FileSystemImpl, Path };

class File {
  constructor(
    public readonly data: string,
    public readonly type: "text" | "data",
    public readonly mimeType?: string
  ) {}

  result(): FileSystemReadResult {
    const type = this.type;
    if (type === "text") {
      return { type, data: this.data };
    }
    return {
      type,
      data: this.data,
      mimeType: this.mimeType!,
    };
  }

  queryEntry(path: FileSystemPath): FileSystemQueryEntry {
    const type = this.type;
    if (type === "text") {
      return { type, path };
    } else {
      return { type, path, mimeType: this.mimeType! };
    }
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

class FileSystemImpl implements FileSystem {
  #files: Map<FileSystemPath, File> = new Map();
  #tree = new Tree();

  async query({
    path,
  }: FileSystemQueryArguments): Promise<FileSystemQueryResult> {
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }
    if (parsedPath.persistent) {
      return err(`Querying "${parsedPath.root}" is not yet implemented.`);
    }
    return {
      entries: this.#startsWith(path),
    };
  }

  #startsWith(prefix: FileSystemPath): FileSystemQueryEntry[] {
    const results: FileSystemQueryEntry[] = [];
    for (const [path, file] of this.#files.entries()) {
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
    if (parsedPath.persistent) {
      return err(`Reading from "${parsedPath.root}" is not yet implemented`);
    }
    const file = this.#files.get(path);
    if (!file) {
      return err(`File not found: "${path}"`);
    }
    return file.result();
  }

  async write(args: FileSystemWriteArguments): Promise<FileSystemWriteResult> {
    const { path, data } = args;
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
    if (data === null) {
      if (parsedPath.dir) {
        this.#deleteDir(path);
      }
      this.#files.delete(path);
      return;
    }
    if (parsedPath.dir) {
      return err(`Can't write data to a directory: "${path}"`);
    }
    const type = args.type;
    const mimeType = type === "text" ? undefined : args.mimeType;
    this.#files.set(path, new File(data, type, mimeType));
  }

  #deleteDir(path: FileSystemPath) {
    this.#startsWith(path).forEach((entry) => {
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
