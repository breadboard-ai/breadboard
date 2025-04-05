/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystem,
  FileSystemEntry,
  FileSystemQueryResult,
  FileSystemReadResult,
  FileSystemWriteResult,
  Outcome,
} from "../types.js";

export { StubFileSystem };

class StubFileSystem implements FileSystem {
  query(): Promise<FileSystemQueryResult> {
    throw new Error("Attempting to use stubbed-out file system.");
  }
  read(): Promise<FileSystemReadResult> {
    throw new Error("Attempting to use stubbed-out file system.");
  }
  write(): Promise<FileSystemWriteResult> {
    throw new Error("Attempting to use stubbed-out file system.");
  }
  addStream(): Promise<Outcome<void>> {
    throw new Error("Attempting to use stubbed-out file system.");
  }
  close(): Promise<void> {
    throw new Error("Attempting to use stubbed-out file system.");
  }
  createRunFileSystem(): FileSystem {
    throw new Error("Attempting to use stubbed-out file system.");
  }
  createModuleFileSystem(): FileSystem {
    throw new Error("Attempting to use stubbed-out file system.");
  }
  env(): FileSystemEntry[] {
    throw new Error("Attempting to use stubbed-out file system.");
  }
}
