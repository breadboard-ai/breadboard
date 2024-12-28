/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  FileSystem,
  FileSystemFile,
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
  FileMap,
} from "../types.js";
import { Path } from "./path.js";
import { err, ok } from "./utils.js";

export { FileSystemImpl, Path };

class StreamFile implements FileSystemFile {
  readonly context = [];
  readable: ReadableStream<LLMContent[]>;
  writer: WritableStreamDefaultWriter<LLMContent[]> | null;

  constructor() {
    const { writable, readable } = new TransformStream<
      LLMContent[],
      LLMContent[]
    >();
    this.readable = readable;
    this.writer = writable.getWriter();
  }

  async read(start: number = 0): Promise<FileSystemReadResult> {
    if (start !== 0) {
      return err(`Reading partial streams is not supported.`);
    }

    const reader = this.readable.getReader();
    try {
      const { value, done } = await reader.read();
      return { context: value, done };
    } catch (e) {
      return err(`Unable to read stream: ${(e as Error).message}`);
    } finally {
      reader.releaseLock();
    }
  }

  async append(
    context: LLMContent[],
    done: boolean,
    receipt = false
  ): Promise<Outcome<void>> {
    if (!this.writer) {
      return err(`Unable to write to a closed stream`);
    }
    if (done) {
      this.writer.close();
      this.writer = null;
    } else if (receipt) {
      await this.writer.write(context);
    } else {
      this.writer.write(context);
    }
  }

  async delete() {
    if (!this.writer) return;

    this.writer.close().catch(() => {
      // eat errors
    });
    this.writer = null;
  }

  copy(): Outcome<FileSystemFile> {
    // create a tee: A an B
    // reassign the original stream to A
    // return B
    return err("Copy/move of stream files is not yet implemented");
  }

  queryEntry(path: FileSystemPath): FileSystemQueryEntry {
    return { path, length: 0, stream: true };
  }
}

class SimpleFile implements FileSystemFile {
  constructor(public readonly context: LLMContent[]) {}

  async read(start: number = 0): Promise<FileSystemReadResult> {
    if (start >= this.context.length) {
      return err(`Length of file is lesser than start "${start}"`);
    }
    return {
      context: this.context.slice(start),
      last: this.context.length - 1,
    };
  }

  async append(context: LLMContent[], done: boolean, receipt = false) {
    if (done || receipt) {
      return err("Can't close the file that isn't a stream");
    }
    this.context.push(...context);
  }

  async delete() {}

  copy(): Outcome<FileSystemFile> {
    return new SimpleFile(this.context);
  }

  queryEntry(path: FileSystemPath): FileSystemQueryEntry {
    return { path, length: this.context.length, stream: false };
  }

  static fromEntry(entry: FileSystemEntry): SimpleFile {
    return new SimpleFile(entry.context);
  }

  static fromEntries(
    entries: FileSystemEntry[]
  ): Map<FileSystemPath, SimpleFile> {
    return new Map(
      entries.map((entry) => [entry.path, SimpleFile.fromEntry(entry)])
    );
  }
}

class FileSystemImpl implements FileSystem {
  #session: FileMap;
  #run: FileMap;
  #tmp: FileMap;
  #env: FileMap;
  #assets: FileMap;
  #ownsSession: boolean;
  #ownsRun: boolean;

  constructor(outer: OuterFileSystems) {
    this.#env = SimpleFile.fromEntries(outer.env);
    this.#assets = SimpleFile.fromEntries(outer.assets);
    this.#ownsSession = !outer.session;
    this.#ownsRun = !outer.run;
    this.#session = outer.session ? outer.session : new Map();
    this.#run = outer.run ? outer.run : new Map();
    this.#tmp = new Map();
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

  async read({
    path,
    start,
  }: FileSystemReadArguments): Promise<FileSystemReadResult> {
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
    const result = await file.read(start);
    if (!ok(result)) {
      return result;
    }
    if ("done" in result) {
      const { done } = result;
      if (done) {
        // We are done with the stream, delete the file.
        this.#deleteFile(path);
      }
    }
    return result;
  }

  async write(args: FileSystemWriteArguments): Promise<FileSystemWriteResult> {
    const { path } = args;
    // 1) Let's do path validation
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

    // 2) Handle copy/move case
    if ("source" in args) {
      const { source, move } = args;
      const sourcePath = Path.create(source);
      if (!ok(sourcePath)) {
        return sourcePath;
      }
      const sourceMap = this.#getFileMap(sourcePath);
      if (!ok(sourceMap)) {
        return sourceMap;
      }
      const file = sourceMap.get(source);
      if (!file) {
        return err(`Source file not found: "${source}"`);
      }
      const copy = file.copy();
      if (!ok(copy)) {
        return copy;
      }
      const destinationMap = this.#getFileMap(parsedPath);
      if (!ok(destinationMap)) {
        return destinationMap;
      }
      destinationMap.set(path, copy);
      if (move) {
        sourceMap.delete(source);
      }
      return;
    }

    const map = this.#getFileMap(parsedPath);
    if (!ok(map)) {
      return map;
    }

    // 3) Handle stream case
    if ("stream" in args && args.stream) {
      let file = map.get(path);
      const { done } = args;
      if (done) {
        if (!file) {
          return err(`Can't close stream on a non-existent file "${path}"`);
        }
        // Handle end of stream.
        return file.append([], true);
      } else {
        if (!file) {
          file = new StreamFile();
          map.set(path, file);
        }
        const { receipt, context } = args;
        return file.append(context, false, receipt);
      }
    }

    const { context } = args;

    // 4) Handle delete case
    if (context === null) {
      if (parsedPath.dir) {
        this.#deleteDir(path);
      } else {
        this.#deleteFile(path);
      }
      return;
    }

    if (parsedPath.dir) {
      return err(`Can't write data to a directory: "${path}"`);
    }

    const { append } = args;

    // 5) Handle append case
    if (append) {
      const file = map.get(path);
      if (file) {
        return file.append(context, false);
      }
    }

    // 6) otherwise, fall through to create a new file
    const file = new SimpleFile(context);
    map.set(path, file);
  }

  #getFileMap(parsedPath: Path): Outcome<FileMap> {
    const { root } = parsedPath;
    switch (root) {
      case "local":
        return err(`Querying "${parsedPath.root}" is not yet implemented.`);
      case "env":
        return this.#env;
      case "assets":
        return this.#assets;
      case "session":
        return this.#session;
      case "run":
        return this.#run;
      case "tmp":
        return this.#tmp;
      default:
        return err(`Unknown root "${root}"`);
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

  #deleteFile(path: FileSystemPath) {
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }

    const map = this.#getFileMap(parsedPath);
    if (!ok(map)) {
      return map;
    }

    const file = map.get(path);
    if (!file) return;
    map.delete(path);
    // Async, but it's okay to not await here, because we don't need to wait
    // for cleanup to complete.
    file.delete().catch(() => {
      // Eat the errors.
    });
  }

  #deleteDir(path: FileSystemPath) {
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }

    const map = this.#getFileMap(parsedPath);
    if (!ok(map)) {
      return map;
    }

    const entries = this.#startsWith(map, path);
    for (const entry of entries) {
      this.#deleteFile(entry.path);
    }
  }

  async close(): Promise<void> {
    if (this.#ownsSession) {
      await deleteAll(this.#session);
    }
    if (this.#ownsRun) {
      await deleteAll(this.#run);
    }
    await deleteAll(this.#tmp);

    async function deleteAll(map: FileMap) {
      await Promise.all(
        [...map.values()].map((file) => {
          return file.delete();
        })
      );
    }
  }

  createModuleFileSystem(): FileSystem {
    return new FileSystemImpl({
      env: mapToEntries(this.#env),
      assets: mapToEntries(this.#assets),
      session: this.#session,
      run: this.#run,
    });
  }

  createRunFileSystem(): FileSystem {
    return new FileSystemImpl({
      env: mapToEntries(this.#env),
      assets: mapToEntries(this.#assets),
      session: this.#session,
    });
  }
}

function mapToEntries(map: FileMap): FileSystemEntry[] {
  return [...map.entries()].map(([path, file]) => ({
    path,
    context: file.context,
  }));
}
