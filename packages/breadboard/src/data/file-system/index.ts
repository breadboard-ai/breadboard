/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystem,
  FileSystemPath,
  FileSystemQueryArguments,
  FileSystemQueryResult,
  FileSystemReadArguments,
  FileSystemReadResult,
  FileSystemWriteArguments,
  FileSystemWriteResult,
  Outcome,
} from "../types.js";
import { Path } from "./path.js";
import { ok } from "./utils.js";

export { FileSystemImpl, Path };

class File {
  constructor(
    public readonly data: string,
    public readonly type: "text" | "binary",
    public readonly mimeType?: string
  ) {}

  result(): FileSystemReadResult {
    const type = this.type;
    if (type === "text") {
      return { type, data: this.data };
    }
    if (!this.mimeType) {
      return {
        $error: "File system integrity error: mimeType not set",
      };
    }
    return {
      type,
      data: this.data,
      mimeType: this.mimeType,
    };
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

  query({ path }: FileSystemQueryArguments): Promise<FileSystemQueryResult> {
    throw new Error("Method not implemented.");
  }

  async read({ path }: FileSystemReadArguments): Promise<FileSystemReadResult> {
    const file = this.#files.get(path);
    if (!file) {
      return { $error: `File not found: "${path}"` };
    }
    return file.result();
  }

  async write(args: FileSystemWriteArguments): Promise<FileSystemWriteResult> {
    const { path, data, type } = args;
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }
    if (!parsedPath.writable) {
      return {
        $error: `Destination "${path}" is not writable/`,
      };
    }
    if (data === null) {
      this.#files.delete(path);
      return;
    }
    const mimeType = type === "text" ? undefined : args.mimeType;
    this.#files.set(path, new File(data, type, mimeType));
  }

  startRun(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  startModule(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
