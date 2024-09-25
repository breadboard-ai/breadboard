/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BoardServer,
  BoardServerProject,
  BoardServerCapabilities,
  BoardServerConfiguration,
  BoardServerExtension,
  ChangeNotificationCallback,
  GraphDescriptor,
  GraphProviderExtendedCapabilities,
  GraphProviderStore,
  Kit,
  Permission,
  User,
  GraphProviderItem,
} from "@google-labs/breadboard";

import * as idb from "idb";

import { loadKits } from "./utils/kit-loader.js";
import GeminiKit from "@google-labs/gemini-kit";
import PythonWasmKit from "@breadboard-ai/python-wasm";
import GoogleDriveKit from "@breadboard-ai/google-drive-kit";

import { blankLLMContent } from "@google-labs/breadboard";
import {
  IDBProjectStoreConfiguration,
  IDBProjectStoreProject as IDBBoardServerProject,
  LocalStoreData,
} from "./types/idb-types.js";

const loadedKits = loadKits([
  GeminiKit,
  // TODO: BuildExampleKit,
  PythonWasmKit,
  GoogleDriveKit,
]);

// Since IDB does not support various items, like functions, we use
// inflate and deflate functions to handle going into and out of IDB.

async function inflateConfiguration(
  configuration: IDBProjectStoreConfiguration
): Promise<BoardServerConfiguration> {
  const secrets = new Map<string, string>(configuration.secrets);
  const allKits = await loadedKits;
  const kits: Kit[] = configuration.kits
    .map((url) => {
      const kit = allKits.find((kit) => kit.url === url);
      if (!kit) {
        console.warn(`Unable to find kit for ${kit.url}`);
        return null;
      }

      return kit;
    })
    .filter((kit) => kit !== null);

  return {
    capabilities: configuration.capabilities,
    extensions: [], // TODO.
    projects: Promise.resolve([]),
    kits,
    secrets,
    users: configuration.users,
    url: new URL(configuration.url),
  };
}

async function deflateConfiguration(
  configuration: BoardServerConfiguration
): Promise<IDBProjectStoreConfiguration> {
  return {
    url: configuration.url.href,
    capabilities: configuration.capabilities,
    extensions: [], // TODO.
    kits: configuration.kits.map((kit) => kit.url),
    secrets: configuration.secrets,
    users: configuration.users,
  };
}

async function inflateProject(
  project: IDBBoardServerProject
): Promise<BoardServerProject> {
  return {
    url: new URL(project.url),
    metadata: project.metadata,
    board: {
      url: new URL(project.board.url),
      metadata: project.board.metadata,
      descriptor: project.board.descriptor,
      evaluations: project.board.evaluations,
      runs: project.board.runs,
      theme: project.board.theme,
    },
  };
}

async function deflateProject(
  project: BoardServerProject
): Promise<IDBBoardServerProject> {
  return {
    url: project.url.href,
    metadata: project.metadata,
    board: {
      url: project.board.url.href,
      metadata: project.board.metadata,
      descriptor: project.board.descriptor,
      evaluations: project.board.evaluations,
      runs: project.board.runs,
      theme: project.board.theme,
    },
  };
}

async function createLocalStoreDBIfNeeded(url: string) {
  return idb.openDB<LocalStoreData>(IDBBoardServer.parseURL(url), 1, {
    upgrade(db) {
      db.createObjectStore("configuration", { keyPath: "url" });
      db.createObjectStore("projects", { keyPath: "url" });
    },
  });
}

export class IDBBoardServer extends EventTarget implements BoardServer {
  public readonly url: URL;
  public readonly kits: Kit[];
  public readonly users: User[];
  public readonly secrets = new Map<string, string>();
  public readonly extensions: BoardServerExtension[] = [];
  public readonly capabilities: BoardServerCapabilities = {
    connect: false,
    disconnect: false,
    refresh: false,
    watch: false,
    preview: false,
  };

  projects: Promise<BoardServerProject[]>;

  static readonly PROTOCOL = "idb://";

  static parseURL(url: string) {
    if (!url.startsWith(this.PROTOCOL)) {
      throw new Error(`Not a local store URL: ${url}`);
    }

    return url.replace(/^idb:\/\//, "");
  }

  static async from(url: string, user: User) {
    try {
      const db = await createLocalStoreDBIfNeeded(url);

      // Obtain and inflate the configuration.
      const idbConfiguration = await db.get(
        "configuration",
        IDBKeyRange.only(url)
      );
      if (!idbConfiguration) {
        throw new Error(`Unable to retrieve configuration for ${url}`);
      }

      const configuration = await inflateConfiguration(idbConfiguration);
      return new IDBBoardServer("Browser Storage", configuration, user);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  static async #create(configuration: BoardServerConfiguration) {
    const db = await createLocalStoreDBIfNeeded(configuration.url.href);

    const idbConfiguration = await deflateConfiguration(configuration);
    await db.put("configuration", idbConfiguration);

    const projects = await configuration.projects;
    for (const project of projects) {
      const idbProject = await deflateProject(project);
      await db.put("projects", idbProject);
    }

    db.close();
  }

  static async createDefault(url: URL, user: User) {
    const kits = await loadedKits;
    const descriptor = blankLLMContent();
    const access = new Map([
      [
        user.username,
        { create: true, retrieve: true, update: true, delete: true },
      ],
    ]);

    const boardUrl = new URL(`${url.href}/sample-project/sample.bgl.json`);
    const board = {
      metadata: {
        owner: user.username,
        access,
      },
      url: boardUrl,
      descriptor,
      runs: [],
      evaluations: [],
    };

    this.#create({
      url: new URL(url),
      projects: Promise.resolve([
        {
          board,
          url: boardUrl,
          metadata: {
            owner: user.username,
            access,
            title: "",
            description: undefined,
            icon: undefined,
          },
        },
      ]),
      kits,
      users: [user],
      secrets: new Map(),
      extensions: [],
      capabilities: {
        connect: false,
        disconnect: false,
        refresh: false,
        watch: false,
        preview: false,
      },
    });
  }

  constructor(
    public readonly name: string,
    configuration: BoardServerConfiguration,
    public readonly user: User
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
  async ready(): Promise<void> {
    this.#projects = await this.projects;
  }

  isSupported(): boolean {
    return true;
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: true,
      connect: false,
      disconnect: false,
      refresh: false,
      watch: false,
      preview: false,
    };
  }

  async #refreshProjects() {
    const db = await createLocalStoreDBIfNeeded(this.url.href);
    const projects = await db.getAll("projects").then(async (idbProjects) => {
      return await Promise.all(
        idbProjects.map((idbProject) => inflateProject(idbProject))
      );
    });

    db.close();
    return projects;
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    const projects = await this.projects;
    const project = projects.find((project) => {
      return url.pathname.startsWith(project.url.pathname);
    });
    if (!project) {
      return null;
    }

    if (project.board.url.href === url.href) {
      return project.board.descriptor;
    }

    return null;
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    const projects = await this.projects;
    const project = projects.find((project) => {
      return url.pathname.startsWith(project.url.pathname);
    });
    if (!project || project.board.url.href !== url.href) {
      return { result: false, error: "Unable to find project" };
    }

    project.board.descriptor = descriptor;

    const db = await createLocalStoreDBIfNeeded(this.url.href);
    const idbProject = await deflateProject(project);
    await db.put("projects", idbProject);
    db.close();

    return { result: true };
  }

  createBlank(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  async create(
    url: URL,
    graph: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    const access = new Map([
      [
        this.user.username,
        { create: true, retrieve: true, update: true, delete: true },
      ],
    ]);

    const board = {
      metadata: {
        owner: this.user.username,
        access,
      },
      url,
      descriptor: graph,
      runs: [],
      evaluations: [],
    };

    const project: BoardServerProject = {
      board,
      url,
      metadata: {
        owner: this.user.username,
        access,
        title: "",
        description: undefined,
        icon: undefined,
      },
    };

    const db = await createLocalStoreDBIfNeeded(this.url.href);
    const idbProject = await deflateProject(project);
    await db.put("projects", idbProject);

    this.projects = this.#refreshProjects();
    return { result: true };
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    try {
      const db = await createLocalStoreDBIfNeeded(this.url.href);
      db.delete("projects", IDBKeyRange.only(url.href));
    } catch (err) {
      return { result: false, error: "Unable to locate project to delete" };
    }

    this.projects = this.#refreshProjects();
    return { result: true };
  }

  connect(_location?: string, _auth?: unknown): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  disconnect(_location: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async refresh(_location: string): Promise<boolean> {
    await this.projects;
    return true;
  }

  async createURL(_location: string, fileName: string): Promise<string | null> {
    return `${this.url.href}/${fileName}`;
  }

  parseURL(_url: URL): { location: string; fileName: string } {
    throw new Error("Method not implemented.");
  }

  async restore(): Promise<void> {
    await this.projects;
  }

  items(): Map<string, GraphProviderStore> {
    const items = new Map<string, GraphProviderStore>();
    const projects: [string, GraphProviderItem][] = [];

    const projectNames = new Set<string>();
    for (const project of this.#projects) {
      let title = project.board.descriptor.title ?? "Untitled Board";
      if (projectNames.has(title) && project.board.descriptor.url) {
        const suffix = new URL(project.board.descriptor.url).pathname
          .split("/")
          .at(-1);
        title = `${project.board.descriptor.title ?? "Untitled Board"} [${suffix}]`;
      }

      projectNames.add(title);
      projects.push([
        title,
        {
          url: project.url.href,
          mine: project.metadata.owner === this.user.username,
          readonly: false,
          handle: null,
          tags: project.board.descriptor.metadata?.tags,
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

  startingURL(): URL | null {
    throw new Error("Method not implemented.");
  }

  watch(_callback: ChangeNotificationCallback): void {
    throw new Error("Method not implemented.");
  }

  preview(_url: URL): Promise<URL> {
    throw new Error("Method not implemented.");
  }

  canProvide(url: URL) {
    if (!url.href.startsWith(IDBBoardServer.PROTOCOL)) {
      return false;
    }

    return {
      save: true,
      load: true,
      delete: true,
    };
  }

  // Users are irrelevant for local stores.
  async getAccess(url: URL, user: User): Promise<Permission> {
    const projects = await this.projects;
    const project = projects.find((project) => project.url === url);
    return (
      project?.metadata.access.get(user.username) ?? {
        create: false,
        retrieve: false,
        update: false,
        delete: false,
      }
    );
  }
}
