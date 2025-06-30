/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FileSystemBlobStore,
  FileSystemBlobTransform,
  FileSystemPath,
  Outcome,
} from "@breadboard-ai/types";
import { toInlineDataPart, toStoredDataPart } from "@breadboard-ai/utils";

export { InMemoryBlobStore };

class InMemoryBlobStore implements FileSystemBlobStore {
  handles: Map<FileSystemPath, string[]> = new Map();
  #inflator: FileSystemBlobTransform;
  #deflator: FileSystemBlobTransform;

  constructor() {
    this.#inflator = {
      transform: async (_, part) => {
        if ("storedData" in part) {
          return toInlineDataPart(part);
        }
        return part;
      },
    };
    this.#deflator = {
      transform: async (path, part) => {
        if ("inlineData" in part) {
          const stored = await toStoredDataPart(part);
          this.#registerHandle(path, stored.storedData.handle);
          return stored;
        }
        return part;
      },
    };
  }

  #registerHandle(path: FileSystemPath, handle: string) {
    let pathHandles = this.handles.get(path);
    if (!pathHandles) {
      pathHandles = [];
      this.handles.set(path, pathHandles);
    }
    pathHandles.push(handle);
  }

  #deleteHandlesForPath(path: FileSystemPath) {
    const pathHandles = this.handles.get(path);
    if (pathHandles) {
      pathHandles.forEach((handle) => URL.revokeObjectURL(handle));
    }
    this.handles.delete(path);
  }

  async delete(): Promise<Outcome<void>> {
    // blobs are scoped to the session, so we don't ever delete
    // anything.
  }

  inflator(): FileSystemBlobTransform {
    return this.#inflator;
  }

  deflator(): FileSystemBlobTransform {
    return this.#deflator;
  }

  async copy(): Promise<Outcome<void>> {
    // a no op, there's nothing here to do.
  }

  async move(): Promise<Outcome<void>> {
    // a no op, there's nothing here to do.
  }

  async close(): Promise<void> {
    [...this.handles.keys()].forEach((path) => {
      this.#deleteHandlesForPath(path);
    });
  }
}
