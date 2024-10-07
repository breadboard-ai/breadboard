/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  blankLLMContent,
  type BoardServer,
  type BoardServerCapabilities,
  type BoardServerConfiguration,
  type BoardServerExtension,
  type BoardServerProject,
  type ChangeNotificationCallback,
  type GraphDescriptor,
  type GraphProviderCapabilities,
  type GraphProviderExtendedCapabilities,
  type GraphProviderItem,
  type GraphProviderStore,
  type Kit,
  type Permission,
  type User,
} from "@google-labs/breadboard";
import { fromManifest } from "@google-labs/breadboard/kits";

/**
 * For now, make a flag that controls whether to use simple requests or not.
 * Simple requests use "API_KEY" query parameter for authentication.
 */
const USE_SIMPLE_REQUESTS = true;
const CONTENT_TYPE = { "Content-Type": "application/json" };

const authHeader = (apiKey: string, headers?: HeadersInit) => {
  const h = new Headers(headers);
  h.set("Authorization", `Bearer ${apiKey}`);
  return h;
};

const createRequest = (
  url: URL | string,
  apiKey: string | null,
  method: string,
  body?: unknown
) => {
  if (typeof url === "string") {
    url = new URL(url, window.location.href);
  }
  if (USE_SIMPLE_REQUESTS) {
    if (apiKey) {
      url.searchParams.set("API_KEY", apiKey);
    }
    return new Request(url.href, {
      method,
      credentials: "include",
      body: JSON.stringify(body),
    });
  }

  return new Request(url, {
    method,
    credentials: "include",
    headers: apiKey ? authHeader(apiKey, CONTENT_TYPE) : CONTENT_TYPE,
    body: JSON.stringify(body),
  });
};

export class RemoteBoardServer extends EventTarget implements BoardServer {
  public readonly url: URL;
  public readonly users: User[];
  public readonly secrets = new Map<string, string>();
  public readonly extensions: BoardServerExtension[] = [];
  public readonly capabilities: BoardServerCapabilities;

  projects: Promise<BoardServerProject[]>;
  kits: Kit[];

  static readonly PROTOCOL = "https://";

  static async connect(url: string, apiKey?: string) {
    if (url.endsWith("/")) {
      url = url.replace(/\/$/, "");
    }

    const userRequest = createRequest(`${url}/me`, apiKey ?? null, "GET");
    const infoRequest = createRequest(`${url}/info`, null, "GET");

    try {
      const [infoRes, userRes] = await Promise.all([
        fetch(infoRequest),
        fetch(userRequest),
      ]);

      const [info, user] = await Promise.all([infoRes.json(), userRes.json()]);
      return { title: info.title, username: user.username };
    } catch (err) {
      console.warn(err);
      return false;
    }
  }

  static async from(url: string, title: string, user: User, kits: Kit[]) {
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

      return new RemoteBoardServer(title, configuration, user);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  constructor(
    public readonly name: string,
    public readonly configuration: BoardServerConfiguration,
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

    const access = project.metadata.access.get(this.user.username) ?? {
      create: false,
      retrieve: true,
      update: false,
      delete: false,
    };

    return {
      load: true,
      save: access.update,
      delete: access.delete,
    };
  }

  extendedCapabilities(): GraphProviderExtendedCapabilities {
    return {
      modify: true,
      connect: true,
      disconnect: true,
      refresh: true,
      watch: false,
      preview: true,
    };
  }

  async load(url: URL): Promise<GraphDescriptor | null> {
    const projects = await this.projects;
    const project = projects.find((project) => {
      return url.pathname.startsWith(project.url.pathname);
    });
    if (!project) {
      return null;
    }

    if (project.url.href === url.href) {
      const request = createRequest(url, null, "GET");
      const response = await fetch(request);
      const graph = await response.json();
      return graph;
    }

    return null;
  }

  async save(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    const data = await this.#sendToRemote(new URL(url), descriptor);
    if (data.error) {
      return { result: false, error: data.error };
    }

    this.projects = this.#refreshProjects();
    return { result: true };
  }

  createBlank(url: URL): Promise<{ result: boolean; error?: string }> {
    return this.save(url, blankLLMContent());
  }

  async create(
    url: URL,
    descriptor: GraphDescriptor
  ): Promise<{ result: boolean; error?: string }> {
    return this.save(url, descriptor);
  }

  async delete(url: URL): Promise<{ result: boolean; error?: string }> {
    if (!this.canProvide(url)) {
      return { result: false };
    }

    try {
      const request = createRequest(url, this.user.apiKey, "POST", {
        delete: true,
      });
      const response = await fetch(request);
      const data = await response.json();
      this.projects = this.#refreshProjects();

      if (data.error) {
        return { result: false };
      }
      return { result: true };
    } catch (err) {
      return { result: true };
    }
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

  async createURL(location: string, fileName: string): Promise<string | null> {
    const request = createRequest(
      `${location}/boards`,
      this.user.apiKey,
      "POST",
      {
        name: fileName,
      }
    );
    const response = await fetch(request);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return `${location}/boards/${data.path}`;
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

    items.set(this.name, {
      items: new Map(projects),
      permission: "granted",
      title: this.name,
      url: this.url.href,
    });

    return items;
  }

  startingURL(): URL | null {
    return null;
  }

  watch(_callback: ChangeNotificationCallback): void {
    throw new Error("Method not implemented.");
  }

  async preview(url: URL): Promise<URL> {
    return new URL(url.href.replace(/json$/, "app"));
  }

  async #sendToRemote(url: URL, descriptor: GraphDescriptor) {
    if (!this.user.apiKey) {
      return { error: "No API Key" };
    }
    const request = createRequest(url, this.user.apiKey, "POST", descriptor);
    const response = await fetch(request);
    return await response.json();
  }

  async #refreshProjects(): Promise<BoardServerProject[]> {
    type BoardServerListingItem = GraphProviderItem & {
      path: string;
    };

    const projects: BoardServerProject[] = [];
    try {
      const request = createRequest(
        `${this.url.origin}/boards`,
        this.user.apiKey,
        "GET"
      );

      const response = await fetch(request);
      const files: BoardServerListingItem[] = await response.json();

      for (const item of files) {
        // Workaround for the fact that we don't yet store the username as part
        // of the Board Server configuration. Here we use the `mine` property to
        // set the username.
        if (item.mine && item.username) {
          this.user.username = item.username;
        }

        const canAccess = item.username === this.user.username;
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

        const project: BoardServerProject = {
          url: new URL(`${this.url.origin}/boards/${item.path}`),
          metadata: {
            owner: item.username ?? "Unknown",
            tags: item.tags,
            title: item.title,
            access,
          },
        };

        projects.push(project);
      }
    } catch (err) {
      console.warn(
        `[Remote Board Server]: Unable to connect to ${this.url}`,
        err
      );
    }

    this.#refreshBoardServerKit(projects);
    return projects;
  }

  async #refreshBoardServerKit(projects: BoardServerProject[]) {
    if (!projects.length) {
      return;
    }

    const nodes: Record<string, GraphDescriptor> = {};
    for (let idx = 0; idx < projects.length; idx++) {
      const project = projects[idx];
      if (!project.url) {
        continue;
      }

      const id = `node-${globalThis.crypto.randomUUID()}`;
      const type = project.url.href;
      if (!project.metadata?.tags || !project.metadata?.tags.includes("tool")) {
        continue;
      }

      nodes[type] = {
        title: `@${project.metadata.owner} - ${project.metadata.title} `,
        description: project.metadata.description,
        metadata: {
          tags: project.metadata?.tags,
          icon: project.metadata?.icon ?? "generic",
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

    const boardServerKit = fromManifest({
      url: `${this.url.href}/bsk`,
      version: "0.0.1",
      title: "Board Server Kit",
      nodes,
    });

    this.kits = this.kits.filter((kit) => kit.title !== "Board Server Kit");
    this.kits.push(boardServerKit);
  }

  async canProxy(url: URL): Promise<string | false> {
    if (!this.canProvide(url)) {
      return false;
    }

    return `${this.url.href}/proxy?API_KEY=${this.user.apiKey}`;
  }
}
