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
import { err, ok } from "@breadboard-ai/utils";

export { composeFileSystemBackends };

function composeFileSystemBackends(
  backends: Map<string, PersistentBackend>
): PersistentBackend {
  return new ComposedPersistentBackend(backends);
}

/**
 * Takes a map of backends and routes between them using the first path
 * segment after the root folder as the name of the volume:
 *
 * For path `/mnt/<volume>/foo`, the backend named `<volume>` will be fished
 * out of the map and passed the operation along.
 */
class ComposedPersistentBackend implements PersistentBackend {
  constructor(
    public readonly backends: ReadonlyMap<string, PersistentBackend>
  ) {}

  #getBackend(path: FileSystemPath): Outcome<PersistentBackend> {
    const [, root, volume] = path.split("/");
    if (root !== "mnt") {
      return err(
        `Invalid path "${path}": All paths in mounted backends must start with "/mnt"`
      );
    }
    const backend = this.backends.get(volume);
    if (!backend) {
      return err(`Invalid path "${path}": Volume "${volume}" is not mounted`);
    }
    return backend;
  }

  async query(
    graphUrl: string,
    path: FileSystemPath
  ): Promise<FileSystemQueryResult> {
    const backend = this.#getBackend(path);
    if (!ok(backend)) return backend;
    return backend.query(graphUrl, path);
  }

  async read(
    graphUrl: string,
    path: FileSystemPath,
    inflate: boolean
  ): Promise<Outcome<LLMContent[]>> {
    const backend = this.#getBackend(path);
    if (!ok(backend)) return backend;
    return backend.read(graphUrl, path, inflate);
  }

  async write(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const backend = this.#getBackend(path);
    if (!ok(backend)) return backend;
    return backend.write(graphUrl, path, data);
  }

  async append(
    graphUrl: string,
    path: FileSystemPath,
    data: LLMContent[]
  ): Promise<FileSystemWriteResult> {
    const backend = this.#getBackend(path);
    if (!ok(backend)) return backend;
    return backend.append(graphUrl, path, data);
  }

  async delete(
    graphUrl: string,
    path: FileSystemPath,
    all: boolean
  ): Promise<FileSystemWriteResult> {
    const backend = this.#getBackend(path);
    if (!ok(backend)) return backend;
    return backend.delete(graphUrl, path, all);
  }

  async copy(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    const sourceBackend = this.#getBackend(source);
    if (!ok(sourceBackend)) return sourceBackend;

    const destinationBackend = this.#getBackend(destination);
    if (!ok(destinationBackend)) return destinationBackend;

    if (sourceBackend !== destinationBackend) {
      return err(`Unable to copy between different backends`);
    }
    return sourceBackend.copy(graphUrl, source, destination);
  }

  async move(
    graphUrl: string,
    source: FileSystemPath,
    destination: FileSystemPath
  ): Promise<FileSystemWriteResult> {
    const sourceBackend = this.#getBackend(source);
    if (!ok(sourceBackend)) return sourceBackend;

    const destinationBackend = this.#getBackend(destination);
    if (!ok(destinationBackend)) return destinationBackend;

    if (sourceBackend !== destinationBackend) {
      return err(`Unable to copy between different backends`);
    }
    return sourceBackend.move(graphUrl, source, destination);
  }
}
