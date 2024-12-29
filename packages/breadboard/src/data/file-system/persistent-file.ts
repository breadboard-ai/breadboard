/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  FileSystemFile,
  FileSystemPath,
  FileSystemQueryEntry,
  FileSystemQueryResult,
  FileSystemReadResult,
  Outcome,
  PersistentBackend,
} from "../types.js";
import { err, ok } from "./utils.js";

export { PersistentBackendImpl, PersistentFile };

class PersistentBackendImpl implements PersistentBackend {
  constructor() {}

  query(path: FileSystemPath): Promise<FileSystemQueryResult> {
    throw new Error("Method not implemented.");
  }
  get(path: FileSystemPath): Promise<FileSystemFile> {
    throw new Error("Method not implemented.");
  }

  async read(path: FileSystemPath): Promise<Outcome<LLMContent[]>> {
    return err(`Reading from persistent store is not yet implemented`);
  }
}

// TODO: Move to common
function readFromStart(
  path: FileSystemPath,
  data: LLMContent[] | undefined,
  start: number
): FileSystemReadResult {
  if (!data) {
    return err(`File at "${path}" is empty`);
  }

  if (start >= data.length) {
    return err(`Length of file is lesser than start "${start}"`);
  }
  return {
    context: data.slice(start),
    last: data.length - 1,
  };
}

class PersistentFile implements FileSystemFile {
  constructor(
    public readonly path: FileSystemPath,
    public readonly backend: PersistentBackend
  ) {}

  async read(start: number = 0): Promise<FileSystemReadResult> {
    const reading = await this.backend.read(this.path);
    if (!ok(reading)) {
      return reading;
    }
    return readFromStart(this.path, reading, start);
  }

  append(
    context: LLMContent[],
    done: boolean,
    receipt?: boolean
  ): Promise<Outcome<void>> {
    throw new Error("Method not implemented.");
  }

  copy(): Outcome<FileSystemFile> {
    throw new Error("Method not implemented.");
  }

  queryEntry(path: FileSystemPath): FileSystemQueryEntry {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  context: LLMContent[] = [];
}
