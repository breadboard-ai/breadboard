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

export { PersistentBackendImpl, PersistentFile };

class PersistentBackendImpl implements PersistentBackend {
  constructor() {}

  query(path: FileSystemPath): Promise<FileSystemQueryResult> {
    throw new Error("Method not implemented.");
  }
  get(path: FileSystemPath): Promise<FileSystemFile> {
    throw new Error("Method not implemented.");
  }
}

class PersistentFile implements FileSystemFile {
  read(start?: number): Promise<FileSystemReadResult> {
    throw new Error("Method not implemented.");
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
