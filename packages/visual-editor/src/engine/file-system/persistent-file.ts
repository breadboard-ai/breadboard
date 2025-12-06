/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileSystemFile,
  FileSystemPath,
  FileSystemQueryEntry,
  FileSystemReadResult,
  FileSystemWriteResult,
  LLMContent,
  Outcome,
  PersistentBackend,
} from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { noStreams, readFromStart } from "./utils.js";

export { PersistentFile };

class PersistentFile implements FileSystemFile {
  constructor(
    public readonly graphUrl: string,
    public readonly path: FileSystemPath,
    public readonly backend: PersistentBackend
  ) {}

  async read(
    inflate: boolean,
    start: number = 0
  ): Promise<FileSystemReadResult> {
    const reading = await this.backend.read(this.graphUrl, this.path, inflate);
    if (!ok(reading)) {
      return reading;
    }
    return readFromStart(this.path, reading, start);
  }

  async append(
    data: LLMContent[],
    done: boolean,
    receipt?: boolean
  ): Promise<FileSystemWriteResult> {
    const checkForStreams = noStreams(done, receipt);
    if (!ok(checkForStreams)) {
      return checkForStreams;
    }
    return this.backend.append(this.graphUrl, this.path, data);
  }

  copy(): Outcome<FileSystemFile> {
    throw new Error("Method not implemented.");
  }

  queryEntry(_path: FileSystemPath): FileSystemQueryEntry {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<FileSystemWriteResult> {
    throw new Error("Method not implemented.");
  }

  data: LLMContent[] = [];
}
