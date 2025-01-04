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
  PersistentBackend,
  FileSystemBlobStore,
} from "../types.js";
import { Path } from "./path.js";
import { err, ok } from "./utils.js";
import { PersistentFile } from "./persistent-file.js";
import { InMemoryBlobStore } from "./in-memory-blob-store.js";
import { transformBlobs } from "./blob-transform.js";

export { FileSystemImpl, Path };

class StreamFile implements FileSystemFile {
  readonly data = [];
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
      return { data: value, done };
    } catch (e) {
      return err(`Unable to read stream: ${(e as Error).message}`);
    } finally {
      reader.releaseLock();
    }
  }

  async append(
    data: LLMContent[],
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
      await this.writer.write(data);
    } else {
      this.writer.write(data);
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
  constructor(public readonly data: LLMContent[]) {}

  async read(start: number = 0): Promise<FileSystemReadResult> {
    if (start >= this.data.length) {
      return err(`Length of file is lesser than start "${start}"`);
    }
    return {
      data: this.data.slice(start),
      last: this.data.length - 1,
    };
  }

  async append(data: LLMContent[], done: boolean, receipt = false) {
    if (done || receipt) {
      return err("Can't close the file that isn't a stream");
    }
    this.data.push(...data);
  }

  async delete() {}

  copy(): Outcome<FileSystemFile> {
    return new SimpleFile(this.data);
  }

  queryEntry(path: FileSystemPath): FileSystemQueryEntry {
    return { path, length: this.data.length, stream: false };
  }

  static fromEntry(entry: FileSystemEntry): SimpleFile {
    return new SimpleFile(entry.data);
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
  #local: PersistentBackend;
  #env: FileMap;
  #assets: FileMap;

  #blobs: FileSystemBlobStore;
  #ownsBlobs: boolean;

  #session: FileMap;
  #ownsSession: boolean;

  #run: FileMap;
  #ownsRun: boolean;

  #tmp: FileMap;

  constructor(outer: OuterFileSystems) {
    this.#local = outer.local;
    this.#env = SimpleFile.fromEntries(outer.env);
    this.#assets = SimpleFile.fromEntries(outer.assets);

    this.#ownsBlobs = !outer.blobs;
    this.#blobs = outer.blobs ? outer.blobs : new InMemoryBlobStore();

    this.#ownsSession = !outer.session;
    this.#session = outer.session ? outer.session : new Map();

    this.#ownsRun = !outer.run;
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

    if (parsedPath.persistent) {
      return this.#local.query(path);
    } else {
      const map = this.#getFileMap(parsedPath);
      if (!ok(map)) {
        return map;
      }
      return {
        entries: this.#startsWith(map, path),
      };
    }
  }

  async read({
    path,
    start,
    inflate,
  }: FileSystemReadArguments): Promise<FileSystemReadResult> {
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }

    let file: FileSystemFile | undefined;

    if (parsedPath.persistent) {
      file = new PersistentFile(path, this.#local);
    } else {
      const map = this.#getFileMap(parsedPath);
      if (!ok(map)) {
        return map;
      }
      file = map.get(path);
      if (!file) {
        return err(`File not found: "${path}"`);
      }
    }

    const result = await file.read(start);
    if (!ok(result)) {
      return result;
    }

    if (!parsedPath.persistent) {
      if ("done" in result) {
        // Handle end of stream.
        const { done } = result;
        if (done) {
          // We are done with the stream, delete the file.
          this.#deleteFile(path);
        }
      } else if (inflate && result.data) {
        // Handle inflating ephemeral data.
        const inflating = await transformBlobs(path, result.data, [
          this.#blobs.inflator(),
        ]);
        if (!ok(inflating)) {
          return inflating;
        }
        return { data: inflating, last: result.last };
      }
    } else if (inflate && result.data) {
      // Handle inflating persistent data.
      const inflating = await transformBlobs(path, result.data, [
        this.#local.blobs().inflator(),
      ]);
      if (!ok(inflating)) {
        return inflating;
      }
      return { ...result, data: inflating };
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

    // 2) Handle copy/move case
    if ("source" in args) {
      const { source, move } = args;
      const sourcePath = Path.create(source);
      if (!ok(sourcePath)) {
        return sourcePath;
      }

      if (parsedPath.persistent) {
        if (sourcePath.persistent) {
          // a) Persistent -> Persistent
          const copying = await this.#local.copy(source, path);
          if (!ok(copying)) {
            return copying;
          }
          if (move) {
            const deleting = await this.#local.delete(source, false);
            if (!ok(deleting)) {
              return deleting;
            }
            const movingBlobs = await this.#local.blobs().move(source, path);
            if (!ok(movingBlobs)) {
              return movingBlobs;
            }
          } else {
            const copyingBlobs = await this.#local.blobs().copy(source, path);
            if (!ok(copyingBlobs)) {
              return copyingBlobs;
            }
          }
          return;
        } else {
          // b) Ephemeral -> Persistent
          const sourceMap = this.#getFileMap(sourcePath);
          if (!ok(sourceMap)) {
            return sourceMap;
          }
          const file = sourceMap.get(source);
          if (!file) {
            return err(`Source file not found: "${source}"`);
          }

          const deflated = await transformBlobs(path, file.data, [
            this.#local.blobs().deflator(),
          ]);
          if (!ok(deflated)) {
            return deflated;
          }
          const writing = await this.#local.write(path, deflated);
          if (!ok(writing)) {
            return writing;
          }

          if (move) {
            sourceMap.delete(source);
          }
          return;
        }
      }

      if (sourcePath.persistent) {
        // c) Persistent -> Ephemeral
        const sourceFile = new PersistentFile(source, this.#local);
        const sourceContents = await sourceFile.read();
        if (!ok(sourceContents)) {
          return sourceContents;
        }

        const destinationMap = this.#getFileMap(parsedPath);
        if (!ok(destinationMap)) {
          return destinationMap;
        }
        if (!sourceContents.data) {
          return err(`Source file "${path}" is empty`);
        }
        destinationMap.set(path, new SimpleFile(sourceContents.data));
        return this.#local.delete(source, false);
      }

      // d) Ephemeral -> Ephemeral
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

    // 3) Handle stream case
    if ("stream" in args && args.stream) {
      if (parsedPath.persistent) {
        return err(
          `Creating streams in "${parsedPath.root}" is not yet supported`
        );
      }

      const map = this.#getFileMap(parsedPath);
      if (!ok(map)) {
        return map;
      }

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
        const { receipt, data } = args;
        const deflated = await transformBlobs(path, data, [
          this.#blobs.deflator(),
        ]);
        if (!ok(deflated)) {
          return deflated;
        }
        return file.append(deflated, false, receipt);
      }
    }

    // 4) Handle delete case
    if ("delete" in args) {
      if (parsedPath.dir) {
        await this.#deleteDir(path);
      } else {
        await this.#deleteFile(path);
      }
      return;
    }

    if (parsedPath.dir) {
      return err(`Can't write data to a directory: "${path}"`);
    }

    const { data, append } = args;

    // 5) Handle append case
    if (append) {
      if (parsedPath.persistent) {
        const deflated = await transformBlobs(path, data, [
          this.#local.blobs().deflator(),
        ]);
        if (!ok(deflated)) {
          return deflated;
        }
        return this.#local.append(path, deflated);
      }

      const map = this.#getFileMap(parsedPath);
      if (!ok(map)) {
        return map;
      }

      const file = map.get(path);
      if (file) {
        const deflated = await transformBlobs(path, data, [
          this.#blobs.deflator(),
        ]);
        if (!ok(deflated)) {
          return deflated;
        }
        return file.append(deflated, false);
      }
    }

    // 6) otherwise, fall through to create a new file
    if (parsedPath.persistent) {
      const deflated = await transformBlobs(path, data, [
        this.#local.blobs().deflator(),
      ]);
      if (!ok(deflated)) {
        return deflated;
      }
      return this.#local.write(path, deflated);
    } else {
      const deflated = await transformBlobs(path, data, [
        this.#blobs.deflator(),
      ]);
      if (!ok(deflated)) {
        return deflated;
      }
      const file = new SimpleFile(deflated);
      const map = this.#getFileMap(parsedPath);
      if (!ok(map)) {
        return map;
      }

      map.set(path, file);
    }
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
    if (parsedPath.persistent) {
      return this.#local.delete(path, false);
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

  async #deleteDir(path: FileSystemPath) {
    const parsedPath = Path.create(path);
    if (!ok(parsedPath)) {
      return parsedPath;
    }

    if (parsedPath.persistent) {
      await this.#local.delete(path, parsedPath.dir);
      return;
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

    if (this.#ownsBlobs) {
      await this.#blobs.close();
    }
  }

  createModuleFileSystem(): FileSystem {
    return new FileSystemImpl({
      local: this.#local,
      env: mapToEntries(this.#env),
      assets: mapToEntries(this.#assets),
      blobs: this.#blobs,
      session: this.#session,
      run: this.#run,
    });
  }

  createRunFileSystem(): FileSystem {
    return new FileSystemImpl({
      local: this.#local,
      env: mapToEntries(this.#env),
      assets: mapToEntries(this.#assets),
      blobs: this.#blobs,
      session: this.#session,
    });
  }
}

function mapToEntries(map: FileMap): FileSystemEntry[] {
  return [...map.entries()].map(([path, file]) => ({
    path,
    data: file.data,
  }));
}
