/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi.client.drive-v3" />

import type { TokenVendor } from "@breadboard-ai/connection-client";
import { isStoredData, ok } from "@breadboard-ai/utils";

import {
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
  type Username,
} from "@breadboard-ai/types";
import {
  DriveOperations,
  getFileId,
  PROTOCOL,
  type GraphInfo,
} from "./operations.js";
import { SaveDebouncer } from "./save-debouncer.js";
import { RefreshEvent, SaveEvent } from "./events.js";
import { type GoogleDriveClient } from "../google-drive-client.js";
import { GoogleDriveDataPartTransformer } from "./data-part-transformer.js";
import { visitGraphNodes } from "@breadboard-ai/data";

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

  static async from(
    title: string,
    user: User,
    vendor: TokenVendor,
    googleDriveClient: GoogleDriveClient,
    publishPermissions: gapi.client.drive.Permission[],
    userFolderName: string,
    publicApiKey?: string,
    featuredGalleryFolderId?: string
  ) {
    try {
      const configuration = {
        url: new URL(`${PROTOCOL}/`),
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
        publishPermissions,
        userFolderName,
        publicApiKey,
        featuredGalleryFolderId
      );
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  public readonly url = new URL(PROTOCOL);
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
    publishPermissions: gapi.client.drive.Permission[],
    userFolderName: string,
    publicApiKey?: string,
    featuredGalleryFolderId?: string
  ) {
    super();
    this.ops = new DriveOperations(
      vendor,
      user.username,
      async () => {
        await this.refreshProjectList();
        this.dispatchEvent(new RefreshEvent());
      },
      userFolderName,
      googleDriveClient,
      publishPermissions,
      publicApiKey,
      featuredGalleryFolderId
    );

    this.kits = configuration.kits;
    this.users = configuration.users;
    this.secrets = configuration.secrets;
    this.extensions = configuration.extensions;
    this.capabilities = configuration.capabilities;
    this.#googleDriveClient = googleDriveClient;
    this.projects = this.listProjects();
  }

  #saving = new Map<string, SaveDebouncer>();

  // This is a workaround for items() being sync. Since we expect ready() to be
  // awaited we know #projects will be populated by the time items() is called.
  #projects: BoardServerProject[] = [];
  async ready(): Promise<void> {
    this.#projects = await this.projects;
  }

  async listProjects(): Promise<BoardServerProject[]> {
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

    const userProjects = userGraphs.map((graphInfo) =>
      this.#graphInfoToProject(graphInfo, OWNER_USERNAME, ownerAccess)
    );

    const galleryProjects = featuredGraphs.map((graphInfo) =>
      this.#graphInfoToProject(graphInfo, GALLERY_OWNER_USERNAME, galleryAccess)
    );

    return [...userProjects, ...galleryProjects];
  }

  #graphInfoToProject(
    graphInfo: GraphInfo,
    owner: string,
    access: Map<Username, Permission>
  ) {
    return {
      // TODO: This should just be new URL(id, this.url), but sadly, it will
      // break existing instances of the Google Drive board server.
      url: new URL(`${this.url}${this.url.pathname ? "" : "/"}${graphInfo.id}`),
      metadata: {
        owner,
        tags: graphInfo.tags,
        title: graphInfo.title,
        access,
        thumbnail: graphInfo.thumbnail,
        description: graphInfo.description,
      } satisfies EntityMetadata,
    };
  }

  /**
   * Issues a query for the project list and resets the `projects` promise.
   * The work is done asynchronously unless you await to its result.
   */
  refreshProjectList(): Promise<BoardServerProject[]> {
    this.projects = this.listProjects();
    return this.projects;
  }

  getAccess(_url: URL, _user: User): Promise<Permission> {
    throw new Error("Method not implemented.");
  }

  isSupported(): boolean {
    return true;
  }

  canProvide(url: URL): false | GraphProviderCapabilities {
    if (!url.href.startsWith(PROTOCOL)) {
      return false;
    }

    const fileId = getFileId(url.href);
    const project = this.#projects.find((project) => {
      return fileId === getFileId(project.url.href);
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
    const fileId = getFileId(url.href);
    const response = await this.#googleDriveClient.getFileMedia(fileId);
    if (response.status === 200) {
      return response.json();
    } else if (response.status === 404) {
      return null;
    } else {
      throw new Error(
        `Received ${response.status} error loading graph from Google Drive` +
          ` with file id ${JSON.stringify(fileId)}: ${await response.text()}`
      );
    }
  }

  async flushSaveQueue(url: string): Promise<void> {
    const debouncer = this.#saving.get(url);
    if (!debouncer) {
      return;
    }
    await debouncer.flush();
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
    return writing;
  }

  async deepCopy(_url: URL, graph: GraphDescriptor): Promise<GraphDescriptor> {
    return (await visitGraphNodes(graph, async (data) => {
      if (isStoredData(data)) {
        const copied = await this.ops.copyDriveFile(data);
        if (!ok(copied)) {
          throw new Error(copied.$error);
        }
        return copied;
      }
      return data;
    })) as GraphDescriptor;
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    this.#saving.get(url.href)?.cancelPendingSave();
    const deleting = await this.ops.deleteGraph(url);
    if (!ok(deleting)) {
      return { result: false, error: deleting.$error };
    }
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
      const title = project.metadata.title ?? "Untitled";

      projectNames.add(title);
      projects.push([
        project.url.href,
        {
          title,
          url: project.url.href,
          mine: project.metadata.owner === this.user.username,
          readonly: false,
          handle: null,
          tags: project.metadata?.tags,
          username: project.metadata.owner,
          thumbnail: project.metadata.thumbnail,
          description: project.metadata.description,
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
    return new GoogleDriveDataPartTransformer(
      this.#googleDriveClient,
      this.ops
    );
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
