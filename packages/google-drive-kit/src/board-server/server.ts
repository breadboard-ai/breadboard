/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import {
  ok,
  type BoardServer,
  type BoardServerCapabilities,
  type BoardServerConfiguration,
  type BoardServerEventTarget,
  type BoardServerExtension,
  type BoardServerProject,
  type ChangeNotificationCallback,
  type DataPartTransformer,
  type EntityMetadata,
  type GraphDescriptor,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderItem,
  type GraphProviderStore,
  type Kit,
  type Permission,
  type User,
} from "@google-labs/breadboard";
import { DriveOperations, PROTOCOL } from "./operations.js";
import { SaveDebouncer } from "./save-debouncer.js";
import { SaveEvent } from "./events.js";
import { type GoogleDriveClient } from "../google-drive-client.js";
import { GoogleDriveDataPartTransformer } from "./data-part-transformer.js";

export { GoogleDriveBoardServer };

const OWNER_USERNAME = "board-builder";
const GALLERY_OWNER_USERNAME = "gallery-owner";

// This whole package should probably be called
// "@breadboard-ai/google-drive-board-server".
// But it's good that we have both components and the board server here:
// Good use case.
class GoogleDriveBoardServer
  extends (EventTarget as BoardServerEventTarget)
  implements BoardServer
{
  static PROTOCOL = PROTOCOL;

  static async connect(folderId: string, vendor: TokenVendor) {
    const folder = await DriveOperations.readFolder(folderId, vendor);
    if (!folder) {
      return null;
    }

    return {
      title: folder.name || "Google Drive",
      username: OWNER_USERNAME,
    };
  }

  static async from(
    url: string,
    title: string,
    user: User,
    vendor: TokenVendor,
    googleDriveClient: GoogleDriveClient,
    userFolderName: string,
    publicApiKey?: string,
    featuredGalleryFolderId?: string
  ) {
    const connection = await GoogleDriveBoardServer.connect(
      new URL(url).hostname,
      vendor
    );

    if (!connection) {
      return null;
    }

    try {
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
          preview: true,
          events: true,
          autosave: true,
        },
      };

      return new GoogleDriveBoardServer(
        title,
        configuration,
        user,
        vendor,
        googleDriveClient,
        userFolderName,
        publicApiKey,
        featuredGalleryFolderId
      );
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  public readonly url: URL;
  public readonly users: User[];
  public readonly secrets = new Map<string, string>();
  public readonly extensions: BoardServerExtension[] = [];
  public readonly capabilities: BoardServerCapabilities;
  public readonly ops: DriveOperations;
  readonly #googleDriveClient: GoogleDriveClient;

  projects: Promise<BoardServerProject[]>;
  kits: Kit[];

  constructor(
    public readonly name: string,
    public readonly configuration: BoardServerConfiguration,
    public readonly user: User,
    public readonly vendor: TokenVendor,
    googleDriveClient: GoogleDriveClient,
    userFolderName: string,
    publicApiKey?: string,
    featuredGalleryFolderId?: string
  ) {
    super();
    this.ops = new DriveOperations(
      vendor,
      user.username,
      configuration.url,
      userFolderName,
      publicApiKey,
      featuredGalleryFolderId
    );

    this.url = configuration.url;
    this.kits = configuration.kits;
    this.users = configuration.users;
    this.secrets = configuration.secrets;
    this.extensions = configuration.extensions;
    this.capabilities = configuration.capabilities;
    this.#googleDriveClient = googleDriveClient;
    this.projects = this.refreshProjects();
  }

  #saving = new Map<string, SaveDebouncer>();

  // This is a workaround for items() being sync. Since we expect ready() to be
  // awaited we know #projects will be populated by the time items() is called.
  #projects: BoardServerProject[] = [];
  async ready(): Promise<void> {
    this.#projects = await this.projects;
  }

  async refreshProjects(): Promise<BoardServerProject[]> {
    // Run two lists operations in parallel.
    const userGraphsPromise = this.ops.readGraphList();
    let featuredGraphs = await this.ops.readFeaturedGalleryGraphList();
    const userGraphs = await userGraphsPromise;
    if (!ok(userGraphs)) return [];
    if (!ok(featuredGraphs)) {
      console.warn(featuredGraphs.$error);
      featuredGraphs = [];
    }
    const ownerAccess = new Map([
      [
        this.user.username,
        {
          create: true,
          retrieve: true,
          update: true,
          delete: true,
        } satisfies Permission,
      ],
    ]);
    const galleryAccess = new Map([
      [
        GALLERY_OWNER_USERNAME,
        {
          create: false,
          retrieve: true,
          update: false,
          delete: false,
        } satisfies Permission,
      ],
    ]);

    const projects = files.map(({ title, tags, id, thumbnail }) => {
      return {
        // TODO: This should just be new URL(id, this.url), but sadly, it will
        // break existing instances of the Google Drive board server.
        url: new URL(`${this.url}${this.url.pathname ? "" : "/"}${id}`),
        metadata: {
          owner: OWNER_USERNAME,
          tags,
          title,
          ownerAccess,
        },
      };
    });

    const galleryProjects = featuredGraphs.map(
      ({ title, tags, thumbnailUrl, id }) => {
        return {
          url: new URL(`${this.url}${this.url.pathname ? "" : "/"}${id}`),
          metadata: {
            owner: GALLERY_OWNER_USERNAME,
            tags,
            title,
            access: galleryAccess,
            thumbnail: thumbnailUrl,
          },
        };
      }
    );

    return [...userProjects, ...galleryProjects];
  }

  getAccess(_url: URL, _user: User): Promise<Permission> {
    throw new Error("Method not implemented.");
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    if (!url.href.startsWith(this.url.href)) {
      return false;
    }

    const project = this.#projects.find((project) => {
      return url.pathname.startsWith(project.url.pathname);
    });

    // We recognize it as something that can be loaded from this Board Server,
    // but we can't assess the access for it, so assume loading alone is
    // acceptable.
    if (!project) {
      return {
        load: true,
        save: false,
        delete: false,
      };
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
    const fileIdMatch = url.href.match(/^drive:\/(.+)/);
    if (!fileIdMatch) {
      throw new Error(
        `Expected URL to have format "drive:FILE_ID", got "${url.href}"`
      );
    }
    const fileId = fileIdMatch[1]!;
    const response = await this.#googleDriveClient.getFileMedia(fileId);
    return response.json();
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor,
    userInitiated: boolean
  ): Promise<{ result: boolean; error?: string }> {
    let saving = this.#saving.get(url.href);
    if (!saving) {
      saving = new SaveDebouncer(this.ops, {
        savestatuschange: (status, url) => {
          this.dispatchEvent(new SaveEvent(status, url));
        },
      });
      this.#saving = this.#saving.set(url.href, saving);
    }
    saving.save(url, descriptor, userInitiated);
    return { result: true };
  }

  createBlank(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string; url?: string }> {
    const parent = await this.ops.findOrCreateFolder();
    if (!ok(parent)) {
      return { result: false, error: parent.$error };
    }

    const writing = await this.ops.writeNewGraphToDrive(
      url,
      parent,
      descriptor
    );
    if (writing.result) {
      this.projects = this.refreshProjects();
    }
    return writing;
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    this.#saving.get(url.href)?.cancelPendingSave();
    const deleting = await this.ops.deleteGraph(url);
    if (!ok(deleting)) {
      return { result: false, error: deleting.$error };
    }
    this.projects = this.refreshProjects();

    return { result: true };
  }

  async connect(_location?: string, _auth?: unknown): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async disconnect(_location: string): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  async refresh(_location: string): Promise<boolean> {
    await this.projects;
    return true;
  }

  async createURL(location: string, fileName: string): Promise<string | null> {
    return `${location}/${fileName}`;
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
          username: project.metadata.owner,
          thumbnail: project.metadata.thumbnail,
        },
      ]);
    }

    items.set(this.url.href, {
      items: new Map(projects),
      permission: "granted",
      title: this.name,
      url: this.url.href,
    });

    return items;
  }

  dataPartTransformer(_graphUrl: URL): DataPartTransformer {
    return new GoogleDriveDataPartTransformer(this.#googleDriveClient, this.ops);
  }

  startingURL(): URL | null {
    throw new Error("Method not implemented.");
  }

  async canProxy(url: URL): Promise<string | false> {
    if (!this.canProvide(url)) {
      return false;
    }
    return new URL("/board/proxy", location.origin).href;
  }

  watch(_callback: ChangeNotificationCallback) {}

  async preview(_url: URL): Promise<URL> {
    throw new Error("Method not implemented.");
  }
}