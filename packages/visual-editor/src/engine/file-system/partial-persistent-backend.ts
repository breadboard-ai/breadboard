/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileSystemPath,
  FileSystemQueryResult,
  FileSystemWriteResult,
  LLMContent,
  Outcome,
  PersistentBackend,
} from "@breadboard-ai/types";
import { err } from "@breadboard-ai/utils";

export { PartialPersistentBackend };

class PartialPersistentBackend implements PersistentBackend {
  constructor(private readonly backend: Partial<PersistentBackend>) {}

  async query(
    graphUrl: string,
    path: FileSystemPath
  ): Promise<FileSystemQueryResult> {
    const result = this.backend.query?.(graphUrl, path);
    if (!result) {
      return err(`Method "query" not implemented`);
    }
    return result;
  }

  async read(
    graphUrl: string,
    path: FileSystemPath,
    inflate: boolean
  ): Promise<Outcome<LLMContent[]>> {
    const result = this.backend.read?.(graphUrl, path, inflate);
    if (!result) {
      return err(`Method "read" not implemented`);
    }
    return result;
  }

  async write(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const result = this.backend.write?.(graphUrl, path, data);
    if (!result) {
      return err(`Method "write" not implemented`);
    }
    return result;
  }

  async append(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const result = this.backend.append?.(graphUrl, path, data);
    if (!result) {
      return err(`Method "append" not implemented`);
    }
    return result;
  }

  async delete(
    graphUrl: string,
    path: FileSystemPath,
    all: boolean
  ): Promise<FileSystemWriteResult> {
    const result = this.backend.delete?.(graphUrl, path, all);
    if (!result) {
      return err(`Method "delete" not implemented`);
    }
    return result;
  }

  async copy(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    const result = this.backend.copy?.(graphUrl, source, destination);
    if (!result) {
      return err(`Method "copy" not implemented`);
    }
    return result;
  }

  async move(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    const result = this.backend.move?.(graphUrl, source, destination);
    if (!result) {
      return err(`Method "move" not implemented`);
    }
    return result;
  }

  async onEndRun(): Promise<void> {
    return this.backend.onEndRun?.();
  }
}
