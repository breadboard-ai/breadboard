/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ParticleOperation } from "@breadboard-ai/particles";
import { FileSystem, FileSystemPath } from "@breadboard-ai/types";
import { ok } from "@breadboard-ai/utils";
import { toJson } from "../common";

export { ParticleOperationReader };

class ParticleOperationReaderIterator
  implements AsyncIterator<ParticleOperation>
{
  #started = false;

  constructor(
    private readonly path: FileSystemPath,
    private readonly fileSystem: FileSystem
  ) {}

  async #start(path: FileSystemPath) {
    const readingStart = await this.fileSystem.read({ path });
    if (!ok(readingStart)) {
      console.warn(
        `Failed to read start of streamable report`,
        readingStart.$error
      );
      return;
    }
    if (toJson(readingStart.data) !== "start") {
      console.warn(
        `Invalid start sequence of streamable report`,
        readingStart.data
      );
      return;
    }
  }

  #end(): IteratorResult<ParticleOperation> {
    return {
      done: true,
      value: null,
    };
  }

  async next(): Promise<IteratorResult<ParticleOperation>> {
    if (!this.#started) {
      this.#started = true;
      await this.#start(this.path);
    }
    const reading = await this.fileSystem.read({ path: this.path });
    if (!ok(reading)) {
      console.warn(`Failed to read from streamable report`, reading.$error);
      throw new Error(reading.$error);
    }
    if ("done" in reading && reading.done) {
      return this.#end();
    }
    const operation = toJson(reading.data) as ParticleOperation;
    return {
      done: false,
      value: operation,
    };
  }
}

class ParticleOperationReader implements AsyncIterable<ParticleOperation> {
  path: FileSystemPath;

  [Symbol.asyncIterator](): AsyncIterator<ParticleOperation> {
    return new ParticleOperationReaderIterator(this.path, this.fileSystem);
  }

  constructor(
    private readonly fileSystem: FileSystem,
    path: string
  ) {
    this.path = path as FileSystemPath;
  }
}
