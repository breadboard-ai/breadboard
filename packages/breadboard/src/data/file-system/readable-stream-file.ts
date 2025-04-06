/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  FileSystemFile,
  FileSystemPath,
  FileSystemQueryEntry,
  FileSystemReadResult,
  FileSystemWriteResult,
  Outcome,
} from "../types.js";
import { err } from "./utils.js";

export { ReadableStreamFile };

class ReadableStreamFile implements FileSystemFile {
  readonly data: LLMContent[] = [];

  constructor(public readonly stream: ReadableStream<LLMContent>) {}

  async read(_inflate: boolean, start?: number): Promise<FileSystemReadResult> {
    if (start !== undefined && start !== 0) {
      return err(`Reading partial streams is not supported.`);
    }

    const reader = this.stream.getReader();
    try {
      const { value, done } = await reader.read();
      return { data: value ? [value] : [], done };
    } catch (e) {
      const error = e as Error;
      if (error.name === "AbortError") {
        return err(`Run stopped`);
      }
      return err(`Unable to read stream: ${(e as Error).message}`);
    } finally {
      reader.releaseLock();
    }
  }

  async append(): Promise<Outcome<void>> {
    return err(`Can't write to a read-only stream`);
  }

  copy(): Outcome<FileSystemFile> {
    return err(`Copying read-only streams is not supported`);
  }

  queryEntry(path: FileSystemPath): FileSystemQueryEntry {
    return { path, length: 0, stream: true };
  }

  async delete(): Promise<FileSystemWriteResult> {
    this.stream.cancel().catch(() => {});
  }
}
