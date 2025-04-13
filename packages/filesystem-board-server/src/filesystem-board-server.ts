/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  blank,
  DataPartTransformer,
  err,
  GraphProviderPreloadHandler,
  Outcome,
  type BoardServer,
  type BoardServerCapabilities,
  type BoardServerConfiguration,
  type BoardServerExtension,
  type BoardServerProject,
  type GraphDescriptor,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderItem,
  type GraphProviderStore,
  type Kit,
  type Permission,
  type User,
} from "@google-labs/breadboard";
import { FileSystemDataPartTransformer } from "./data-part-transformer";
import { Modules } from "@breadboard-ai/types";

type FileSystemWalkerEntry = FileSystemDirectoryHandle | FileSystemFileHandle;

interface FileSystemWalker {
  [Symbol.asyncIterator](): AsyncIterator<[string, FileSystemWalkerEntry]>;
}

// Augmented interface to the default one in TypeScript. This one accounts for
// the API added by Chrome.
export interface FileSystemDirectoryHandle {
  kind: "directory";
  name: string;
  entries(): FileSystemWalker;
  queryPermission(options?: {
    mode: "read" | "write" | "readwrite";
  }): Promise<"prompt" | "granted">;
  requestPermission(options?: {
    mode: "read" | "write" | "readwrite";
  }): Promise<"prompt" | "granted">;
  removeEntry(name: string, options?: { recursive: boolean }): Promise<void>;
  getFileHandle(
    name: string,
    options?: { create: boolean }
  ): Promise<FileSystemFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: { create: boolean }
  ): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemFileHandle {
  kind: "file";
  name: string;
  isSameEntry(other: FileSystemFileHandle): Promise<boolean>;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
  remove(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode: string;
    }): Promise<FileSystemDirectoryHandle>;

    showSaveFilePicker(options?: {
      excludeAcceptAllOptions?: boolean;
      id?: string;
      startIn?: FileSystemHandle | string;
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }): Promise<FileSystemFileHandle>;
  }
}

export class FileSystemBoardServer extends EventTarget implements BoardServer {
  public readonly url: URL;
  public readonly kits: Kit[];
  public readonly users: User[];
  public readonly secrets = new Map<string, string>();
  public readonly extensions: BoardServerExtension[] = [];
  public readonly capabilities: BoardServerCapabilities;

  projects: Promise<BoardServerProject[]>;

  static readonly PROTOCOL = "file://";

  static async connect() {
    try {
      return await window.showDirectoryPicker({
        mode: "readwrite",
      });
    } catch (err) {
      return null;
    }
  }

  static createURL(name: string) {
    return new URL(
      `${this.PROTOCOL}${encodeURIComponent(name.toLocaleLowerCase())}`
    ).href;
  }

  static async from(
    url: string,
    title: string,
    user: User,
    handle?: FileSystemDirectoryHandle
  ) {
    try {
      if (!handle) {
        throw new Error("No FileSystemDirectory handle provided");
      }

      const configuration = {
        url: new URL(url),
        projects: Promise.resolve([]),
        kits: [],
        users: [],
        secrets: new Map(),
        extensions: [],
        capabilities: {
          connect: true,
          disconnect: true,
          refresh: true,
          watch: false,
          preview: false,
        },
      };

      return new FileSystemBoardServer(title, configuration, user, handle);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  constructor(
    public readonly name: string,
    public readonly configuration: BoardServerConfiguration,
    public readonly user: User,
    public readonly handle: FileSystemDirectoryHandle
  ) {
    super();

    this.url = configuration.url;
    this.projects = this.#refreshProjects();
    this.kits = configuration.kits;
    this.users = configuration.users;
    this.secrets = configuration.secrets;
    this.extensions = configuration.extensions;
    this.capabilities = configuration.capabilities;
  }

  // This is a workaround for items() being sync. Since we expect ready() to be
  // awaited we know #projects will be populated by the time items() is called.
  #projects: BoardServerProject[] = [];
  #permission: "prompt" | "granted" = "prompt";
  async ready(): Promise<void> {
    this.#projects = await this.projects;
  }

  async getAccess(url: URL, user: User): Promise<Permission> {
    const project = this.#projects.find((project) => {
      return url.pathname.startsWith(project.url.pathname);
    });

    const defaultPermission = {
      create: false,
      retrieve: false,
      update: false,
      delete: false,
    };

    if (!project) {
      return defaultPermission;
    }

    return project.metadata.access.get(user.username) ?? defaultPermission;
  }

  #createURL(name: string) {
    return new URL(`${this.url.href}${name}`);
  }

  async #refreshProjects() {
    this.#permission = await this.handle.queryPermission({ mode: "readwrite" });
    if (this.#permission !== "granted") {
      return Promise.resolve([]);
    }

    const projects: BoardServerProject[] = [];
    for await (const [name, handle] of this.handle.entries()) {
      if (handle.kind === "directory") {
        continue;
      }

      if (!handle.name.endsWith("json")) {
        continue;
      }

      try {
        const access = new Map([
          [
            this.user.username,
            {
              create: true,
              retrieve: true,
              update: true,
              delete: true,
            },
          ],
        ]);

        const url = this.#createURL(name);
        const project: BoardServerProject = {
          url,
          metadata: {
            owner: this.user.username,
            tags: [],
            title: name,
            access,
          },
          handle,
        };

        projects.push(project);
      } catch (err) {
        console.warn(err);
      }
    }

    return projects;
  }

  items(): Map<string, GraphProviderStore> {
    const items = new Map<string, GraphProviderStore>();
    const projects: [string, GraphProviderItem][] = [];

    const projectNames = new Set<string>();
    for (const project of this.#projects) {
      let title = project.metadata.title ?? "Untitled Board";
      if (projectNames.has(title) && project.url) {
        const suffix = new URL(project.url).pathname.split("/").at(-1);
        title = `${project.metadata.title ?? "Untitled Board"} [${suffix}]`;
      }

      projectNames.add(title);
      projects.push([
        title,
        {
          url: project.url.href,
          mine: project.metadata.owner === this.user.username,
          readonly: false,
          handle: project.handle,
          tags: project.metadata?.tags,
        },
      ]);
    }

    items.set(this.url.href, {
      items: new Map(projects),
      permission: this.#permission,
      title: this.name,
    });

    return items;
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    if (!url.href.startsWith(this.url.href)) {
      return false;
    }

    return {
      load: true,
      save: true,
      delete: true,
    };
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: true,
      connect: true,
      disconnect: true,
      refresh: true,
      watch: false,
      preview: false,
    };
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    const projects = await this.projects;
    for (const project of projects) {
      if (project.url.href !== url.href) {
        continue;
      }

      if (!project.handle) {
        return null;
      }

      try {
        const handle = project.handle as FileSystemFileHandle;
        const file = await handle.getFile();
        const fileData = await file.text();

        return JSON.parse(fileData) as GraphDescriptor;
      } catch (err) {
        console.warn(err);
        return null;
      }
    }

    return null;
  }

  async #writeModuleCode(
    url: URL,
    modules: Modules | undefined
  ): Promise<Outcome<void>> {
    if (!modules) return;

    const entries = Object.entries(modules);
    if (entries.length === 0) return;

    const { handle: dir } = this;

    const name = url.pathname.split("/").at(-1)?.split(".").at(0);
    if (!name) {
      const msg = `Unable to extract name from "${url.href}`;
      console.warn(msg);
      return err(msg);
    }

    try {
      const codeDir = await dir.getDirectoryHandle("src", { create: true });
      const moduleDir = await codeDir.getDirectoryHandle(name, {
        create: true,
      });
      for (const [moduleName, entry] of entries) {
        const source = entry.metadata?.source;
        if (!source) continue;
        const code = source.code;
        const ext = source.language === "typescript" ? "ts" : "js";
        const fileizedModuleName = `${moduleName.replace("/", "-")}.${ext}`;
        const handle = await moduleDir.getFileHandle(fileizedModuleName, {
          create: true,
        });
        const stream = await handle.createWritable();
        await stream.write(code);
        await stream.close();
      }
    } catch (e) {
      const msg = `Unable to create module dir: ${(e as Error).message}`;
      console.warn(msg);
      return err(msg);
    }
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const projects = await this.projects;
    for (const project of projects) {
      if (project.url.href !== url.href) {
        continue;
      }

      if (!project.handle) {
        return { result: false };
      }

      const handle: FileSystemFileHandle =
        project.handle as FileSystemFileHandle;
      const stream = await handle.createWritable();
      const data = structuredClone(descriptor);
      delete data["url"];

      await this.#writeModuleCode(url, data.modules);

      await stream.write(JSON.stringify(data, null, 2));
      await stream.close();

      return { result: true };
    }

    return { result: false };
  }

  async createBlank(
    url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    return this.create(url, blank());
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string | undefined }> {
    for await (const [, file] of this.handle.entries()) {
      if (url.href === this.#createURL(file.name).href) {
        return { result: false, error: "File already exists" };
      }
    }

    try {
      const fileName = url.href.replace(this.url.href, "");

      // Create the handle and refresh to make it available to the save call.
      await this.handle.getFileHandle(fileName, { create: true });
      await this.refresh();
      await this.save(url, descriptor);

      return { result: true };
    } catch (err) {
      return { result: false };
    }
  }

  async delete(
    url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const projects = await this.projects;
    for (const project of projects) {
      if (project.url.href !== url.href) {
        continue;
      }

      if (!project.handle) {
        return { result: false };
      }

      const handle: FileSystemFileHandle =
        project.handle as FileSystemFileHandle;

      await handle.remove();
      await this.refresh();
      return { result: true };
    }

    return { result: false };
  }

  async connect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `FileSystemBoardServer` should not be called to connect."
    );
  }

  async disconnect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `FileSystemBoardServer` should not be called to disconnect."
    );
  }

  async refresh(): Promise<boolean> {
    this.projects = this.#refreshProjects();
    await this.projects;
    return true;
  }

  async createURL(location: string, fileName: string): Promise<string> {
    return location + fileName;
  }

  async preview(_url: URL): Promise<URL> {
    throw new Error(
      "The `FileSystemBoardServer` should not be called to preview"
    );
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error(
      "The `FileSystemBoardServer` should not be called to parse URL."
    );
  }

  async restore(): Promise<void> {
    await this.projects;
  }

  startingURL(): URL | null {
    return null;
  }

  watch(): void {
    throw new Error(
      "The `FileSystemBoardServer` should not be called to watch."
    );
  }

  async renewAccess() {
    await this.handle.requestPermission({ mode: "readwrite" });
    await this.refresh();
  }

  async preload(preloader: GraphProviderPreloadHandler): Promise<void> {
    this.items().forEach((item) => {
      item.items.forEach((item) => {
        preloader(item);
      });
    });
  }

  dataPartTransformer(): DataPartTransformer {
    return new FileSystemDataPartTransformer();
  }
}
