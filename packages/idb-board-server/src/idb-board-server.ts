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
  DataPartTransformer,
  GraphProviderPreloadHandler,
} from "@google-labs/breadboard";

import * as idb from "idb";

import {
  IDBProjectStoreConfiguration,
  IDBProjectStoreProject as IDBBoardServerProject,
  LocalStoreData,
} from "./types/idb-types.js";
import { kitFromGraphDescriptor } from "@google-labs/breadboard/legacy.js";

const loadedExtensions: BoardServerExtension[] = [];

// Since IDB does not support various items, like functions, we use
// inflate and deflate functions to handle going into and out of IDB.

async function inflateConfiguration(
  configuration: IDBProjectStoreConfiguration,
  loadedKits: Kit[]
): Promise<BoardServerConfiguration> {
  const secrets = new Map<string, string>(configuration.secrets);
  const kits: Kit[] = loadedKits;
  // TODO: Figure out the right fix.
  // configuration.kits
  //   .map((url) => {
  //     const kit = loadedKits.find((kit) => kit.url === url);
  //     if (!kit) {
  //       console.warn(`Unable to find kit for ${url}`);
  //       return null;
  //     }

  //     return kit;
  //   })
  //   .filter((kit) => kit !== null);

  const extensions: BoardServerExtension[] = configuration.extensions
    .map((url) => {
      const extension = loadedExtensions.find(
        (extension) => extension.url.href === url
      );
      if (!extension) {
        console.warn(`Unable to find extension for ${url}`);
        return null;
      }

      return extension;
    })
    .filter((extension) => extension !== null);

  return {
    capabilities: configuration.capabilities,
    extensions,
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
    extensions: configuration.extensions.map((extension) => extension.url.href),
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
  if (!project.board) {
    throw new Error("Board not set - unable to deflate");
  }

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

  kits: Kit[];
  projects: Promise<BoardServerProject[]>;

  static readonly PROTOCOL = "idb://";

  static parseURL(url: string) {
    if (!url.startsWith(this.PROTOCOL)) {
      throw new Error(`Not a local store URL: ${url}`);
    }

    return url.replace(/^idb:\/\//, "");
  }

  static async from(url: string, title: string, user: User) {
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

      const configuration = await inflateConfiguration(idbConfiguration, []);
      return new IDBBoardServer(title, configuration, user);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  static async #create(configuration: BoardServerConfiguration) {
    const db = await createLocalStoreDBIfNeeded(configuration.url.href);

    const idbConfiguration = await deflateConfiguration(configuration);
    await db.put("configuration", idbConfiguration);

    const projects = (await configuration.projects) ?? [];
    for (const project of projects) {
      const idbProject = await deflateProject(project);
      await db.put("projects", idbProject);
    }

    db.close();
  }

  static async createDefault(url: URL, user: User) {
    const extensions = loadedExtensions;
    this.#create({
      url: new URL(url),
      projects: Promise.resolve([]),
      kits: [],
      users: [user],
      secrets: new Map(),
      extensions,
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
    public readonly configuration: BoardServerConfiguration,
    public readonly user: User
  ) {
    super();

    this.url = configuration.url;
    this.kits = configuration.kits;
    this.projects = this.#refreshProjects();

    this.users = configuration.users;
    this.secrets = configuration.secrets;
    this.extensions = configuration.extensions;
    this.capabilities = configuration.capabilities;
  }
  deepCopy(_url: URL, graph: GraphDescriptor): Promise<GraphDescriptor> {
    return Promise.resolve(graph);
  }
  canProxy?: ((url: URL) => Promise<string | false>) | undefined;
  renewAccess?: (() => Promise<void>) | undefined;
  preload?:
    | ((preloader: GraphProviderPreloadHandler) => Promise<void>)
    | undefined;
  dataPartTransformer?: ((graphUrl: URL) => DataPartTransformer) | undefined;

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
    await this.#refreshBoardServerKit(projects);
    return projects;
  }

  async #refreshBoardServerKit(projects: BoardServerProject[]) {
    if (!projects.length) {
      return;
    }

    const graphs: Record<string, GraphDescriptor> = {};
    for (let idx = 0; idx < projects.length; idx++) {
      const project = projects[idx];
      if (!project.board?.descriptor.url) {
        continue;
      }

      const type = project.board.descriptor.url;
      const id = `node-${globalThis.crypto.randomUUID()}`;
      if (
        !project.board.descriptor.metadata?.tags ||
        !project.board.descriptor.metadata?.tags.includes("tool")
      ) {
        continue;
      }

      graphs[type] = {
        title: project.board?.descriptor.title,
        description: project.board?.descriptor.description,
        metadata: {
          tags: project.board.descriptor.metadata?.tags,
          icon: project.board.descriptor.metadata?.icon ?? "generic",
        },
        edges: [],
        nodes: [
          {
            id,
            type,
          },
        ],
      };
    }

    const boardServerKit = kitFromGraphDescriptor({
      url: `${this.url.href}/bsk`,
      version: "0.0.1",
      title: "Board Server Kit",
      graphs: graphs,
      exports: Object.keys(graphs).map((name) => `#${name}`),
      edges: [],
      nodes: [],
    });

    this.kits = this.kits.filter((kit) => kit.title !== "Board Server Kit");
    if (boardServerKit) {
      this.kits.push(boardServerKit);
    }
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    const projects = await this.projects;
    const project = projects.find((project) => {
      return url.pathname.startsWith(project.url.pathname);
    });
    if (!project || !project.board) {
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
    if (!project || project.board?.url.href !== url.href) {
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
    await this.#projects;
    return { result: true };
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    try {
      const db = await createLocalStoreDBIfNeeded(this.url.href);
      db.delete("projects", IDBKeyRange.only(url.href));
    } catch {
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
      if (!project.board) {
        console.warn(`No board set for ${project.url}`);
        continue;
      }

      let title = project.board.descriptor.title ?? "Untitled Board";
      if (projectNames.has(title) && project.board.descriptor.url) {
        const suffix = new URL(project.board.descriptor.url).pathname
          .split("/")
          .at(-1);
        title = `${project.board.descriptor.title ?? "Untitled Board"} [${suffix}]`;
      }

      let thumbnail: string | null = null;
      if (
        project.board.descriptor.assets &&
        project.board.descriptor.assets["@@thumbnail"]
      ) {
        thumbnail = project.board.descriptor.assets["@@thumbnail"]
          .data as string;
      }

      projectNames.add(title);
      projects.push([
        title,
        {
          url: project.url.href,
          mine: project.metadata.owner === this.user.username,
          version: project.board.descriptor.version,
          description: project.board.descriptor.description,
          readonly: false,
          handle: null,
          tags: project.board.descriptor.metadata?.tags,
          thumbnail,
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
