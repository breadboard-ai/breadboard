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
import { toText } from "../a2/utils.js";
import { MemoryManager } from "./types.js";

export { AgentFileSystem };

const KNOWN_TYPES = ["audio", "video", "image", "text"];

export type FileDescriptor = {
  type: "text" | "storedData" | "inlineData" | "fileData";
  mimeType: string;
  data: string;
  title?: string;
  resourceKey?: string;
};

export type AddFilesToProjectResult = {
  existing: string[];
  added: string[];
  total: number;
  error?: string;
};

export type SystemFileGetter = () => Outcome<string>;

export type AgentFileSystemArgs = {
  memoryManager: MemoryManager | null;
};

class AgentFileSystem {
  #fileCount = 0;

  #projects: Map<string, Set<string>> = new Map();

  #files: Map<string, FileDescriptor> = new Map();

  #routes: Map<string, string> = new Map([
    ["", ""],
    ["/", "/"],
  ]);

  private readonly memoryManager: MemoryManager | null;
  private readonly systemFiles: Map<string, SystemFileGetter> = new Map();

  constructor(args: AgentFileSystemArgs) {
    this.memoryManager = args.memoryManager;
  }

  addSystemFile(path: string, getter: SystemFileGetter) {
    this.systemFiles.set(path, getter);
  }

  write(name: string, data: string, mimeType: string): string {
    const path = this.#createNamed(name, mimeType);
    this.#files.set(path, { data, mimeType, type: "text" });
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

  #getProjectFiles(path: string): Outcome<DataPart[]> {
    const project = this.#projects.get(path);
    if (!project) {
      return err(`Project "${path}" not found`);
    }
    const errors: string[] = [];
    const files = [...project].map((path) => {
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

  async #getMemoryFile(path: string): Promise<Outcome<DataPart[]>> {
    const sheetName = path.replace("/vfs/memory/", "");
    const sheet = await this.memoryManager?.readSheet({
      range: `${sheetName}!A:ZZ`,
    });
    if (!sheet) return [];
    if (!ok(sheet)) return sheet;
    return [{ text: JSON.stringify(sheet.values) }];
  }

  async readText(path: string): Promise<Outcome<string>> {
    const parts = await this.get(path);
    if (!ok(parts)) return parts;

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
    // "vfs/file" instead of "/vfs/file".
    if (path.startsWith("vfs/")) {
      path = `/${path}`;
    }
    if (path.startsWith("/vfs/system/")) {
      return this.#getSystemFile(path);
    }
    if (path.startsWith("/vfs/projects/")) {
      return this.#getProjectFiles(path);
    }
    if (path.startsWith("/vfs/memory/")) {
      return this.#getMemoryFile(path);
    }
    const file = this.#getFile(path);
    if (!ok(file)) return file;
    return [file];
  }

  async listFiles(): Promise<string> {
    const files = [...this.#files.keys()];
    const projects = [...this.#projects.keys()];
    const system = [...this.systemFiles.keys()];
    const memory = [];
    const memoryMetadata = await this.memoryManager?.getSheetMetadata();
    if (memoryMetadata && ok(memoryMetadata)) {
      memory.push(
        ...memoryMetadata.sheets.map((sheet) => `/vfs/memory/${sheet.name}`)
      );
    }
    return [...files, ...system, ...memory, ...projects].join("\n");
  }

  createProject(name: string): string {
    return `/vfs/projects/${name}`;
  }

  addFilesToProject(
    projectPath: string,
    files: string[]
  ): AddFilesToProjectResult {
    let project = this.#projects.get(projectPath);
    if (!project) {
      project = new Set();
      this.#projects.set(projectPath, project);
    }
    const existing = [...project];
    files.forEach((file) => project.add(file));
    return {
      total: project.size,
      existing,
      added: files,
    };
  }

  listProjectContents(projectPath: string): string[] {
    const project = this.#projects.get(projectPath);
    return [...(project || [])];
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

  add(part: DataPart, fileName?: string): Outcome<string> {
    const create = (mimeType: string) => {
      if (fileName) {
        const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
        return this.#createNamed(withoutExtension, mimeType);
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
      const name = create(mimeType);
      this.#files.set(name, { type: "fileData", mimeType, data, resourceKey });
      return name;
    }
    return err(`Unsupported part: ${JSON.stringify(part)}`);
  }

  get files(): ReadonlyMap<string, DeepReadonly<FileDescriptor>> {
    return this.#files;
  }

  #createNamed(name: string, mimeType: string): string {
    let filename;
    if (name.includes(".")) {
      filename = name;
    } else {
      const ext = mime.getExtension(mimeType);
      filename = `${name}.${ext}`;
    }
    const path = `/vfs/${filename}`;
    if (this.#files.has(path)) {
      console.warn(`File "${path}" already exists, will be overwritten`);
    }
    return path;
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
