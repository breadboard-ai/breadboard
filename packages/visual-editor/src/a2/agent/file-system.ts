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
  NodeHandlerContext,
  Outcome,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import mime from "mime";
import { toText } from "../a2/utils.js";
import { FileDescriptor, MemoryManager } from "./types.js";
import { GENERATE_TEXT_FUNCTION } from "./functions/generate.js";

export { AgentFileSystem };

const KNOWN_TYPES = ["audio", "video", "image", "text"];
const DEFAULT_EXTENSION = "txt";
const DEFAULT_MIME_TYPE = "text/plain";

export type AddFilesToProjectResult = {
  existing: string[];
  added: string[];
  total: number;
  error?: string;
};

export type SystemFileGetter = () => Outcome<string>;

export type AgentFileSystemArgs = {
  context: NodeHandlerContext;
  memoryManager: MemoryManager | null;
};

class AgentFileSystem {
  #fileCount = 0;
  #files: Map<string, FileDescriptor> = new Map();
  #routes: Map<string, string> = new Map([
    ["", ""],
    ["/", "/"],
  ]);
  #useMemory = true;

  private readonly context: NodeHandlerContext;
  private readonly memoryManager: MemoryManager | null;
  private readonly systemFiles: Map<string, SystemFileGetter> = new Map();

  constructor(args: AgentFileSystemArgs) {
    this.context = args.context;
    this.memoryManager = args.memoryManager;
  }

  setUseMemory(value: boolean) {
    this.#useMemory = value;
  }

  addSystemFile(path: string, getter: SystemFileGetter) {
    this.systemFiles.set(path, getter);
  }

  overwrite(name: string, data: string): string {
    const { path, mimeType } = this.#createNamed(name, false);
    this.#files.set(path, { data, mimeType, type: "text" });
    return path;
  }

  write(name: string, data: string): string {
    const { path, mimeType } = this.#createNamed(name, true);
    if (mimeType === "text/html") {
      // Encode to base64 to match the inlineData convention: .data is always
      // base64-encoded. This keeps write()-created HTML consistent with HTML
      // returned by code execution and the Gemini API.
      const encoded = btoa(
        new TextEncoder()
          .encode(data)
          .reduce((s, b) => s + String.fromCharCode(b), "")
      );
      this.#files.set(path, { data: encoded, mimeType, type: "inlineData" });
    } else {
      this.#files.set(path, { data, mimeType, type: "text" });
    }
    return path;
  }

  append(path: string, data: string): Outcome<void> {
    let file: FileDescriptor | undefined = this.#files.get(path);
    if (!file) {
      file = { data, mimeType: "text/markdown", type: "text" };
      this.#files.set(path, file);
    } else if (file.type !== "text") {
      return err(`File "${path}" already exists and it is not a text file`);
    }
    file.data = `${file.data}\n${data}`;
  }

  /**
   * Used by the translator to replace any string that may look
   * like a path with the corresponding file URL.
   * Any string can be sent here.
   */
  getFileUrl(maybePath: string): string | undefined {
    const file = this.#files.get(maybePath);
    if (!file) return undefined;
    switch (file.type) {
      case "fileData":
        return file.data;
      case "inlineData":
        return `data:${file.mimeType};base64,${file.data}`;
      case "storedData":
        return file.data;
      default:
      case "text":
        return undefined;
    }
  }

  #getSystemFile(path: string): Outcome<DataPart[]> {
    const getter = this.systemFiles?.get(path);
    if (!getter) return err(`File ${path} was not found`);
    const text = getter();
    if (!ok(text)) return text;
    return [{ text }];
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

  async #getMemoryFile(path: string): Promise<Outcome<DataPart[]>> {
    const sheetName = path.replace("/mnt/memory/", "");
    const sheet = await this.memoryManager?.readSheet(this.context, {
      range: `${sheetName}!A:ZZ`,
    });
    if (!sheet) return [];
    if (!ok(sheet)) return sheet;
    if ("error" in sheet) return err(sheet.error);
    return [{ text: JSON.stringify(sheet.values) }];
  }

  async readText(path: string): Promise<Outcome<string>> {
    const parts = await this.get(path);
    if (!ok(parts)) return parts;
    const errors: string[] = [];
    parts.forEach((part) => {
      if ("storedData" in part) {
        const { handle, mimeType } = part.storedData;
        if (handle.startsWith("drive:/")) {
          errors.push(
            `Google Drive files may contain images and other non-textual content. Please use "${GENERATE_TEXT_FUNCTION}" to read them at full fidelity.`
          );
        } else {
          errors.push(
            `Reading text from file with mimeType ${mimeType} is not supported.`
          );
        }
      }
    });

    if (errors.length > 0) {
      return err(errors.join(", "));
    }

    return toText({ parts });
  }

  async getMany(paths: string[]): Promise<Outcome<DataPart[]>> {
    const inputErrors: string[] = [];
    const files: DataPart[] = (
      await Promise.all(paths.map((path) => this.get(path)))
    )
      .filter((part) => {
        if (!ok(part)) {
          inputErrors.push(part.$error);
          return false;
        }
        return true;
      })
      .flat() as DataPart[];
    if (inputErrors.length > 0) {
      return err(inputErrors.join(","));
    }
    return files;
  }

  async get(path: string): Promise<Outcome<DataPart[]>> {
    // Do a path fix-up just in case: sometimes, Gemini decides to use
    // "mnt/file" instead of "/mnt/file".
    if (path.startsWith("mnt/")) {
      path = `/${path}`;
    }
    if (path.startsWith("/mnt/system/")) {
      return this.#getSystemFile(path);
    }
    if (path.startsWith("/mnt/memory/") && this.#useMemory) {
      return this.#getMemoryFile(path);
    }
    const file = this.#getFile(path);
    if (!ok(file)) return file;
    return [file];
  }

  async listFiles(): Promise<string> {
    const files = [...this.#files.keys()];
    const system = [...this.systemFiles.keys()];
    const memory = [];
    if (this.#useMemory) {
      const memoryMetadata = await this.memoryManager?.getSheetMetadata(
        this.context
      );
      if (memoryMetadata && ok(memoryMetadata)) {
        memory.push(
          ...memoryMetadata.sheets.map((sheet) => `/mnt/memory/${sheet.name}`)
        );
      }
    }
    return [...files, ...system, ...memory].join("\n");
  }

  addRoute(originalRoute: string): string {
    // The "- 1" is because by default, we add two routes. So now, the count for
    // newly added routes will start at 1.
    const routeName = `/route-${this.#routes.size - 1}`;
    this.#routes.set(routeName, originalRoute);
    return routeName;
  }

  getOriginalRoute(routeName: string): Outcome<string> {
    const originalRoute = this.#routes.get(routeName);
    if (!originalRoute) {
      return err(`Route "${routeName}" not found`);
    }
    return originalRoute;
  }

  /**
   * Finds an existing file path that has the same data handle/URI.
   * This allows deduplication of storedData and fileData parts.
   */
  #findExistingByHandle(data: string): string | undefined {
    for (const [path, descriptor] of this.#files) {
      if (
        (descriptor.type === "storedData" || descriptor.type === "fileData") &&
        descriptor.data === data
      ) {
        return path;
      }
    }
    return undefined;
  }

  add(part: DataPart, fileName?: string): Outcome<string> {
    const create = (mimeType: string) => {
      if (fileName) {
        // If the fileName has no extension, derive one from the mimeType
        // to avoid defaulting to .txt for non-text content.
        const hasExtension = fileName.includes(".");
        const name = hasExtension
          ? fileName
          : `${fileName}.${mime.getExtension(mimeType) || DEFAULT_EXTENSION}`;
        return this.#createNamed(name, true).path;
      }
      return this.create(mimeType);
    };

    if ("text" in part) {
      const mimeType = "text/markdown";
      const name = create(mimeType);
      this.#files.set(name, { type: "text", mimeType, data: part.text });
      return name;
    } else if ("inlineData" in part) {
      const { mimeType, data, title } = part.inlineData;
      const name = create(mimeType);
      this.#files.set(name, { type: "inlineData", mimeType, data, title });
      return name;
    } else if ("storedData" in part) {
      const { mimeType, handle: data, resourceKey } = part.storedData;
      // Check if a file with this handle already exists
      const existingPath = this.#findExistingByHandle(data);
      if (existingPath) {
        return existingPath;
      }
      const name = create(mimeType);
      this.#files.set(name, {
        type: "storedData",
        mimeType,
        data,
        resourceKey,
      });
      return name;
    } else if ("fileData" in part) {
      const { mimeType, fileUri: data, resourceKey } = part.fileData;
      // Check if a file with this URI already exists
      const existingPath = this.#findExistingByHandle(data);
      if (existingPath) {
        return existingPath;
      }
      const name = create(mimeType);
      this.#files.set(name, { type: "fileData", mimeType, data, resourceKey });
      return name;
    }
    return err(`Unsupported part: ${JSON.stringify(part)}`);
  }

  get files(): ReadonlyMap<string, DeepReadonly<FileDescriptor>> {
    return this.#files;
  }

  /**
   * Restores file system state from a saved snapshot.
   * Used for resuming failed runs.
   */
  restoreFrom(files: Record<string, FileDescriptor>): void {
    this.#files.clear();
    for (const [path, descriptor] of Object.entries(files)) {
      this.#files.set(path, { ...descriptor });
    }
    this.#fileCount = this.#files.size;
  }

  #createNamed(
    name: string,
    overwriteWarning: boolean
  ): { path: string; mimeType: string } {
    const ext = name.includes(".") ? name.split(".").pop() : undefined;
    const mimeType = (ext && mime.getType(ext)) || DEFAULT_MIME_TYPE;
    const filename = ext ? name : `${name}.${DEFAULT_EXTENSION}`;
    const path = `/mnt/${filename}`;
    if (overwriteWarning && this.#files.has(path)) {
      console.warn(`File "${path}" already exists, will be overwritten`);
    }
    return { path, mimeType };
  }

  create(mimeType: string) {
    const name = this.#getName(mimeType);
    const ext = mime.getExtension(mimeType);
    return `/mnt/${name}${++this.#fileCount}.${ext}`;
  }

  #getName(mimeType: string) {
    const first = mimeType.split("/").at(0) || "";
    if (KNOWN_TYPES.includes(first)) return first;
    return "file";
  }
}
