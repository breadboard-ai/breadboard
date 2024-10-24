/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TokenVendor } from "@breadboard-ai/connection-client";
import type {
  BoardServer,
  BoardServerCapabilities,
  BoardServerConfiguration,
  BoardServerExtension,
  BoardServerProject,
  ChangeNotificationCallback,
  GraphDescriptor,
  GraphProviderCapabilities,
  GraphProviderExtendedCapabilities,
  GraphProviderItem,
  GraphProviderStore,
  Kit,
  Permission,
  User,
} from "@google-labs/breadboard";
import { getAccessToken } from "./access.js";

export { GoogleDriveBoardServer };

interface DriveFile {
  id: string;
  kind: string;
  mimeType: string;
  name: string;
  resourceKey: string;
}

interface DriveFileQuery {
  files: DriveFile[];
}

// This whole package should probably be called
// "@breadboard-ai/google-drive-board-server".
// But it's good that we have both components and the board server here:
// Good use case.
class GoogleDriveBoardServer extends EventTarget implements BoardServer {
  static PROTOCOL = "drive:";

  static async connect(folderId: string, vendor: TokenVendor) {
    const accessToken = await getAccessToken(vendor);
    const folderUrl = `https://www.googleapis.com/drive/v3/files/${folderId}`;
    const headers = new Headers({
      Authorization: `Bearer ${accessToken}`,
    });

    try {
      const response = await fetch(folderUrl, {
        headers,
        method: "GET",
      });

      const folder: DriveFile = await response.json();
      if (!folder) {
        return null;
      }

      return { title: folder.name, username: "board-builder" };
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  static async from(
    url: string,
    title: string,
    user: User,
    kits: Kit[],
    vendor: TokenVendor
  ) {
    try {
      const configuration = {
        url: new URL(url),
        projects: Promise.resolve([]),
        kits,
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

      return new GoogleDriveBoardServer(title, configuration, user, vendor);
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

  projects: Promise<BoardServerProject[]>;
  kits: Kit[];

  constructor(
    public readonly name: string,
    public readonly configuration: BoardServerConfiguration,
    public readonly user: User,
    public readonly vendor: TokenVendor
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

  async #refreshProjects(): Promise<BoardServerProject[]> {
    const folderId = this.url.hostname;
    const accessToken = await getAccessToken(this.vendor);
    const query = `"${folderId}" in parents`;

    if (!folderId || !accessToken) {
      throw new Error("No folder ID or access token");
    }

    const queryUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`;
    const headers = new Headers({
      Authorization: `Bearer ${accessToken}`,
    });

    try {
      const fileRequest = await fetch(queryUrl, {
        headers,
      });
      const response: DriveFileQuery = await fileRequest.json();
      const canAccess = true;
      const access = new Map([
        [
          this.user.username,
          {
            create: canAccess,
            retrieve: canAccess,
            update: canAccess,
            delete: canAccess,
          },
        ],
      ]);

      // TODO: This is likely due to an auth error.
      if (!("files" in response)) {
        console.warn(response);
      }

      const projects = response.files
        .filter((file) => file.mimeType === "application/json")
        .map((file) => {
          return {
            url: new URL(`${this.url}/${file.id}`),
            metadata: {
              owner: "board-builder",
              tags: [],
              title: file.name,
              access,
            },
          };
        });

      return projects;
    } catch (err) {
      console.warn(err);
      return [];
    }

    throw new Error("Error loading projects");
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
    const file = url.href.replace(`${this.url.href}/`, "");
    const accessToken = await getAccessToken(this.vendor);
    const folderUrl = `https://www.googleapis.com/drive/v3/files/${file}?alt=media`;
    const headers = new Headers({
      Authorization: `Bearer ${accessToken}`,
    });

    try {
      const response = await fetch(folderUrl, {
        headers,
        method: "GET",
      });

      const graph: GraphDescriptor = await response.json();
      if (!graph || "error" in graph) {
        return null;
      }

      return graph;
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    const file = url.href.replace(`${this.url.href}/`, "");
    const accessToken = await getAccessToken(this.vendor);
    const folderUrl = `https://www.googleapis.com/upload/drive/v3/files/${file}?uploadType=media`;
    const headers = new Headers({
      Authorization: `Bearer ${accessToken}`,
      ["Content-Type"]: "application/json",
    });

    try {
      await fetch(folderUrl, {
        headers,
        method: "PATCH",
        body: JSON.stringify(descriptor, null, 2),
      });

      return { result: true };
    } catch (err) {
      console.warn(err);
      return { result: false, error: "Unable to save" };
    }
  }

  createBlank(_url: URL): Promise<{ result: boolean; error?: string }> {
    throw new Error("Method not implemented.");
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string; url?: string }> {
    // First create the file, then save.

    const parent = this.url.hostname;
    const file = url.href.replace(`${this.url.href}/`, "");
    const accessToken = await getAccessToken(this.vendor);
    const folderUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    const boundary = globalThis.crypto.randomUUID();
    const headers = new Headers({
      Authorization: `Bearer ${accessToken}`,
      ["Content-Type"]: `multipart/related; boundary=${boundary}`,
    });

    const body = `--${boundary}
Content-Type: application/json; charset=UTF-8

{
  "name": "${file}",
  "mimeType": "application/json",
  "parents": ["${parent}"]
}
--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(descriptor, null, 2)}
--${boundary}--`;

    try {
      const response = await fetch(folderUrl, {
        headers,
        method: "POST",
        body,
      });

      const file: DriveFile = await response.json();
      const updatedUrl = `${GoogleDriveBoardServer.PROTOCOL}//${parent}/${file.id}`;

      this.projects = this.#refreshProjects();

      return { result: true, url: updatedUrl };
    } catch (err) {
      console.warn(err);
      return { result: false, error: "Unable to create" };
    }
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    const file = url.href.replace(`${this.url.href}/`, "");
    const accessToken = await getAccessToken(this.vendor);
    const folderUrl = `https://www.googleapis.com/drive/v3/files/${file}`;
    const headers = new Headers({
      Authorization: `Bearer ${accessToken}`,
    });

    try {
      await fetch(folderUrl, {
        headers,
        method: "DELETE",
      });

      this.projects = this.#refreshProjects();

      return { result: true };
    } catch (err) {
      console.warn(err);
      return { result: false, error: "Unable to delete" };
    }
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

  startingURL(): URL | null {
    throw new Error("Method not implemented.");
  }

  async canProxy(_url: URL): Promise<string | false> {
    return false;
  }

  watch(_callback: ChangeNotificationCallback) {}

  async preview(_url: URL): Promise<URL> {
    throw new Error("Method not implemented.");
  }
}
