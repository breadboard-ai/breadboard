/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
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
import { loadKits } from "./utils/kit-loader";
import GeminiKit from "@google-labs/gemini-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit";
import { BreadboardManifest, isReference } from "@breadboard-ai/manifest";

const loadedKits = loadKits([GeminiKit, PythonWasmKit, GoogleDriveKit]);

import examplesBoards from "@breadboard-ai/example-boards/examples-boards.json" assert { type: "json" };
import playgroundBoards from "@breadboard-ai/example-boards/playground-boards.json" assert { type: "json" };
import { GraphTag } from "../../types/dist/src/graph-descriptor";

export class ExampleBoardServer extends EventTarget implements BoardServer {
  public readonly url: URL;
  public readonly kits: Kit[];
  public readonly users: User[];
  public readonly secrets = new Map<string, string>();
  public readonly extensions: BoardServerExtension[] = [];
  public readonly capabilities: BoardServerCapabilities;

  projects: Promise<BoardServerProject[]>;

  static readonly PROTOCOL = "example://";

  static parseURL(url: string) {
    if (!url.startsWith(this.PROTOCOL)) {
      throw new Error(`Not a local store URL: ${url}`);
    }

    return url.replace(/^idb:\/\//, "");
  }

  static async from(url: string, user: User) {
    try {
      const configuration = {
        url: new URL(url),
        projects: Promise.resolve([]),
        kits: await loadedKits,
        users: [],
        secrets: new Map(),
        extensions: [],
        capabilities: {
          connect: true,
          disconnect: true,
          refresh: true,
          watch: false,
          preview: true,
        },
      };

      let title = "Examples";
      let manifest = examplesBoards;
      switch (url) {
        case "example://example-boards": {
          title = "Example Boards";
          manifest = examplesBoards;
          break;
        }

        case "example://playground-boards": {
          title = "Playground Boards";
          manifest = playgroundBoards;
          break;
        }

        default: {
          throw new Error("Unexpected example board server URL");
          break;
        }
      }

      return new ExampleBoardServer(title, configuration, user, manifest);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  constructor(
    public readonly name: string,
    public readonly configuration: BoardServerConfiguration,
    public readonly user: User,
    public readonly manifest: BreadboardManifest
  ) {
    super();

    this.url = configuration.url;
    this.projects = this.#refreshProjects("", manifest);
    this.kits = configuration.kits;
    this.users = configuration.users;
    this.secrets = configuration.secrets;
    this.extensions = configuration.extensions;
    this.capabilities = configuration.capabilities;

    console.log(this.kits);
  }

  #blank: URL | null = null;

  // This is a workaround for items() being sync. Since we expect ready() to be
  // awaited we know #projects will be populated by the time items() is called.
  #projects: BoardServerProject[] = [];
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

  async #refreshProjects(_title: string, manifest: BreadboardManifest) {
    const boards = manifest.boards || [];
    const blank = boards
      .filter(isReference)
      .find((board) => board.reference?.endsWith("blank.bgl.json"));

    if (blank?.reference) {
      this.#blank = new URL(blank.reference, window.location.href);
    }

    const projects: BoardServerProject[] = boards
      .map((board) => ({
        ...board,
        title: board.title || (isReference(board) && board.reference) || "",
      }))
      .sort((a, b) => a.title!.localeCompare(b.title!))
      .map((board) => {
        if (!isReference(board)) {
          throw new Error("Expected board to be a reference.");
        }

        const url = new URL(board.reference!, window.location.href);
        const access = new Map([
          [
            this.user.username,
            {
              create: false,
              retrieve: true,
              update: false,
              delete: false,
            },
          ],
        ]);

        return {
          url,
          metadata: {
            access,
            owner: "visual-editor",
            title: board.title,
            tags: board.tags as GraphTag[] | undefined,
          },
        };
      });

    return Promise.resolve(projects);
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
          handle: null,
          tags: project.metadata?.tags,
        },
      ]);
    }

    items.set(this.name, {
      items: new Map(projects),
      permission: "granted",
      title: this.name,
    });

    return items;
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(_url: URL): false | GraphProviderCapabilities {
    // Never use this provider for loading.
    return false;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: false,
      connect: false,
      disconnect: false,
      refresh: false,
      watch: false,
      preview: false,
    };
  }

  async load(_url: URL): Promise<GraphDescriptor | null> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to load graphs."
    );
  }

  async save(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to save graphs."
    );
  }

  async createBlank(
    _url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to create blank graphs."
    );
  }

  async create(
    _url: URL,
    _descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to create graphs."
    );
  }

  async delete(
    _url: URL
  ): Promise<{ result: boolean; error?: string | undefined }> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be used to delete graphs."
    );
  }

  async connect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to connect."
    );
  }

  async disconnect(_location?: string | undefined): Promise<boolean> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to disconnect."
    );
  }

  async refresh(_location: string): Promise<boolean> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to refresh."
    );
  }

  async createURL(_location: string, _fileName: string): Promise<string> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to create URL."
    );
  }

  async preview(_url: URL): Promise<URL> {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to preview"
    );
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to parse URL."
    );
  }

  async restore(): Promise<void> {}

  startingURL(): URL | null {
    return this.#blank;
  }

  watch(): void {
    throw new Error(
      "The `ExamplesGraphProvider` should not be called to watch."
    );
  }
}
