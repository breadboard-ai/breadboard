/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DeepReadonly } from "@breadboard-ai/types";
import mime from "mime";

export { AgentFileSystem };

const KNOWN_TYPES = ["audio", "video", "image"];

export type FileDescriptor = {
  mimeType: string;
  data: string;
};

class AgentFileSystem {
  #fileCount = 0;

  #files: Map<string, FileDescriptor> = new Map();

  write(data: string, mimeType: string): string {
    const name = this.create(mimeType);
    this.#files.set(name, { data, mimeType });
    return name;
  }

  get files(): ReadonlyMap<string, DeepReadonly<FileDescriptor>> {
    return this.#files;
  }

  create(mimeType: string) {
    const name = this.#getName(mimeType);
    const ext = mime.getExtension(mimeType);
    return `/vfs/${name}${++this.#fileCount}.${ext}`;
  }

  #getName(mimeType: string) {
    const first = mimeType.split("/").at(0) || "";
    if (KNOWN_TYPES.includes(first)) return first;
    return "file";
  }
}
