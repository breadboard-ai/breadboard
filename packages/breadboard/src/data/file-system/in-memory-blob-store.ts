/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { toInlineDataPart, toStoredDataPart } from "../common.js";
import {
  FileSystemBlobStore,
  FileSystemBlobTransform,
  FileSystemPath,
  Outcome,
} from "../types.js";

export { InMemoryBlobStore };

class InMemoryBlobStore implements FileSystemBlobStore {
  handles: Map<FileSystemPath, string[]> = new Map();

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

  async delete(
    path: FileSystemPath,
    { all = false }: { all?: boolean } = {}
  ): Promise<Outcome<void>> {
    if (all) {
      [...this.handles.keys()]
        .filter((path) => path.startsWith(path))
        .forEach((path) => {
          this.#deleteHandlesForPath(path);
        });
    } else {
      this.#deleteHandlesForPath(path);
    }
  }

  inflator(): FileSystemBlobTransform {
    return {
      transform: async (_, part) => {
        if ("storedData" in part) {
          return toInlineDataPart(part);
        }
        return part;
      },
    };
  }

  deflator(): FileSystemBlobTransform {
    return {
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

  async close(): Promise<void> {
    [...this.handles.keys()].forEach((path) => {
      this.#deleteHandlesForPath(path);
    });
  }
}
