/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataPart,
  DeepReadonly,
  FileDataPart,
  InlineDataCapabilityPart,
  Outcome,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import mime from "mime";

export { AgentFileSystem };

const KNOWN_TYPES = ["audio", "video", "image", "text"];

export type FileDescriptor = {
  type: "text" | "storedData" | "inlineData" | "fileData";
  mimeType: string;
  data: string;
  title?: string;
  resourceKey?: string;
};

export type AddFilesToFolioResult = {
  existing: string[];
  added: string[];
  error?: string;
};

class AgentFileSystem {
  #fileCount = 0;

  #folios: Map<string, Set<string>> = new Map();

  #files: Map<string, FileDescriptor> = new Map();

  write(data: string, mimeType: string): string {
    const name = this.create(mimeType);
    this.#files.set(name, { data, mimeType, type: "text" });
    return name;
  }

  #getFile(path: string): Outcome<DataPart> {
    const file = this.#files.get(path);
    if (!file) {
      return err(`file "${path}" not found`);
    }
    switch (file.type) {
      case "fileData":
        return {
          fileData: {
            fileUri: file.data,
            mimeType: file.mimeType,
            resourceKey: file.resourceKey,
          },
        } satisfies FileDataPart;
      case "inlineData":
        return {
          inlineData: {
            data: file.data,
            mimeType: file.mimeType,
            title: file.title,
          },
        } satisfies InlineDataCapabilityPart;
      case "storedData":
        return {
          storedData: {
            handle: file.data,
            mimeType: file.mimeType,
            resourceKey: file.resourceKey,
          },
        } satisfies StoredDataCapabilityPart;
      default:
      case "text":
        return {
          text: file.data,
        };
    }
  }

  #getFolioFiles(path: string): Outcome<DataPart[]> {
    const folio = this.#folios.get(path);
    if (!folio) {
      return err(`Folio "${folio}" not found`);
    }
    const errors: string[] = [];
    const files = [...folio].map((path) => {
      const file = this.#getFile(path);
      if (!ok(file)) {
        errors.push(file.$error);
      }
      return file;
    });
    if (errors.length > 0) {
      return err(errors.join(","));
    }
    return files as DataPart[];
  }

  get(path: string): Outcome<DataPart[]> {
    // Do a path fix-up just in case: sometimes, Gemini decides to use
    // "vfs/file" instead of "/vfs/file".
    if (path.startsWith("vfs/")) {
      path = `/${path}`;
    }
    if (path.startsWith("/vfs/folios")) {
      return this.#getFolioFiles(path);
    }
    const file = this.#getFile(path);
    if (!ok(file)) return file;
    return [file];
  }

  createFolio(name: string): string {
    return `/vfs/folios/${name}`;
  }

  addFilesToFolio(folioPath: string, files: string[]): AddFilesToFolioResult {
    let folio = this.#folios.get(folioPath);
    if (!folio) {
      folio = new Set();
      this.#folios.set(folioPath, folio);
    }
    const existing = [...folio];
    files.forEach((file) => folio.add(file));
    return {
      existing,
      added: files,
    };
  }

  listFolioContents(folioPath: string): string[] {
    const folio = this.#folios.get(folioPath);
    return [...(folio || [])];
  }

  add(part: DataPart): Outcome<string> {
    if ("text" in part) {
      const mimeType = "text/markdown";
      const name = this.create(mimeType);
      this.#files.set(name, { type: "text", mimeType, data: part.text });
      return name;
    } else if ("inlineData" in part) {
      const { mimeType, data, title } = part.inlineData;
      const name = this.create(mimeType);
      this.#files.set(name, { type: "inlineData", mimeType, data, title });
      return name;
    } else if ("storedData" in part) {
      const { mimeType, handle: data, resourceKey } = part.storedData;
      const name = this.create(mimeType);
      this.#files.set(name, {
        type: "storedData",
        mimeType,
        data,
        resourceKey,
      });
      return name;
    } else if ("fileData" in part) {
      const { mimeType, fileUri: data, resourceKey } = part.fileData;
      const name = this.create(mimeType);
      this.#files.set(name, { type: "fileData", mimeType, data, resourceKey });
      return name;
    }
    return err(`Unsupported part: ${JSON.stringify(part)}`);
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
